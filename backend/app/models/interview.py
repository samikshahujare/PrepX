import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.session import Base

JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    domain = Column(String(100), nullable=False)
    company = Column(String(150), nullable=True)
    job_description = Column(Text, nullable=True)
    jd_analysis = Column(JSON_TYPE, nullable=False, default=dict)
    company_research = Column(JSON_TYPE, nullable=False, default=dict)
    target_role = Column(String(150), nullable=True)
    interview_mode = Column(String(50), default="Role-Specific", nullable=False)  # Company-Specific, Role-Specific
    duration_minutes = Column(Integer, default=30, nullable=False)
    allowed_attempts = Column(Integer, default=1, nullable=False)
    current_attempt = Column(Integer, default=1, nullable=False)
    difficulty = Column(String(20), nullable=False)  # Low, Medium, High
    status = Column(String(50), default="ready", nullable=False)  # setup, ready, in_progress, completed
    interview_status = Column(String(50), default="idle", nullable=False)  # idle, preparing, active, listening, processing, speaking, paused, completed, error
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    total_paused_seconds = Column(Integer, default=0, nullable=False)
    feedback = Column(JSON_TYPE, nullable=False, default=dict)
    topic_coverage = Column(JSON_TYPE, nullable=False, default=dict)
    current_question_index = Column(Integer, default=0, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="interview_sessions")
    resume = relationship("Resume", back_populates="sessions")
    questions = relationship(
        "Question",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Question.sequence_number",
    )
    transcripts = relationship(
        "InterviewTranscript",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="InterviewTranscript.sequence_number",
    )


class Question(Base):
    __tablename__ = "questions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_text = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # Resume, Technical, Behavioral, Domain, Company
    difficulty = Column(String(20), nullable=False) # Low, Medium, High
    source = Column(String(50), default="mock", nullable=False) # mock, gemini, openai
    sequence_number = Column(Integer, nullable=False, default=1)
    is_asked = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    session = relationship("InterviewSession", back_populates="questions")
    transcripts = relationship("InterviewTranscript", back_populates="question")


class InterviewTranscript(Base):
    __tablename__ = "interview_transcripts"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    speaker = Column(String(20), nullable=False)  # interviewer, candidate, system
    message = Column(Text, nullable=False)
    sequence_number = Column(Integer, nullable=False, default=1)
    is_followup = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    session = relationship("InterviewSession", back_populates="transcripts")
    question = relationship("Question", back_populates="transcripts")
