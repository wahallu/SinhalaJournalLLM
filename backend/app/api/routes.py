from fastapi import APIRouter
from app.core.router import task_router

router = APIRouter()

@router.post("/process")
def process_request(data: dict):
    task = data.get("task")
    text = data.get("text")

    result = task_router(task, text)

    return {"result": result}