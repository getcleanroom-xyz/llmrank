"""Add users, passkeys, and update brand/credit tables for auth

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Create passkeys table
    op.create_table(
        "passkeys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("credential_id", sa.Text(), unique=True, nullable=False),
        sa.Column("credential_public_key", sa.Text(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transports", sa.JSON(), nullable=True),
        sa.Column("device_name", sa.String(200), nullable=False, server_default="Unknown device"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Add owner_id to brands table
    op.add_column("brands", sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))

    # Update credit_wallets to use UUID user_id (nullable for migration)
    op.add_column("credit_wallets", sa.Column("user_id_new", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))

    # Migrate existing data: create a default user and link existing wallet
    op.execute("""
        INSERT INTO users (id, email, display_name, created_at)
        VALUES ('00000000-0000-0000-0000-000000000001', 'default@llmrank.local', 'Default User', NOW())
        ON CONFLICT DO NOTHING
    """)

    op.execute("""
        UPDATE credit_wallets
        SET user_id_new = '00000000-0000-0000-0000-000000000001'
        WHERE user_id = 'default'
    """)

    # Update credit_transactions to use UUID user_id
    op.add_column("credit_transactions", sa.Column("user_id_new", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))

    op.execute("""
        UPDATE credit_transactions
        SET user_id_new = '00000000-0000-0000-0000-000000000001'
        WHERE user_id = 'default'
    """)

    # Assign existing brands to default user
    op.execute("""
        UPDATE brands
        SET owner_id = '00000000-0000-0000-0000-000000000001'
        WHERE owner_id IS NULL
    """)

    # Drop old columns and rename new ones
    op.drop_column("credit_wallets", "user_id")
    op.alter_column("credit_wallets", "user_id_new", new_column_name="user_id", nullable=False)
    op.create_unique_constraint("uq_credit_wallets_user_id", "credit_wallets", ["user_id"])

    op.drop_column("credit_transactions", "user_id")
    op.alter_column("credit_transactions", "user_id_new", new_column_name="user_id", nullable=False)


def downgrade() -> None:
    op.drop_table("passkeys")
    op.drop_table("users")
    op.drop_column("brands", "owner_id")
    op.drop_constraint("uq_credit_wallets_user_id", "credit_wallets")
    op.drop_column("credit_wallets", "user_id")
    op.add_column("credit_wallets", sa.Column("user_id", sa.String(100), nullable=False, server_default="default"))
    op.drop_column("credit_transactions", "user_id")
    op.add_column("credit_transactions", sa.Column("user_id", sa.String(100), nullable=False, server_default="default"))
