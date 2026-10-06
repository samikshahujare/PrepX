import uuid
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core import security
from app.core.config import settings
from app.core.exceptions import (
    InactiveUserException,
    InvalidTokenException,
    UserNotFoundException,
)
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Dependency that decodes access token and retrieves active user."""
    payload = security.decode_token(token)
    if not payload:
        raise InvalidTokenException("Could not validate credentials")

    token_type = payload.get("type")
    if token_type != "access":
        raise InvalidTokenException("Invalid token type")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise InvalidTokenException("Token subject missing")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise InvalidTokenException("Malformed user identifier in token")

    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user:
        raise UserNotFoundException()

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure that the authenticated user account is active."""
    if not current_user.is_active:
        raise InactiveUserException()
    return current_user
