"""Add campaign tables for admin marketing emails

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("html_body", sa.Text(), nullable=False),
        sa.Column("from_email", sa.String(255), nullable=False),
        sa.Column("audience_type", sa.Enum("all_users", "segment", "upload", name="audiencetype"), nullable=False),
        sa.Column("audience_config", sa.JSON(), nullable=True),
        sa.Column("status", sa.Enum("draft", "scheduled", "sending", "sent", "cancelled", name="campaignstatus"), nullable=False, server_default="draft"),
        sa.Column("schedule_type", sa.Enum("now", "once", "recurring", name="scheduletype"), nullable=False, server_default="now"),
        sa.Column("cron_expr", sa.String(100), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("last_sent_at", sa.DateTime(), nullable=True),
        sa.Column("next_send_at", sa.DateTime(), nullable=True),
        sa.Column("total_recipients", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("opened_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicked_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "campaign_recipients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.Enum("pending", "sent", "failed", "opened", "clicked", name="recipientstatus"), nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("opened_at", sa.DateTime(), nullable=True),
        sa.Column("clicked_at", sa.DateTime(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "campaign_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("original_url", sa.Text(), nullable=False),
        sa.Column("redirect_path", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("click_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("campaign_links")
    op.drop_table("campaign_recipients")
    op.drop_table("campaigns")
    op.execute("DROP TYPE IF EXISTS audiencetype")
    op.execute("DROP TYPE IF EXISTS campaignstatus")
    op.execute("DROP TYPE IF EXISTS scheduletype")
    op.execute("DROP TYPE IF EXISTS recipientstatus")
