"""max_length_for_instruction_system_prompt

Revision ID: e995bdf0d6f7
Revises: 8e1ac4f39a9f
Create Date: 2025-04-01 18:32:45.123456

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e995bdf0d6f7"
down_revision = "8e1ac4f39a9f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Alter system_prompt and task_prompt columns to have a maximum length of 8000 characters
    op.alter_column(
        "prompt",
        "system_prompt",
        existing_type=sa.Text(),
        type_=sa.String(8000),
        existing_nullable=False,
    )
    op.alter_column(
        "prompt",
        "task_prompt",
        existing_type=sa.Text(),
        type_=sa.String(8000),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Revert system_prompt and task_prompt columns back to Text type
    op.alter_column(
        "prompt",
        "system_prompt",
        existing_type=sa.String(8000),
        type_=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "prompt",
        "task_prompt",
        existing_type=sa.String(8000),
        type_=sa.Text(),
        existing_nullable=False,
    )
