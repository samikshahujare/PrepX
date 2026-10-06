from typing import Any, Optional
from fastapi import HTTPException, status


class PrepXException(HTTPException):
    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str = "ERROR",
        headers: Optional[dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code


class UserAlreadyExistsException(PrepXException):
    def __init__(self, detail: str = "A user with this email already exists"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            code="USER_ALREADY_EXISTS",
        )


class InvalidCredentialsException(PrepXException):
    def __init__(self, detail: str = "Incorrect email or password"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            code="INVALID_CREDENTIALS",
            headers={"WWW-Authenticate": "Bearer"},
        )


class InactiveUserException(PrepXException):
    def __init__(self, detail: str = "User account is inactive"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="INACTIVE_USER",
        )


class InvalidTokenException(PrepXException):
    def __init__(self, detail: str = "Invalid or expired token"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            code="INVALID_TOKEN",
            headers={"WWW-Authenticate": "Bearer"},
        )


class UserNotFoundException(PrepXException):
    def __init__(self, detail: str = "User not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            code="USER_NOT_FOUND",
        )
