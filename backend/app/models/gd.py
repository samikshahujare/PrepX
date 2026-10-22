import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.session import Base

JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class GDSession(Base):
    __tablename__ = "gd_sessions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    session_code = Column(String(32), unique=True, nullable=False, index=True)
    creator_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic = Column(String(255), nullable=False)
    topic_category = Column(String(100), nullable=False, default="Technology & AI")
    topic_context = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=15, nullable=False)
    max_participants = Column(Integer, default=6, nullable=False)
    status = Column(
        String(30),
        default="waiting_for_participants",
        nullable=False,
        index=True,
    )  # created, waiting_for_participants, in_progress, completed, cancelled
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
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
    creator = relationship("User", foreign_keys=[creator_id])
    participants = relationship(
        "GDParticipant",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="GDParticipant.joined_at",
    )
    invitations = relationship(
        "GDInvitationToken",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    transcripts = relationship(
        "GDTranscript",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="GDTranscript.sequence_number",
    )
    evaluations = relationship(
        "GDEvaluation",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class GDParticipant(Base):
    __tablename__ = "gd_participants"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("gd_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    guest_id = Column(String(100), nullable=True, index=True)
    display_name = Column(String(120), nullable=False)
    is_host = Column(Boolean, default=False, nullable=False)
    is_muted = Column(Boolean, default=False, nullable=False)
    joined_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    left_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    session = relationship("GDSession", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])
    transcripts = relationship("GDTranscript", back_populates="participant")
    evaluations = relationship("GDEvaluation", back_populates="participant")


class GDInvitationToken(Base):
    __tablename__ = "gd_invitation_tokens"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("gd_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    session = relationship("GDSession", back_populates="invitations")


class GDTranscript(Base):
    __tablename__ = "gd_transcripts"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("gd_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    participant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("gd_participants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    speaker_name = Column(String(120), nullable=False)
    is_moderator = Column(Boolean, default=False, nullable=False)
    message = Column(Text, nullable=False)
    timestamp_seconds = Column(Float, default=0.0, nullable=False)
    sequence_number = Column(Integer, default=1, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    session = relationship("GDSession", back_populates="transcripts")
    participant = relationship("GDParticipant", back_populates="transcripts")


class GDEvaluation(Base):
    __tablename__ = "gd_evaluations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("gd_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    participant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("gd_participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    overall_score = Column(Float, nullable=False)
    category_scores = Column(JSON_TYPE, nullable=False, default=dict)
    strengths = Column(JSON_TYPE, nullable=False, default=list)
    areas_for_improvement = Column(JSON_TYPE, nullable=False, default=list)
    communication_feedback = Column(Text, nullable=False)
    reasoning_feedback = Column(Text, nullable=False)
    listening_feedback = Column(Text, nullable=False)
    missed_opportunities = Column(JSON_TYPE, nullable=False, default=list)
    example_strong_response = Column(Text, nullable=False)
    personalized_plan = Column(JSON_TYPE, nullable=False, default=dict)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    session = relationship("GDSession", back_populates="evaluations")
    participant = relationship("GDParticipant", back_populates="evaluations")
    user = relationship("User", foreign_keys=[user_id])
