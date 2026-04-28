"""
BackgroundTasks wrapper around the ML pipeline.
Drop-in replacement for a Celery task — same call signature.
"""
from app.services.table_pipeline import process_document


def run_process_document(job_id: str, file_path: str) -> None:
    process_document(job_id, file_path)
