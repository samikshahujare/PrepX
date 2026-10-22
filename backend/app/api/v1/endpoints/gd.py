import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user
from app.core import security
from app.core.config import settings
from app.core.exceptions import (
    UnauthorizedException,
    ForbiddenException,
    ValidationException,
    NotFoundException,
)
from app.db.session import get_db, SessionLocal
from app.models.gd import GDParticipant, GDSession, GDTranscript
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.common import ApiResponse
from app.schemas.gd import (
    GDSessionCreate,
    GDSessionResponse,
    GDTopicGenerateRequest,
    GDTopicGenerateResponse,
    GDInvitationResponse,
    GDParticipantResponse,
    GDJoinRequest,
    GDEvaluationResponse,
)
from app.services.gd_room_manager import gd_room_manager
from app.services.gd_service import GDService
from app.services.gd_moderator_service import GDModeratorService
from app.services.gd_evaluator_service import GDEvaluatorService

logger = logging.getLogger("prepx.gd_endpoints")
router = APIRouter()


def get_optional_current_user(
    request: Optional[Request],
    db: Session,
) -> Optional[User]:
    """Helper to extract active user from Authorization header if present, without failing guests."""
    if not request:
        return None
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = security.decode_token(token)
        if not payload or payload.get("type") != "access":
            return None
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_id = uuid.UUID(user_id_str)
        user_repo = UserRepository(db)
        user = user_repo.get_by_id(user_id)
        if user and user.is_active:
            return user
    except Exception:
        return None
    return None



