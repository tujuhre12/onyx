"""add user files

Revision ID: 9aadf32dfeb4
Revises: f1ca58b2f2ec
Create Date: 2025-01-26 16:08:21.551022

"""
from alembic import op
import sqlalchemy as sa
import datetime


# revision identifiers, used by Alembic.
revision = "9aadf32dfeb4"
down_revision = "f1ca58b2f2ec"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create user_folder table with additional 'display_priority' field
    op.create_table(
        "user_folder",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("user.id"), nullable=True),
        sa.Column(
            "parent_id", sa.Integer(), sa.ForeignKey("user_folder.id"), nullable=True
        ),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("display_priority", sa.Integer(), nullable=True, default=0),
        sa.Column("created_at", sa.DateTime(), default=datetime.datetime.utcnow),
    )

    # Create user_file table
    op.create_table(
        "user_file",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("user.id"), nullable=True),
        sa.Column(
            "parent_folder_id",
            sa.Integer(),
            sa.ForeignKey("user_folder.id"),
            nullable=True,
        ),
        sa.Column("file_type", sa.String(), nullable=True),
        sa.Column("file_id", sa.String(length=255), nullable=False),
        sa.Column("document_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            default=datetime.datetime.utcnow,
        ),
    )


def downgrade() -> None:
    # Drop the user_file table
    op.drop_table("user_file")
    # Drop the user_folder table
    op.drop_table("user_folder")
