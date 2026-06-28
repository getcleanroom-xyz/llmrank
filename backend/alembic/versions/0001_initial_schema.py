"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "brands",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("domain", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "monitored_queries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brand_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brand_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "running", "completed", "failed", name="scanstatus"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("visibility_score", sa.Float(), nullable=True),
        sa.Column("mention_rate", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "query_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("query_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("llm_name", sa.String(50), nullable=False),
        sa.Column("raw_response", sa.Text(), nullable=False),
        sa.Column("mentioned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column(
            "sentiment",
            sa.Enum("positive", "neutral", "negative", "not_mentioned", name="sentiment"),
            nullable=False,
        ),
        sa.Column("competitors_mentioned", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("annotated_response", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["query_id"], ["monitored_queries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("query_results")
    op.drop_table("scans")
    op.drop_table("monitored_queries")
    op.drop_table("brands")
    op.execute("DROP TYPE IF EXISTS scanstatus")
    op.execute("DROP TYPE IF EXISTS sentiment")
