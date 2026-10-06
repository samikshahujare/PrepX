import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128, description="Plaintext password (min 8 chars)")
    full_name: str = Field(..., min_length=1, max_length=120)


class UserProfileBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    target_domain: Optional[str] = Field(None, max_length=100)
    experience_level: Optional[str] = Field(None, max_length=50)
    bio: Optional[str] = None
    avatar_url: Optional[str] = Field(None, max_length=500)


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    target_domain: Optional[str] = Field(None, max_length=100)
    experience_level: Optional[str] = Field(None, max_length=50)
    bio: Optional[str] = None
    avatar_url: Optional[str] = Field(None, max_length=500)


class UserProfileRead(UserProfileBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserRead(UserBase):
    id: uuid.UUID
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    profile: Optional[UserProfileRead] = None

    model_config = {"from_attributes": True}
