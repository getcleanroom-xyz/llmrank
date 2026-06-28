"""Add credit wallet and transactions tables

Revision ID: 0002
Revises: 0001_initial_schema
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credit_wallets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(100), unique=True, nullable=False, server_default="default"),
        sa.Column("balance", sa.Integer, nullable=False, server_default="500"),
        sa.Column("total_purchased", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_used", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "credit_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(100), nullable=False, server_default="default"),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Upsert default wallet — update balance if wallet exists, create if not
    op.execute(
        "INSERT INTO credit_wallets (id, user_id, balance, total_purchased, total_used, created_at, updated_at) "
        "VALUES (gen_random_uuid(), 'default', 500, 0, 0, NOW(), NOW()) "
        "ON CONFLICT (user_id) DO UPDATE SET balance = GREATEST(credit_wallets.balance, 500), updated_at = NOW()"
    )


def downgrade() -> None:
    op.drop_table("credit_transactions")
    op.drop_table("credit_wallets")
