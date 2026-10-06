import time
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from app.core.config import settings
from app.core.logging import logger
from app.schemas.common import ApiResponse

router = APIRouter()


class AvatarStatusResponse(BaseModel):
    configured: bool
    active_provider: str
    has_api_key: bool
    has_avatar_id: bool
    avatar_id: Optional[str] = None
    target_persona: str = "Sarah Jenkins (AI Senior Interviewer)"
    reference_image_url: str = "/avatars/sarah-reference.png"
    message: str


class AvatarSessionRequest(BaseModel):
    session_id: Optional[str] = None
    vendor: Optional[str] = "local"
    duration_minutes: Optional[int] = 30


class AvatarTTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "en-US-JennyNeural"
    speed: Optional[float] = 1.0


class AvatarSessionResponse(BaseModel):
    configured: bool
    status: str  # "ready" | "unconfigured" | "error"
    vendor: str
    message: str
    fallback_provider: str = "local_2d"
    session_token: Optional[str] = None
    avatar_id: Optional[str] = None
    stream_url: Optional[str] = None


@router.post("/tts")
async def generate_avatar_speech(request: AvatarTTSRequest):
    """
    Generate natural neural audio for Sarah Jenkins using edge-tts.
    Free, local/edge synthesis with zero paid API consumption.
    Returns audio/mpeg stream directly playable in the browser.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    import edge_tts

    rate_str = f"{int((request.speed - 1.0) * 100):+d}%" if request.speed and request.speed != 1.0 else "+0%"
    communicate = edge_tts.Communicate(
        text=request.text,
        voice=request.voice or "en-US-JennyNeural",
        rate=rate_str,
    )
    audio_data = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data.extend(chunk["data"])

    return Response(
        content=bytes(audio_data),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/status", response_model=ApiResponse[AvatarStatusResponse], status_code=status.HTTP_200_OK)
def get_avatar_status():
    """
    Check Sarah Local AI Interviewer avatar status.
    Requires no external avatar credentials.
    """
    return ApiResponse(
        success=True,
        data=AvatarStatusResponse(
            configured=True,
            active_provider="local",
            has_api_key=False,
            has_avatar_id=False,
            avatar_id="sarah-local-2d",
            target_persona="Sarah Jenkins (AI Senior Interviewer)",
            reference_image_url="/avatars/sarah-reference.png",
            message="Sarah — Local AI Interviewer is ready.",
        ),
        message="Avatar status retrieved successfully",
    )


@router.post("/session", response_model=ApiResponse[AvatarSessionResponse], status_code=status.HTTP_200_OK)
async def create_avatar_session(request: AvatarSessionRequest):
    """
    Initialize a local avatar session for Sarah Jenkins.
    Runs 100% locally in-browser without external avatar dependencies.
    """
    session_id = request.session_id or f"local-session-{int(time.time())}"
    logger.info(f"Initialized local Sarah avatar session for session_id={session_id}")

    return ApiResponse(
        success=True,
        data=AvatarSessionResponse(
            configured=True,
            status="ready",
            vendor="local",
            message="Local 2D/Canvas Sarah session ready.",
            fallback_provider="local_2d",
            session_token=session_id,
            avatar_id="sarah-jenkins-2d",
        ),
        message="Local avatar session initialized successfully",
    )
