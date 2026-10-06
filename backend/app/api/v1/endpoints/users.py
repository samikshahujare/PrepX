from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.user import UserProfileRead, UserProfileUpdate, UserRead
from app.services.user_service import UserService

router = APIRouter()


@router.get(
    "/me",
    response_model=ApiResponse[UserRead],
    status_code=status.HTTP_200_OK,
    summary="Get current user account and profile",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve details of the currently authenticated user."""
    return ApiResponse(
        success=True,
        data=UserRead.model_validate(current_user),
        message="User profile retrieved successfully",
    )


@router.put(
    "/me/profile",
    response_model=ApiResponse[UserProfileRead],
    status_code=status.HTTP_200_OK,
    summary="Update current user's profile details",
)
def update_current_user_profile(
    profile_in: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update profile information (full_name, target_domain, experience_level, bio, avatar_url)."""
    user_service = UserService(db)
    updated_profile = user_service.update_profile(current_user.id, profile_in)
    return ApiResponse(
        success=True,
        data=UserProfileRead.model_validate(updated_profile),
        message="Profile updated successfully",
    )
