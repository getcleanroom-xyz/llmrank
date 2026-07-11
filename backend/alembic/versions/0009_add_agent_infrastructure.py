"""Add agent infrastructure: events, DLQ, brand context, rate limits

Revision ID: 0009
Revises: 0008
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("topic", sa.String(50), nullable=False, index=True),
        sa.Column("event_type", sa.String(100), nullable=False, index=True),
        sa.Column("payload", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "agent_failed_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("error", sa.Text(), nullable=False),
        sa.Column("subscription", sa.String(100), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "brand_agent_context",
        sa.Column("brand_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("brands.id"), primary_key=True),
        sa.Column("context", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "agent_rate_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("hour_bucket", sa.DateTime(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "hour_bucket", name="uq_agent_rate_limits_user_hour"),
    )


def downgrade() -> None:
    op.drop_table("agent_rate_limits")
    op.drop_table("brand_agent_context")
    op.drop_table("agent_failed_events")
    op.drop_table("agent_events")
