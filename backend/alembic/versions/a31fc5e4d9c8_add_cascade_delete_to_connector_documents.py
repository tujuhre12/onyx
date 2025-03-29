"""add_cascade_delete_to_connector_documents

Revision ID: a31fc5e4d9c8
Revises: 3bd4c84fe72f
Create Date: 2025-03-29 12:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "a31fc5e4d9c8"
down_revision = "3bd4c84fe72f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    This migration adds cascade delete to the relationship between Connector and
    DocumentByConnectorCredentialPair to fix an issue where deleting a Connector
    would fail because SQLAlchemy was trying to blank out primary key columns in
    DocumentByConnectorCredentialPair records instead of deleting them.

    The actual change is in the model definition (models.py) where we've added
    cascade="all, delete-orphan" to the documents_by_connector relationship in
    the Connector model.

    This is a metadata-only change and doesn't require schema modifications.
    """
    # This is a metadata-only change to the SQLAlchemy model, no SQL needed


def downgrade() -> None:
    """
    No downgrade required as this is a metadata-only change
    """
