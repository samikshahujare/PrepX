"""Group discussion sessions, participants, invitations, transcripts, and evaluations

Revision ID: 006_group_discussion_module
Revises: 005_duration_deadline_feedback
Create Date: 2026-10-19 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "006_group_discussion_module"
down_revision: Union[str, None] = "005_duration_deadline_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. gd_sessions
    op.create_table(
        "gd_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_code", sa.String(length=32), nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("topic_category", sa.String(length=100), nullable=False, server_default="Technology & AI"),
        sa.Column("topic_context", sa.Text(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("max_participants", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="waiting_for_participants"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_gd_sessions_id"), "gd_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_gd_sessions_session_code"), "gd_sessions", ["session_code"], unique=True)
    op.create_index(op.f("ix_gd_sessions_creator_id"), "gd_sessions", ["creator_id"], unique=False)
    op.create_index(op.f("ix_gd_sessions_status"), "gd_sessions", ["status"], unique=False)

    # 2. gd_participants
    op.create_table(
        "gd_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gd_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("guest_id", sa.String(length=100), nullable=True),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("is_host", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_muted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_gd_participants_id"), "gd_participants", ["id"], unique=False)
    op.create_index(op.f("ix_gd_participants_session_id"), "gd_participants", ["session_id"], unique=False)
    op.create_index(op.f("ix_gd_participants_user_id"), "gd_participants", ["user_id"], unique=False)
    op.create_index(op.f("ix_gd_participants_guest_id"), "gd_participants", ["guest_id"], unique=False)

    # 3. gd_invitation_tokens
    op.create_table(
        "gd_invitation_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gd_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_gd_invitation_tokens_id"), "gd_invitation_tokens", ["id"], unique=False)
    op.create_index(op.f("ix_gd_invitation_tokens_session_id"), "gd_invitation_tokens", ["session_id"], unique=False)
    op.create_index(op.f("ix_gd_invitation_tokens_token"), "gd_invitation_tokens", ["token"], unique=True)

    # 4. gd_transcripts
    op.create_table(
        "gd_transcripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gd_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("participant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gd_participants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("speaker_name", sa.String(length=120), nullable=False),
        sa.Column("is_moderator", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("timestamp_seconds", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("sequence_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_gd_transcripts_id"), "gd_transcripts", ["id"], unique=False)
    op.create_index(op.f("ix_gd_transcripts_session_id"), "gd_transcripts", ["session_id"], unique=False)
    op.create_index(op.f("ix_gd_transcripts_participant_id"), "gd_transcripts", ["participant_id"], unique=False)

    # 5. gd_evaluations
    op.create_table(
        "gd_evaluations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gd_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("participant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gd_participants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("category_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("strengths", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("areas_for_improvement", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("communication_feedback", sa.Text(), nullable=False),
        sa.Column("reasoning_feedback", sa.Text(), nullable=False),
        sa.Column("listening_feedback", sa.Text(), nullable=False),
        sa.Column("missed_opportunities", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("example_strong_response", sa.Text(), nullable=False),
        sa.Column("personalized_plan", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_gd_evaluations_id"), "gd_evaluations", ["id"], unique=False)
    op.create_index(op.f("ix_gd_evaluations_session_id"), "gd_evaluations", ["session_id"], unique=False)
    op.create_index(op.f("ix_gd_evaluations_participant_id"), "gd_evaluations", ["participant_id"], unique=False)
    op.create_index(op.f("ix_gd_evaluations_user_id"), "gd_evaluations", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("gd_evaluations")
    op.drop_table("gd_transcripts")
    op.drop_table("gd_invitation_tokens")
    op.drop_table("gd_participants")
    op.drop_table("gd_sessions")
