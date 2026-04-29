from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    storage_path: str = "./storage"
    database_path: str = "./storage/jobs.db"

    # TDATR model paths
    tdatr_repo_dir: str = "./TDATR"
    tdatr_checkpoint_path: str = "/models/model.pt"

    # Surya model paths
    surya_layout_model_dir: str = "/models/surya_layout"
    surya_recognition_model_dir: str = "/models/surya_recognition"

    # TATR model paths
    tatr_model_name: str = "microsoft/table-transformer-structure-recognition-v1.1-all"
    tatr_tsr_checkpoint: str = "/models/tatr_tsr.pt"

    # Detection config
    table_detection_threshold: float = 0.0
    table_detection_padding: float = 5.0

    # TDATR generation config
    tdatr_max_len: int = 4096
    tdatr_temperature: float = 0.5
    tdatr_no_repeat_ngram_size: int = 15
    tdatr_min_len: int = 1
    tdatr_seed: int = 42

    # Limits
    max_file_size_mb: int = 100

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
