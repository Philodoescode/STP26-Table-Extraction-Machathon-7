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
def get_db():
    conn = sqlite3.connect(_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
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
