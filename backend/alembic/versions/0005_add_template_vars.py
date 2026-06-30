"""Add template_vars column to campaigns

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("template_vars", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("campaigns", "template_vars")
