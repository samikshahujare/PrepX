"""Duration deadline tracking and feedback report columns

Revision ID: 005_duration_deadline_feedback
Revises: 004_prep_jd_settings
Create Date: 2026-10-12 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "005_duration_deadline_feedback"
down_revision: Union[str, None] = "004_prep_jd_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add authoritative deadline and paused duration tracking
    op.add_column(
        "interview_sessions",
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("total_paused_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    # Add structured post-interview feedback and dynamic topic coverage
    op.add_column(
        "interview_sessions",
        sa.Column("feedback", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )
    op.add_column(
        "interview_sessions",
        sa.Column("topic_coverage", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("interview_sessions", "topic_coverage")
    op.drop_column("interview_sessions", "feedback")
    op.drop_column("interview_sessions", "total_paused_seconds")
    op.drop_column("interview_sessions", "paused_at")
