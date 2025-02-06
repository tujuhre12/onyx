"""rename pro search to agent search

Revision ID: 1738864717
Revises: 4505fd7302e1
Create Date: 2024-02-06 17:45:17.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1738864717'
down_revision = '4505fd7302e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename column while preserving data
    op.alter_column(
        "settings",
        "pro_search_disabled",
        new_column_name="agent_search_disabled",
        existing_type=sa.Boolean(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "settings",
        "agent_search_disabled",
        new_column_name="pro_search_disabled",
        existing_type=sa.Boolean(),
        existing_nullable=True,
    )
