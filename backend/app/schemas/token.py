import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
    type: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, description="The JWT refresh token string")


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, description="The JWT refresh token to revoke")
