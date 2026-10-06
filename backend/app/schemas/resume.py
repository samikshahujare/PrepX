import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ResumeProfileRead(BaseModel):
    id: uuid.UUID
    resume_id: uuid.UUID
    candidate_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    education: List[str] = Field(default_factory=list)
    experience: List[str] = Field(default_factory=list)
    projects: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    raw_extracted_data: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResumeRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    original_filename: str
    file_type: str
    file_size: int
    storage_path: str
    extracted_text: Optional[str] = None
    upload_status: str
    created_at: datetime
    updated_at: datetime
    profile: Optional[ResumeProfileRead] = None

    model_config = {"from_attributes": True}
