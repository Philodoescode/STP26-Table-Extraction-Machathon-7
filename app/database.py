import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.config import get_settings


def _db_path() -> str:
    settings = get_settings()
    path = Path(settings.database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


@contextmanager
def get_db(*, create_if_missing: bool = False):
    from app.services.modal_volume import storage_io_guard

    with storage_io_guard():
        db_path = _db_path()
        if create_if_missing:
            dsn = db_path
            uri = False
        else:
            # Do not auto-create a blank DB file during transient volume states.
            dsn = f"file:{db_path}?mode=rw"
            uri = True

        # timeout=30: wait up to 30s for the file lock on a shared network volume.
        conn = sqlite3.connect(dsn, check_same_thread=False, timeout=30, uri=uri)
        conn.row_factory = sqlite3.Row
        # Shared-volume deployment: rollback journal is more conservative than WAL.
        conn.execute("PRAGMA journal_mode=DELETE")
        # busy_timeout lets SQLite retry on SQLITE_BUSY instead of raising immediately.
        conn.execute("PRAGMA busy_timeout=10000")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def init_db() -> None:
    with get_db(create_if_missing=True) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id          TEXT PRIMARY KEY,
                filename    TEXT NOT NULL,
                file_path   TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'pending',
                stage       TEXT,
                progress    INTEGER DEFAULT 0,
                error       TEXT,
                created_at  TEXT NOT NULL,
                started_at  TEXT,
                finished_at TEXT,
                latency_ms  INTEGER
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS table_results (
                id                   TEXT PRIMARY KEY,
                job_id               TEXT NOT NULL,
                page_num             INTEGER NOT NULL DEFAULT 0,
                table_index          INTEGER NOT NULL DEFAULT 0,
                bbox                 TEXT,
                detection_confidence REAL DEFAULT 1.0,
                crop_path            TEXT NOT NULL,
                ocr_json             TEXT,
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            )
        """)

        # ── User overrides for individual cells ──────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cell_overrides (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                table_id      TEXT    NOT NULL,
                job_id        TEXT    NOT NULL,
                row_index     INTEGER NOT NULL,
                col_index     INTEGER NOT NULL,
                original_text TEXT,
                override_text TEXT    NOT NULL,
                updated_at    TEXT    NOT NULL,
                FOREIGN KEY (table_id) REFERENCES table_results(id),
                FOREIGN KEY (job_id)   REFERENCES jobs(id),
                UNIQUE(table_id, row_index, col_index)
            )
        """)

        # ── Export tracking for idempotent CSV builds ────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS exports (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id       TEXT NOT NULL UNIQUE,
                csv_path     TEXT NOT NULL,
                data_hash    TEXT NOT NULL,
                created_at   TEXT NOT NULL,
                download_url TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            )
        """)

        # ── Performance indexes for metrics queries ──────────────────────
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_jobs_finished ON jobs(finished_at)"
        )
