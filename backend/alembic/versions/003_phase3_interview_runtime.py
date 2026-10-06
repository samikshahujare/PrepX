"""Phase 3 interview runtime state and transcripts tables

Revision ID: 003_phase3_interview_runtime
Revises: 002_phase2_resumes_interviews
Create Date: 2026-09-27 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003_phase3_interview_runtime"
down_revision: Union[str, None] = "002_phase2_resumes_interviews"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add runtime state columns to interview_sessions
    op.add_column(
        "interview_sessions",
        sa.Column("interview_status", sa.String(length=50), nullable=False, server_default="idle"),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("current_question_index", sa.Integer(), nullable=False, server_default="0"),
    )

    # 2. Add is_asked column to questions
    op.add_column(
        "questions",
        sa.Column("is_asked", sa.Boolean(), nullable=False, server_default="false"),
    )

    # 3. Create interview_transcripts table
    op.create_table(
        "interview_transcripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("speaker", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_followup", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["session_id"], ["interview_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_interview_transcripts_id", "interview_transcripts", ["id"], unique=False)
    op.create_index("ix_interview_transcripts_session_id", "interview_transcripts", ["session_id"], unique=False)
    op.create_index("ix_interview_transcripts_question_id", "interview_transcripts", ["question_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_interview_transcripts_question_id", table_name="interview_transcripts")
    op.drop_index("ix_interview_transcripts_session_id", table_name="interview_transcripts")
    op.drop_index("ix_interview_transcripts_id", table_name="interview_transcripts")
    op.drop_table("interview_transcripts")

    op.drop_column("questions", "is_asked")

    op.drop_column("interview_sessions", "current_question_index")
    op.drop_column("interview_sessions", "ended_at")
    op.drop_column("interview_sessions", "started_at")
    op.drop_column("interview_sessions", "interview_status")
