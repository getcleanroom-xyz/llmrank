"""Add competitors to Brand, query_type and query_score to MonitoredQuery

Revision ID: 0007
Revises: 0006
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("brands", sa.Column("competitors", postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column("monitored_queries", sa.Column("query_type", sa.String(20), nullable=True))
    op.add_column("monitored_queries", sa.Column("query_score", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("monitored_queries", "query_score")
    op.drop_column("monitored_queries", "query_type")
    op.drop_column("brands", "competitors")
