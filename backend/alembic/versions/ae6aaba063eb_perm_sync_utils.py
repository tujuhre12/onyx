"""perm-sync-utils

Revision ID: ae6aaba063eb
Revises: cec7ec36c505
Create Date: 2025-06-11 22:18:31.061655

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "ae6aaba063eb"
down_revision = "cec7ec36c505"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "document",
        sa.Column("last_perm_synced", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_document_last_perm_synced"),
        "document",
        ["last_perm_synced"],
        unique=False,
    )

    op.create_table(
        "document_structure",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("connector_credential_pair", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.String(), nullable=True),
        sa.Column("parent", sa.String(), nullable=True),
        sa.Column("external_user_emails", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column(
            "external_user_group_ids", postgresql.ARRAY(sa.String()), nullable=True
        ),
        sa.Column("is_public", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(
            ["connector_credential_pair"],
            ["connector_credential_pair.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["document_id"], ["document.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["parent"], ["document_structure.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id"),
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_document_last_perm_synced"), table_name="document")
    op.drop_column("document", "last_perm_synced")
    op.drop_table("document_structure")
