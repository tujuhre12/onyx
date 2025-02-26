"""improve text search with extension-aware indexes

Revision ID: 9f43600ef285
Revises: 8f43500ee275
Create Date: 2025-02-26 14:22:15.082714

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "8f43500ee275"
down_revision = "da42808081e3"

branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create a GIN index for full-text search on chat_message.message
    op.execute(
        """
        ALTER TABLE chat_message
        ADD COLUMN message_tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('english', message)) STORED;
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_message_tsv
        ON chat_message
        USING GIN (message_tsv);
        """
    )

    # Also add a stored tsvector column for chat_session.description
    op.execute(
        """
        ALTER TABLE chat_session
        ADD COLUMN description_tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(description, ''))) STORED;
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_session_desc_tsv
        ON chat_session
        USING GIN (description_tsv);
        """
    )


def downgrade() -> None:
    # Drop the indexes first
    op.execute("DROP INDEX IF EXISTS idx_chat_message_tsv;")
    op.execute("DROP INDEX IF EXISTS idx_chat_session_desc_tsv;")

    # Then drop the columns
    op.execute("ALTER TABLE chat_message DROP COLUMN IF EXISTS message_tsv;")
    op.execute("ALTER TABLE chat_session DROP COLUMN IF EXISTS description_tsv;")
