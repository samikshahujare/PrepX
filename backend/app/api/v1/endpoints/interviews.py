import os
import tempfile
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user
from app.core.exceptions import PrepXException
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.interview import (
    InterviewResponseRequest,
    InterviewResponseResult,
    InterviewRuntimeState,
    InterviewSessionCreate,
    InterviewSessionRead,
    InterviewStartRequest,
    InterviewStartResponse,
    JDAnalysisResult,
    JDParseRequest,
    QuestionGenerateRequest,
    QuestionRead,
    TranscriptRead,
)
from app.services.extraction_service import ResumeExtractorService
from app.services.interview_service import InterviewService
from app.services.parser_service import JobDescriptionParser

router = APIRouter()


# ==========================================
# Job Description Analysis Endpoints
# ==========================================

@router.post(
    "/parse-jd-text",
    response_model=ApiResponse[JDAnalysisResult],
    status_code=status.HTTP_200_OK,
    summary="Parse raw job description text into structured roles, skills, and requirements",
)
def parse_jd_text(
    payload: JDParseRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Analyze plain-text job description and extract role, company, skills, and responsibilities."""
    parser = JobDescriptionParser()
    result = parser.parse(payload.text)
    return ApiResponse(
        success=True,
        data=JDAnalysisResult(**result),
        message="Job description parsed and analyzed successfully",
    )


@router.post(
    "/parse-jd-file",
    response_model=ApiResponse[JDAnalysisResult],
    status_code=status.HTTP_200_OK,
    summary="Extract text and analyze job description from uploaded file (PDF, DOCX, TXT)",
)
async def parse_jd_file(
    file: UploadFile = File(..., description="Job description document (PDF, DOCX, or TXT)"),
    current_user: User = Depends(get_current_active_user),
):
    """Extract and analyze job description text from PDF, DOCX, or TXT documents."""
    filename = file.filename or "jd.txt"
    ext = os.path.splitext(filename)[1].lower().replace(".", "")

    if ext not in ["pdf", "docx", "doc", "txt"]:
        raise PrepXException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Please upload PDF, DOCX, or TXT.",
            code="UNSUPPORTED_FILE_TYPE",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise PrepXException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowable limit of 10MB.",
            code="FILE_TOO_LARGE",
        )

    if ext == "txt":
        raw_text = content.decode("utf-8", errors="ignore")
    else:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            raw_text = ResumeExtractorService.extract_text(tmp_path, ext)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    parser = JobDescriptionParser()
    result = parser.parse(raw_text)
    return ApiResponse(
        success=True,
        data=JDAnalysisResult(**result),
        message=f"Job description '{filename}' parsed and analyzed successfully",
    )



# ==========================================
# Session Management & Question Generation
# ==========================================

@router.post(
    "/sessions",
    response_model=ApiResponse[InterviewSessionRead],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new interview preparation session",
)
def create_session(
    session_in: InterviewSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a preparation session linking user, domain, company, difficulty, and optional resume."""
    interview_service = InterviewService(db)
    session = interview_service.create_session(
        user_id=current_user.id, session_in=session_in
    )
    return ApiResponse(
        success=True,
        data=InterviewSessionRead.model_validate(session),
        message="Interview preparation session created successfully",
    )


@router.get(
    "/sessions",
    response_model=ApiResponse[List[InterviewSessionRead]],
    status_code=status.HTTP_200_OK,
    summary="List all interview preparation sessions for the user",
)
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all interview sessions belonging to the authenticated user."""
    interview_service = InterviewService(db)
    sessions = interview_service.list_sessions(user_id=current_user.id)
    return ApiResponse(
        success=True,
        data=[InterviewSessionRead.model_validate(s) for s in sessions],
        message="Interview sessions retrieved successfully",
    )


@router.get(
    "/sessions/{session_id}",
    response_model=ApiResponse[InterviewSessionRead],
    status_code=status.HTTP_200_OK,
    summary="Get interview preparation session details and questions",
)
def get_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve an interview session with its generated questions."""
    interview_service = InterviewService(db)
    session = interview_service.get_session(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=InterviewSessionRead.model_validate(session),
        message="Interview session retrieved successfully",
    )


@router.post(
    "/sessions/{session_id}/questions/generate",
    response_model=ApiResponse[List[QuestionRead]],
    status_code=status.HTTP_200_OK,
    summary="Generate personalized mock interview questions for a session",
)
def generate_questions(
    session_id: uuid.UUID,
    gen_request: QuestionGenerateRequest = QuestionGenerateRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate and store structured interview questions tailored to the session domain, company, difficulty, and resume."""
    interview_service = InterviewService(db)
    questions = interview_service.generate_questions_for_session(
        session_id=session_id, user_id=current_user.id, count=gen_request.count
    )
    return ApiResponse(
        success=True,
        data=[QuestionRead.model_validate(q) for q in questions],
        message=f"Generated {len(questions)} personalized interview questions",
    )


@router.get(
    "/sessions/{session_id}/questions",
    response_model=ApiResponse[List[QuestionRead]],
    status_code=status.HTTP_200_OK,
    summary="Get all generated questions for a preparation session",
)
def get_session_questions(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve existing questions for an interview session."""
    interview_service = InterviewService(db)
    questions = interview_service.get_session_questions(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=[QuestionRead.model_validate(q) for q in questions],
        message="Questions retrieved successfully",
    )


# ==========================================
# Phase 3 Real-time Mock Interview Runtime
# ==========================================

@router.post(
    "/sessions/{session_id}/start",
    response_model=ApiResponse[InterviewStartResponse],
    status_code=status.HTTP_200_OK,
    summary="Start real-time mock interview session",
)
@router.post(
    "/{session_id}/start",
    response_model=ApiResponse[InterviewStartResponse],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def start_interview_session(
    session_id: uuid.UUID,
    start_req: Optional[InterviewStartRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Activate interview session, present first question, and generate opening AI interviewer greeting."""
    interview_service = InterviewService(db)
    start_data = interview_service.start_interview_runtime(
        session_id=session_id,
        user_id=current_user.id,
        client_local_time=start_req.client_local_time if start_req else None,
        client_timezone=start_req.client_timezone if start_req else None,
        client_hour=start_req.client_hour if start_req else None,
    )
    return ApiResponse(
        success=True,
        data=start_data,
        message="Interview session started successfully",
    )


@router.post(
    "/sessions/{session_id}/response",
    response_model=ApiResponse[InterviewResponseResult],
    status_code=status.HTTP_200_OK,
    summary="Submit candidate response during interview",
)
@router.post(
    "/{session_id}/response",
    response_model=ApiResponse[InterviewResponseResult],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def submit_interview_response(
    session_id: uuid.UUID,
    resp_in: InterviewResponseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Submit candidate's speech-to-text response and evaluate follow-up or next question."""
    interview_service = InterviewService(db)
    result = interview_service.process_candidate_response(
        session_id=session_id,
        user_id=current_user.id,
        candidate_response=resp_in.candidate_response,
    )
    return ApiResponse(
        success=True,
        data=result,
        message="Candidate response processed successfully",
    )


@router.post(
    "/sessions/{session_id}/next",
    response_model=ApiResponse[InterviewResponseResult],
    status_code=status.HTTP_200_OK,
    summary="Manually advance to next question",
)
@router.post(
    "/{session_id}/next",
    response_model=ApiResponse[InterviewResponseResult],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def advance_next_question(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Advance to the next interview question directly."""
    interview_service = InterviewService(db)
    result = interview_service.advance_to_next_question(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=result,
        message="Advanced to next question",
    )


@router.post(
    "/sessions/{session_id}/pause",
    response_model=ApiResponse[InterviewSessionRead],
    status_code=status.HTTP_200_OK,
    summary="Pause active interview session",
)
@router.post(
    "/{session_id}/pause",
    response_model=ApiResponse[InterviewSessionRead],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def pause_interview(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Pause active interview session."""
    interview_service = InterviewService(db)
    session = interview_service.pause_interview(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=InterviewSessionRead.model_validate(session),
        message="Interview paused",
    )


@router.post(
    "/sessions/{session_id}/resume",
    response_model=ApiResponse[InterviewSessionRead],
    status_code=status.HTTP_200_OK,
    summary="Resume paused interview session",
)
@router.post(
    "/{session_id}/resume",
    response_model=ApiResponse[InterviewSessionRead],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def resume_interview(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Resume paused interview session."""
    interview_service = InterviewService(db)
    session = interview_service.resume_interview(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=InterviewSessionRead.model_validate(session),
        message="Interview resumed",
    )


@router.post(
    "/sessions/{session_id}/end",
    response_model=ApiResponse[InterviewSessionRead],
    status_code=status.HTTP_200_OK,
    summary="End interview session",
)
@router.post(
    "/{session_id}/end",
    response_model=ApiResponse[InterviewSessionRead],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def end_interview(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """End the mock interview and mark status as completed."""
    interview_service = InterviewService(db)
    session = interview_service.end_interview(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=InterviewSessionRead.model_validate(session),
        message="Interview ended and marked as completed",
    )


@router.get(
    "/sessions/{session_id}/runtime",
    response_model=ApiResponse[InterviewRuntimeState],
    status_code=status.HTTP_200_OK,
    summary="Get current interview runtime state and transcripts",
)
@router.get(
    "/{session_id}/runtime",
    response_model=ApiResponse[InterviewRuntimeState],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def get_interview_runtime(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get active interview runtime state."""
    interview_service = InterviewService(db)
    runtime_state = interview_service.get_runtime_state(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=runtime_state,
        message="Runtime state retrieved successfully",
    )


@router.get(
    "/sessions/{session_id}/transcripts",
    response_model=ApiResponse[List[TranscriptRead]],
    status_code=status.HTTP_200_OK,
    summary="Get interview session transcripts",
)
@router.get(
    "/{session_id}/transcripts",
    response_model=ApiResponse[List[TranscriptRead]],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def get_interview_transcripts(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get full dialogue transcript for an interview session."""
    interview_service = InterviewService(db)
    transcripts = interview_service.get_transcripts(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=[TranscriptRead.model_validate(t) for t in transcripts],
        message="Transcripts retrieved successfully",
    )


# ==========================================
# Post-Interview Feedback Endpoints
# ==========================================

@router.get(
    "/sessions/{session_id}/feedback",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Get or generate post-interview feedback report",
)
@router.get(
    "/{session_id}/feedback",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def get_interview_feedback(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve comprehensive 9-section feedback report based on interview evidence."""
    interview_service = InterviewService(db)
    feedback_report = interview_service.get_feedback(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=feedback_report,
        message="Post-interview feedback report retrieved successfully",
    )


@router.post(
    "/sessions/{session_id}/feedback/generate",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Regenerate post-interview feedback report",
)
@router.post(
    "/{session_id}/feedback/generate",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def regenerate_interview_feedback(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Force re-generate feedback report for the session."""
    interview_service = InterviewService(db)
    session = interview_service.get_session(session_id=session_id, user_id=current_user.id)
    # Clear existing feedback to trigger fresh generation
    session.feedback = {}
    db.commit()
    feedback_report = interview_service.get_feedback(
        session_id=session_id, user_id=current_user.id
    )
    return ApiResponse(
        success=True,
        data=feedback_report,
        message="Post-interview feedback report regenerated successfully",
    )

