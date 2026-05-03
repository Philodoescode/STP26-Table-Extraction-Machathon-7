from __future__ import annotations

import logging
import queue
import threading
from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import get_settings
from app.database import get_db
from app.services.table_pipeline import process_document

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class JobTask:
    job_id: str
    file_path: str
    mode: str = "accurate"


class JobQueueFullError(RuntimeError):
    pass


class JobQueue:
    def __init__(self, worker_count: int, gpu_concurrency: int, max_queue_size: int = 0) -> None:
        if worker_count < 1:
            raise ValueError("worker_count must be >= 1")
        if gpu_concurrency < 1:
            raise ValueError("gpu_concurrency must be >= 1")
        if max_queue_size < 0:
            raise ValueError("max_queue_size must be >= 0")

        self._worker_count = worker_count
        self._queue: queue.Queue[JobTask] = queue.Queue(maxsize=max_queue_size)
        self._gpu_slots = threading.Semaphore(gpu_concurrency)
        self._workers: list[threading.Thread] = []
        self._stop = threading.Event()
        self._state_lock = threading.Lock()
        self._started = False

    def start(self) -> None:
        with self._state_lock:
            if self._started:
                return
            self._stop.clear()
            self._workers = []
            for i in range(self._worker_count):
                worker = threading.Thread(
                    target=self._worker_loop,
                    name=f"job-worker-{i + 1}",
                    daemon=True,
                )
                worker.start()
                self._workers.append(worker)
            self._started = True
        logger.info("Job queue started with %s worker(s)", self._worker_count)

    def stop(self, join_timeout: float = 5.0) -> None:
        with self._state_lock:
            if not self._started:
                return
            self._stop.set()
            workers = list(self._workers)
            self._workers = []
            self._started = False
        for worker in workers:
            worker.join(timeout=join_timeout)
        logger.info("Job queue stopped")

    def enqueue(self, job_id: str, file_path: str, mode: str = "accurate") -> int:
        try:
            self._queue.put_nowait(JobTask(job_id=job_id, file_path=file_path, mode=mode))
        except queue.Full as exc:
            raise JobQueueFullError("Job queue is full") from exc
        return self._queue.qsize()

    def _worker_loop(self) -> None:
        while not self._stop.is_set():
            try:
                task = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue

            try:
                process_document(task.job_id, task.file_path, gpu_semaphore=self._gpu_slots, mode=task.mode)
            except Exception:
                logger.exception("Job %s failed in worker thread", task.job_id)
            finally:
                self._queue.task_done()


_job_queue: JobQueue | None = None
_job_queue_lock = threading.Lock()


def start_job_queue() -> JobQueue:
    global _job_queue
    with _job_queue_lock:
        if _job_queue is not None:
            return _job_queue
        settings = get_settings()
        queue_instance = JobQueue(
            worker_count=settings.job_worker_count,
            gpu_concurrency=settings.gpu_concurrency,
            max_queue_size=settings.job_queue_size,
        )
        queue_instance.start()
        _job_queue = queue_instance
    _requeue_unfinished_jobs()
    return queue_instance


def stop_job_queue() -> None:
    global _job_queue
    with _job_queue_lock:
        queue_instance = _job_queue
        _job_queue = None
    if queue_instance is not None:
        queue_instance.stop()


def get_job_queue() -> JobQueue:
    if _job_queue is None:
        raise RuntimeError("Job queue is not running")
    return _job_queue


def _requeue_unfinished_jobs() -> None:
    queue_instance = get_job_queue()
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, file_path
            FROM jobs
            WHERE status IN ('pending', 'processing')
            ORDER BY created_at
            """
        ).fetchall()

        if not rows:
            return

        for row in rows:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'pending',
                    stage = 'queued',
                    progress = 0,
                    started_at = NULL,
                    finished_at = NULL,
                    error = NULL
                WHERE id = ?
                """,
                [row["id"]],
            )

    for row in rows:
        try:
            queue_instance.enqueue(row["id"], row["file_path"])
        except JobQueueFullError:
            with get_db() as conn:
                conn.execute(
                    """
                    UPDATE jobs
                    SET status = 'failed',
                        stage = 'failed',
                        finished_at = ?,
                        error = 'Queue capacity exceeded during recovery'
                    WHERE id = ?
                    """,
                    [datetime.now(timezone.utc).isoformat(), row["id"]],
                )
            logger.exception("Failed to recover job %s because queue is full", row["id"])
