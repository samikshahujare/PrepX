import uuid
from sqlalchemy.orm import Session
from app.core import security
from app.core.exceptions import (
    InvalidCredentialsException,
    InvalidTokenException,
    InactiveUserException,
    UserAlreadyExistsException,
)
from app.models.user import User
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.token import LoginRequest, TokenResponse
from app.schemas.user import UserCreate


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.token_repo = TokenRepository(db)

    def register(self, user_in: UserCreate) -> User:
        existing_user = self.user_repo.get_by_email(user_in.email)
        if existing_user:
            raise UserAlreadyExistsException()

        hashed_password = security.get_password_hash(user_in.password)
        return self.user_repo.create(user_in, hashed_password)

    def login(self, login_data: LoginRequest) -> TokenResponse:
        user = self.user_repo.get_by_email(login_data.email)
        if not user or not security.verify_password(login_data.password, user.password_hash):
            raise InvalidCredentialsException()

        if not user.is_active:
            raise InactiveUserException()

        access_token = security.create_access_token(subject=user.id)
        refresh_token, expires_at = security.create_refresh_token(subject=user.id)

        # Store hashed refresh token in DB
        hashed_rf_token = security.hash_token(refresh_token)
        self.token_repo.save_refresh_token(
            user_id=user.id,
            token_hash=hashed_rf_token,
            expires_at=expires_at,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )

    def refresh_access_token(self, refresh_token_str: str) -> TokenResponse:
        payload = security.decode_token(refresh_token_str)
        if not payload or payload.get("type") != "refresh":
            raise InvalidTokenException("Invalid refresh token")

        token_hash = security.hash_token(refresh_token_str)
        db_token = self.token_repo.get_valid_refresh_token(token_hash)
        if not db_token:
            raise InvalidTokenException("Refresh token has expired or been revoked")

        user = self.user_repo.get_by_id(db_token.user_id)
        if not user or not user.is_active:
            raise InactiveUserException()

        # Generate new access token
        new_access_token = security.create_access_token(subject=user.id)
        return TokenResponse(
            access_token=new_access_token,
            refresh_token=refresh_token_str,
            token_type="bearer",
        )

    def logout(self, refresh_token_str: str) -> None:
        token_hash = security.hash_token(refresh_token_str)
        self.token_repo.revoke_token(token_hash)