@router.post(
    "/sessions",
    response_model=ApiResponse[GDSessionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Group Discussion session",
)
def create_gd_session(
    data: GDSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = GDService(db)
    host_display = "Host"
    if current_user.profile and current_user.profile.full_name:
        host_display = current_user.profile.full_name
    elif current_user.email:
        host_display = current_user.email.split("@")[0].title()

    session = service.create_session(
        creator_id=current_user.id,
        data=data,
        host_name=host_display,
    )
    return ApiResponse(
        success=True,
        data=GDSessionResponse.model_validate(session),
        message="Group Discussion session created successfully.",
    )


@router.get(
    "/sessions",
    response_model=ApiResponse[List[GDSessionResponse]],
    status_code=status.HTTP_200_OK,
    summary="List Group Discussion sessions for current user",
)
def list_gd_sessions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = GDService(db)
    sessions = service.list_user_sessions(user_id=current_user.id)
    return ApiResponse(
        success=True,
        data=[GDSessionResponse.model_validate(s) for s in sessions],
        message="Sessions retrieved successfully.",
    )


@router.get(
    "/sessions/{identifier}",
    response_model=ApiResponse[GDSessionResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Group Discussion session details by ID or code",
)
def get_gd_session(
    identifier: str,
    request: Request,
    participant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    service = GDService(db)
    session = service.get_session_by_id_or_code(identifier)

    user = get_optional_current_user(request, db)
    is_authorized = False

    if user:
        is_authorized = True
    else:
        pid = participant_id or request.headers.get("X-Participant-Id")
        if pid:
            try:
                p_uuid = uuid.UUID(pid)
                part = (
                    db.query(GDParticipant)
                    .filter(GDParticipant.id == p_uuid, GDParticipant.session_id == session.id)
                    .first()
                )
                if part:
                    is_authorized = True
            except (ValueError, TypeError):
                pass

    if not is_authorized:
        raise UnauthorizedException("Authentication or valid participant identity required to access session details.")

    return ApiResponse(
        success=True,
        data=GDSessionResponse.model_validate(session),
        message="Session retrieved successfully.",
    )


@router.post(
    "/sessions/{session_id}/generate-topic",
    response_model=ApiResponse[GDTopicGenerateResponse],
    status_code=status.HTTP_200_OK,
    summary="Generate a balanced Group Discussion topic with AI",
)
def generate_gd_topic(
    session_id: str,
    data: GDTopicGenerateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = GDService(db)
    topic_data = service.generate_topic(
        category=data.category,
        role_context=data.role_context,
        company=data.company,
    )
    return ApiResponse(
        success=True,
        data=GDTopicGenerateResponse(**topic_data),
        message="Topic generated successfully.",
    )


@router.post(
    "/sessions/{session_id}/invitations",
    response_model=ApiResponse[GDInvitationResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Generate invitation token and sharing links",
)
def create_session_invitation(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = GDService(db)
    session = service.get_session_by_id_or_code(session_id)
    invite = service.create_invitation(session_id=session.id)

    # Determine canonical frontend base URL
    origin = settings.canonical_frontend_url
    if not settings.APP_PUBLIC_URL:
        req_origin = request.headers.get("origin")
        if req_origin and not any(h in req_origin for h in ["localhost", "127.0.0.1"]):
            origin = req_origin.rstrip("/")

    share_info = service.format_share_links(session=session, token=invite.token, base_url=origin)
    is_public = bool(origin and not any(h in origin for h in ["localhost", "127.0.0.1"]))

    return ApiResponse(
        success=True,
        data=GDInvitationResponse(
            token=invite.token,
            join_url=share_info["join_url"],
            whatsapp_share_url=share_info["whatsapp_share_url"],
            email_share_subject=share_info["email_share_subject"],
            email_share_body=share_info["email_share_body"],
            expires_at=invite.expires_at,
            is_public=is_public,
        ),
        message="Invitation link created successfully.",
    )


@router.get(
    "/sessions/{session_id}/evaluations/me",
    response_model=ApiResponse[GDEvaluationResponse],
    status_code=status.HTTP_200_OK,
    summary="Get current user or guest participant's individualized GD evaluation report",
)
def get_my_gd_evaluation(
    session_id: str,
    request: Request,
    participant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    service = GDService(db)
    session = service.get_session_by_id_or_code(session_id)
    eval_service = GDEvaluatorService(db)

    user = get_optional_current_user(request, db)
    if user:
        eval_report = eval_service.get_participant_evaluation(session_id=session.id, user_id=user.id)
    else:
        pid = participant_id or request.headers.get("X-Participant-Id")
        if not pid:
            raise UnauthorizedException("Authentication or participant identity required to view evaluation.")
        try:
            p_uuid = uuid.UUID(pid)
        except (ValueError, TypeError):
            raise ValidationException("Invalid participant identifier format.")

        part = (
            db.query(GDParticipant)
            .filter(GDParticipant.id == p_uuid, GDParticipant.session_id == session.id)
            .first()
        )
        if not part:
            raise NotFoundException("Participant not found in this session.")

        eval_report = eval_service.get_participant_evaluation(session_id=session.id, participant_id=p_uuid)

    return ApiResponse(
        success=True,
        data=GDEvaluationResponse.model_validate(eval_report),
        message="Personal evaluation retrieved successfully.",
    )


@router.post(
    "/sessions/{session_id}/evaluate",
    response_model=ApiResponse[List[GDEvaluationResponse]],
    status_code=status.HTTP_200_OK,
    summary="Trigger evaluation for all participants in a session",
)
def evaluate_all_gd_participants(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = GDService(db)
    session = service.get_session_by_id_or_code(session_id)
    eval_service = GDEvaluatorService(db)

    results = []
    for participant in session.participants:
        report = eval_service.evaluate_participant(session_id=session.id, participant_id=participant.id)
        results.append(GDEvaluationResponse.model_validate(report))

    return ApiResponse(
        success=True,
        data=results,
        message="Evaluations generated successfully.",
    )


@router.get(
    "/sessions/{session_id}/transcripts",
    status_code=status.HTTP_200_OK,
    summary="Get session transcripts",
)
def get_gd_transcripts(
    session_id: str,
    request: Request,
    participant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    service = GDService(db)
    session = service.get_session_by_id_or_code(session_id)

    user = get_optional_current_user(request, db)
    is_authorized = False
    if user:
        is_authorized = True
    else:
        pid = participant_id or request.headers.get("X-Participant-Id")
        if pid:
            try:
                p_uuid = uuid.UUID(pid)
                part = (
                    db.query(GDParticipant)
                    .filter(GDParticipant.id == p_uuid, GDParticipant.session_id == session.id)
                    .first()
                )
                if part:
                    is_authorized = True
            except (ValueError, TypeError):
                pass

    if not is_authorized:
        raise UnauthorizedException("Authentication or valid participant identity required to access transcripts.")

    transcripts = (
        db.query(GDTranscript)
        .filter(GDTranscript.session_id == session.id)
        .order_by(GDTranscript.sequence_number.asc())
        .all()
    )
    return ApiResponse(
        success=True,
        data=[
            {
                "id": str(t.id),
                "participant_id": str(t.participant_id) if t.participant_id else None,
                "speaker_name": t.speaker_name,
                "is_moderator": t.is_moderator,
                "message": t.message,
                "timestamp_seconds": t.timestamp_seconds,
                "sequence_number": t.sequence_number,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transcripts
        ],
        message="Transcripts retrieved successfully.",
    )


@router.get(
    "/invitations/{token}/validate",
    response_model=ApiResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Public endpoint to validate invitation token before joining",
)
def validate_gd_invitation(
    token: str,
    db: Session = Depends(get_db),
):
    service = GDService(db)
    validation_data = service.validate_invitation(token)
    return ApiResponse(
        success=True,
        data=validation_data,
        message="Invitation token is valid.",
    )


@router.post(
    "/invitations/{token}/join",
    response_model=ApiResponse[GDParticipantResponse],
    status_code=status.HTTP_200_OK,
    summary="Join discussion session with invitation token",
)
def join_gd_session(
    token: str,
    join_data: GDJoinRequest,
    db: Session = Depends(get_db),
):
    service = GDService(db)
    val = service.validate_invitation(token)
    session_id = uuid.UUID(val["session"]["id"])

    participant = service.join_participant(
        session_id=session_id,
        display_name=join_data.display_name,
        user_id=None,
        guest_id=join_data.guest_id,
    )
    return ApiResponse(
        success=True,
        data=GDParticipantResponse.model_validate(participant),
        message="Joined Group Discussion successfully.",
    )


@router.websocket("/ws/{session_code}")
async def gd_websocket_endpoint(
    websocket: WebSocket,
    session_code: str,
    participant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Real-time Group Discussion WebSocket gateway.
    Handles presence, live audio relay, and transcript broadcast.
    """
    session_code_upper = session_code.upper()
    pid_str = participant_id or ""
    try:
        session = db.query(GDSession).filter(GDSession.session_code == session_code_upper).first()
        if not session:
            await websocket.close(code=1008, reason="Session not found")
            return

        participant = None
        if participant_id:
            try:
                p_uuid = uuid.UUID(participant_id)
                participant = (
                    db.query(GDParticipant)
                    .filter(GDParticipant.id == p_uuid, GDParticipant.session_id == session.id)
                    .first()
                )
            except ValueError:
                pass

        if not participant:
            await websocket.close(code=1008, reason="Participant not found")
            return

        pid_str = str(participant.id)
        display_name = participant.display_name
        is_host = participant.is_host

        await gd_room_manager.connect(
            session_code=session_code_upper,
            participant_id=pid_str,
            websocket=websocket,
            display_name=display_name,
            is_host=is_host,
            topic=session.topic,
            duration_minutes=session.duration_minutes,
            session_id=session.id,
        )

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type in ("audio_chunk", "AUDIO_CHUNK", "AUDIO_RELAY"):
                audio_payload = data.get("audio_data") or data.get("data")
                sample_rate = int(data.get("sample_rate", 44100))
                if audio_payload:
                    await gd_room_manager.relay_audio(
                        session_code=session_code_upper,
                        sender_id=pid_str,
                        audio_data=audio_payload,
                        sample_rate=sample_rate,
                    )
            elif msg_type in ("mic_state", "MUTE_CHANGE"):
                is_muted = bool(data.get("is_muted", False))
                await gd_room_manager.update_mute_state(
                    session_code=session_code_upper,
                    participant_id=pid_str,
                    is_muted=is_muted,
                )
            elif msg_type in ("transcript_segment", "TRANSCRIPT_CHUNK"):
                msg_text = data.get("message", "").strip()
                is_final = data.get("is_final", True) if msg_type == "TRANSCRIPT_CHUNK" else bool(data.get("is_final", False))
                is_manual = bool(data.get("is_manual", False))
                ts = float(data.get("timestamp_seconds", 0.0))

                if is_final and msg_text:
                    # 1. Deduplication check for duplicate re-transmissions
                    recent_dupe = (
                        db.query(GDTranscript)
                        .filter(
                            GDTranscript.session_id == session.id,
                            GDTranscript.participant_id == participant.id,
                            GDTranscript.message == msg_text,
                        )
                        .order_by(GDTranscript.sequence_number.desc())
                        .first()
                    )
                    if recent_dupe and abs(recent_dupe.timestamp_seconds - ts) < 2.0:
                        continue

                    # 2. Echo suppression check: verify candidate microphone didn't capture Sarah's speech
                    if not is_manual:
                        recent_mod_speech = (
                            db.query(GDTranscript)
                            .filter(
                                GDTranscript.session_id == session.id,
                                GDTranscript.is_moderator == True,
                            )
                            .order_by(GDTranscript.sequence_number.desc())
                            .first()
                        )
                        if recent_mod_speech and (ts - recent_mod_speech.timestamp_seconds) < 8.0:
                            mod_words = set(recent_mod_speech.message.lower().split())
                            cand_words = set(msg_text.lower().split())
                            if len(cand_words) >= 4 and len(mod_words & cand_words) / len(cand_words) > 0.75:
                                logger.info(f"Suppressed acoustic echo of moderator statement from {display_name}")
                                continue

                    mod_svc = GDModeratorService(db)
                    saved_t = mod_svc.record_transcript(
                        session_id=session.id,
                        participant_id=participant.id,
                        speaker_name=display_name,
                        message=msg_text,
                        timestamp_seconds=ts,
                        is_moderator=False,
                    )

                    room = gd_room_manager.get_or_create_room(session_code_upper)
                    room.record_transcript_chunk(pid_str, msg_text, is_moderator=False)

                    # Broadcast finalized segment to all peers
                    await gd_room_manager.broadcast(
                        session_code_upper,
                        {
                            "type": "TRANSCRIPT_CHUNK",
                            "participant_id": pid_str,
                            "speaker_name": display_name,
                            "message": msg_text,
                            "is_manual": is_manual,
                            "timestamp_seconds": saved_t.timestamp_seconds,
                            "sequence_number": saved_t.sequence_number,
                            "is_moderator": False,
                        },
                    )
                elif not is_final and msg_text:
                    await gd_room_manager.broadcast(
                        session_code_upper,
                        {
                            "type": "INTERIM_TRANSCRIPT",
                            "participant_id": pid_str,
                            "speaker_name": display_name,
                            "message": msg_text,
                        },
                        exclude_participant_id=pid_str,
                    )
            elif msg_type in ("start_discussion", "START_DISCUSSION"):
                room = gd_room_manager.get_or_create_room(session_code_upper)
                # Guard against duplicate opening statements
                if not room.has_opened:
                    room.has_opened = True
                    room.status = "in_progress"
                    room.started_at = time.time()
                    session.status = "in_progress"
                    session.started_at = datetime.now(timezone.utc)
                    db.commit()

                    mod_svc = GDModeratorService(db)
                    opening = mod_svc.generate_opening(
                        topic=session.topic,
                        duration_minutes=session.duration_minutes,
                    )
                    words = len(opening.split())
                    room.sarah_speaking_until = time.time() + max(4.0, (words / 3.0) + 1.5)
                    room.last_speech_epoch = time.time()
                    room.last_intervention_epoch = time.time()

                    mod_t = mod_svc.record_transcript(
                        session_id=session.id,
                        participant_id=None,
                        speaker_name="Sarah Jenkins",
                        message=opening,
                        timestamp_seconds=0.0,
                        is_moderator=True,
                    )

                    await gd_room_manager.broadcast(
                        session_code_upper,
                        {
                            "type": "MODERATOR_OPENING",
                            "topic": session.topic,
                            "duration_minutes": session.duration_minutes,
                            "statement": opening,
                            "moderator_opening": opening,
                            "sequence_number": mod_t.sequence_number,
                        },
                    )

                    # Start autonomous room moderation loop
                    gd_room_manager.start_autonomous_moderator(session_code_upper)
            elif msg_type in ("conclude_discussion", "CONCLUDE_DISCUSSION", "SESSION_COMPLETED"):
                room = gd_room_manager.get_or_create_room(session_code_upper)
                # Guard against duplicate conclusion statements
                if not room.has_concluded:
                    room.has_concluded = True
                    room.status = "completed"
                    session.status = "completed"
                    session.ended_at = datetime.now(timezone.utc)
                    db.commit()

                    all_transcripts = (
                        db.query(GDTranscript)
                        .filter(GDTranscript.session_id == session.id)
                        .order_by(GDTranscript.sequence_number.asc())
                        .all()
                    )
                    mod_svc = GDModeratorService(db)
                    closing = mod_svc.generate_closing(
                        topic=session.topic,
                        transcripts=all_transcripts,
                    )
                    mod_t = mod_svc.record_transcript(
                        session_id=session.id,
                        participant_id=None,
                        speaker_name="Sarah Jenkins",
                        message=closing,
                        timestamp_seconds=float((session.duration_minutes * 60)),
                        is_moderator=True,
                    )

                    await gd_room_manager.broadcast(
                        session_code_upper,
                        {
                            "type": "SESSION_COMPLETED",
                            "moderator_closing": closing,
                            "statement": closing,
                            "session_id": str(session.id),
                            "sequence_number": mod_t.sequence_number,
                        },
                    )
    except WebSocketDisconnect:
        await gd_room_manager.disconnect(session_code_upper, pid_str)
    except Exception as e:
        logger.error(f"WebSocket error in GD room {session_code_upper}: {e}", exc_info=True)
        await gd_room_manager.disconnect(session_code_upper, pid_str)

