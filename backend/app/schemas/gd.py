import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GDSessionCreate(BaseModel):
    topic: str = Field(..., min_length=5, max_length=255, description="Discussion topic")
    topic_category: str = Field(default="Technology & AI", max_length=100)
    topic_context: Optional[str] = Field(default=None, description="Optional JD or role context")
    duration_minutes: int = Field(default=15, ge=5, le=60)
    max_participants: int = Field(default=6, ge=2, le=12)


class GDTopicGenerateRequest(BaseModel):
    category: str = Field(default="Technology & AI")
    role_context: Optional[str] = None
    company: Optional[str] = None


class GDTopicGenerateResponse(BaseModel):
    topic: str
    category: str
    briefing: str
    key_perspectives: List[str] = []


class GDParticipantResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    guest_id: Optional[str] = None
    display_name: str
    is_host: bool
    is_muted: bool
    joined_at: datetime
    left_at: Optional[datetime] = None
    session_code: Optional[str] = None

    class Config:
        from_attributes = True


class GDInvitationResponse(BaseModel):
    token: str
    join_url: str
    whatsapp_share_url: str
    email_share_subject: str
    email_share_body: str
    expires_at: datetime
    is_public: bool = False

    class Config:
        from_attributes = True


class GDSessionResponse(BaseModel):
    id: uuid.UUID
    session_code: str
    creator_id: uuid.UUID
    topic: str
    topic_category: str
    topic_context: Optional[str] = None
    duration_minutes: int
    max_participants: int
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    participants: List[GDParticipantResponse] = []

    class Config:
        from_attributes = True


class GDJoinRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=100)
    guest_id: Optional[str] = None


class GDTranscriptCreate(BaseModel):
    participant_id: Optional[uuid.UUID] = None
    speaker_name: str
    is_moderator: bool = False
    message: str
    timestamp_seconds: float = 0.0
    sequence_number: int = 1


class GDTranscriptResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    participant_id: Optional[uuid.UUID] = None
    speaker_name: str
    is_moderator: bool
    message: str
    timestamp_seconds: float
    sequence_number: int
    created_at: datetime

    class Config:
        from_attributes = True


class GDEvaluationResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    participant_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    overall_score: float
    category_scores: Dict[str, float]
    strengths: List[str]
    areas_for_improvement: List[str]
    communication_feedback: str
    reasoning_feedback: str
    listening_feedback: str
    missed_opportunities: List[str]
    example_strong_response: str
    personalized_plan: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
