from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.chat_agent import run_chat
from app.config import settings
import json

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str    # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    min_confidence: Optional[int] = None   # user can raise above admin floor, not lower


@router.post("/")
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI chat endpoint. Returns a streaming response so the UI can show
    the response token-by-token as Claude reasons through candidates.
    """
    # Enforce confidence floor
    effective_floor = settings.chat_confidence_floor
    if request.min_confidence is not None:
        effective_floor = max(effective_floor, request.min_confidence)

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def generate():
        async for chunk in run_chat(messages, effective_floor, db):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
