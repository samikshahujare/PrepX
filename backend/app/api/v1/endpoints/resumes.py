import uuid
from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.resume import ResumeRead
from app.services.resume_service import ResumeService

router = APIRouter()


@router.post(
    "/upload",
    response_model=ApiResponse[ResumeRead],
    status_code=status.HTTP_201_CREATED,
    summary="Upload and parse candidate resume (PDF or DOCX)",
)
async def upload_resume(
    file: UploadFile = File(..., description="PDF or DOCX resume document (max 10MB)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Upload a resume file, extract plain text, parse candidate profile entities, and persist."""
    resume_service = ResumeService(db)
    resume = await resume_service.upload_and_parse(user_id=current_user.id, file=file)
    return ApiResponse(
        success=True,
        data=ResumeRead.model_validate(resume),
        message="Resume uploaded and parsed successfully",
    )


@router.get(
    "",
    response_model=ApiResponse[List[ResumeRead]],
    status_code=status.HTTP_200_OK,
    summary="List all uploaded resumes for the current user",
)
def list_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve all resumes uploaded by the authenticated user."""
    resume_service = ResumeService(db)
    resumes = resume_service.list_resumes(user_id=current_user.id)
    return ApiResponse(
        success=True,
        data=[ResumeRead.model_validate(r) for r in resumes],
        message="Resumes retrieved successfully",
    )


@router.get(
    "/{resume_id}",
    response_model=ApiResponse[ResumeRead],
    status_code=status.HTTP_200_OK,
    summary="Get resume details and parsed profile by ID",
)
def get_resume(
    resume_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve a specific resume and its extracted profile."""
    resume_service = ResumeService(db)
    resume = resume_service.get_resume(resume_id=resume_id, user_id=current_user.id)
    return ApiResponse(
        success=True,
        data=ResumeRead.model_validate(resume),
        message="Resume retrieved successfully",
    )
