"""remove recent assistants

Revision ID: a6df6b88ef81
Revises: f1ca58b2f2ec
Create Date: 2025-01-29 10:25:52.790407

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a6df6b88ef81"
down_revision = "f1ca58b2f2ec"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("user", "recent_assistants")


def downgrade() -> None:
    op.add_column(
        "user",
        sa.Column(
            "recent_assistants", postgresql.JSONB(), server_default="[]", nullable=False
        ),
    )
