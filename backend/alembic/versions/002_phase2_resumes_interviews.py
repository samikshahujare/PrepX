"""Phase 2 resume and interview tables (resumes, resume_profiles, interview_sessions, questions)

Revision ID: 002_phase2_resumes_interviews
Revises: 001_initial_auth_tables
Create Date: 2026-09-27 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002_phase2_resumes_interviews"
down_revision: Union[str, None] = "001_initial_auth_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create resumes table
    op.create_table(
        "resumes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=50), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("upload_status", sa.String(length=50), nullable=False, server_default="uploaded"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_resumes_id", "resumes", ["id"], unique=False)
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"], unique=False)

    # 2. Create resume_profiles table
    op.create_table(
        "resume_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("resume_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=100), nullable=True),
        sa.Column("skills", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("education", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("experience", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("projects", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("certifications", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("raw_extracted_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("resume_id"),
    )
    op.create_index("ix_resume_profiles_id", "resume_profiles", ["id"], unique=False)
    op.create_index("ix_resume_profiles_resume_id", "resume_profiles", ["resume_id"], unique=True)

    # 3. Create interview_sessions table
    op.create_table(
        "interview_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resume_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("domain", sa.String(length=100), nullable=False),
        sa.Column("company", sa.String(length=150), nullable=True),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="ready"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_interview_sessions_id", "interview_sessions", ["id"], unique=False)
    op.create_index("ix_interview_sessions_user_id", "interview_sessions", ["user_id"], unique=False)
    op.create_index("ix_interview_sessions_resume_id", "interview_sessions", ["resume_id"], unique=False)

    # 4. Create questions table
    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="mock"),
        sa.Column("sequence_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["session_id"], ["interview_sessions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_questions_id", "questions", ["id"], unique=False)
    op.create_index("ix_questions_session_id", "questions", ["session_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_questions_session_id", table_name="questions")
    op.drop_index("ix_questions_id", table_name="questions")
    op.drop_table("questions")

    op.drop_index("ix_interview_sessions_resume_id", table_name="interview_sessions")
    op.drop_index("ix_interview_sessions_user_id", table_name="interview_sessions")
    op.drop_index("ix_interview_sessions_id", table_name="interview_sessions")
    op.drop_table("interview_sessions")

    op.drop_index("ix_resume_profiles_resume_id", table_name="resume_profiles")
    op.drop_index("ix_resume_profiles_id", table_name="resume_profiles")
    op.drop_table("resume_profiles")

    op.drop_index("ix_resumes_user_id", table_name="resumes")
    op.drop_index("ix_resumes_id", table_name="resumes")
    op.drop_table("resumes")
