"""Interview preparation JD and settings

Revision ID: 004_prep_jd_settings
Revises: 003_phase3_interview_runtime
Create Date: 2026-09-29 16:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "004_prep_jd_settings"
down_revision: Union[str, None] = "003_phase3_interview_runtime"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add JD and interview configuration columns to interview_sessions
    op.add_column(
        "interview_sessions",
        sa.Column("job_description", sa.Text(), nullable=True),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("jd_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("company_research", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("target_role", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("interview_mode", sa.String(length=50), nullable=False, server_default="Role-Specific"),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="30"),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("allowed_attempts", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("current_attempt", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("interview_sessions", "current_attempt")
    op.drop_column("interview_sessions", "allowed_attempts")
    op.drop_column("interview_sessions", "duration_minutes")
    op.drop_column("interview_sessions", "interview_mode")
    op.drop_column("interview_sessions", "target_role")
    op.drop_column("interview_sessions", "company_research")
    op.drop_column("interview_sessions", "jd_analysis")
    op.drop_column("interview_sessions", "job_description")
