from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.token import LoginRequest, LogoutRequest, RefreshTokenRequest, TokenResponse
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter()


@router.post(
    "/register",
    response_model=ApiResponse[UserRead],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
):
    """Register a new user, create their default profile, and return the user details."""
    auth_service = AuthService(db)
    user = auth_service.register(user_in)
    return ApiResponse(
        success=True,
        data=UserRead.model_validate(user),
        message="User registered successfully",
    )


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Authenticate and receive access and refresh tokens",
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    """Authenticate user with email and password, returning JWT access and refresh tokens."""
    auth_service = AuthService(db)
    tokens = auth_service.login(login_data)
    return ApiResponse(
        success=True,
        data=tokens,
        message="Login successful",
    )


@router.post(
    "/refresh",
    response_model=ApiResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Obtain a new access token using a valid refresh token",
)
def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """Exchange a valid refresh token for a newly minted access token."""
    auth_service = AuthService(db)
    tokens = auth_service.refresh_access_token(refresh_data.refresh_token)
    return ApiResponse(
        success=True,
        data=tokens,
        message="Token refreshed successfully",
    )


@router.post(
    "/logout",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Revoke an active refresh token session",
)
def logout(
    logout_data: LogoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Revoke the given refresh token on server side."""
    auth_service = AuthService(db)
    auth_service.logout(logout_data.refresh_token)
    return ApiResponse(
        success=True,
        data={"revoked": True},
        message="Logged out successfully",
    )
