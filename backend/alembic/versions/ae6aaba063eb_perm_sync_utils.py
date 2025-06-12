"""perm-sync-utils

Revision ID: ae6aaba063eb
Revises: cec7ec36c505
Create Date: 2025-06-11 22:18:31.061655

"""

from alembic import op
import sqlalchemy as sa


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

    # set parent to channel name for slack docs
    op.add_column(
        "document",
        sa.Column("parent", sa.String(), nullable=True),
    )
    op.execute(
        """
        WITH slack_docs AS(
            SELECT cc_pair.id
            FROM document_by_connector_credential_pair AS cc_pair
            JOIN connector ON cc_pair.connector_id = connector.id
            WHERE connector.source = 'SLACK'
        )
        UPDATE document
        SET parent = tag.tag_value
        FROM slack_docs
        JOIN document__tag ON slack_docs.id = document__tag.document_id
        JOIN tag ON document__tag.tag_id = tag.id
        WHERE
            document.id = slack_docs.id AND
            tag.tag_key = 'Channel'
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_document_last_perm_synced"), table_name="document")
    op.drop_column("document", "last_perm_synced")
    op.drop_column("document", "parent")
