from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/health")
async def health():
    try:
        import torch
        gpu = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if gpu else None
    except Exception:
        gpu = False
        gpu_name = None

    return JSONResponse({"status": "ok", "gpu": gpu, "gpu_name": gpu_name})
