from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/ready")
async def ready() -> dict[str, str]:
    return {"status": "ready"}
