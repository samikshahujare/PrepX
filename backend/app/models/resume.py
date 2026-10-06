import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base


class Resume(Base):
    __tablename__ = "resumes"

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
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx
    file_size = Column(Integer, nullable=False)      # bytes
    storage_path = Column(String(500), nullable=False)
    extracted_text = Column(Text, nullable=True)
    upload_status = Column(String(50), default="uploaded", nullable=False)  # uploaded, parsed, failed
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
    user = relationship("User", back_populates="resumes")
    profile = relationship("ResumeProfile", back_populates="resume", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("InterviewSession", back_populates="resume", cascade="all, delete-orphan")


class ResumeProfile(Base):
    __tablename__ = "resume_profiles"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    candidate_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(100), nullable=True)
    skills = Column(JSON, default=list, nullable=False)
    education = Column(JSON, default=list, nullable=False)
    experience = Column(JSON, default=list, nullable=False)
    projects = Column(JSON, default=list, nullable=False)
    certifications = Column(JSON, default=list, nullable=False)
    raw_extracted_data = Column(JSON, default=dict, nullable=False)
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
    resume = relationship("Resume", back_populates="profile")
