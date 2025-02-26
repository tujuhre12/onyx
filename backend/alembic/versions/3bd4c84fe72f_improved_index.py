"""improved index

Revision ID: 3bd4c84fe72f
Revises: 8f43500ee275
Create Date: 2025-02-26 13:07:56.217791

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "3bd4c84fe72f"
down_revision = "8f43500ee275"
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

    # Commit the current transaction before creating concurrent indexes
    op.execute("COMMIT")

    op.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_message_tsv
        ON chat_message
        USING GIN (message_tsv)
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

    # Commit again before creating the second concurrent index
    op.execute("COMMIT")

    op.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_session_desc_tsv
        ON chat_session
        USING GIN (description_tsv)
        """
    )


def downgrade() -> None:
    # Drop the indexes first (use CONCURRENTLY for dropping too)
    op.execute("COMMIT")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_chat_message_tsv;")

    op.execute("COMMIT")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_chat_session_desc_tsv;")

    # Then drop the columns
    op.execute("ALTER TABLE chat_message DROP COLUMN IF EXISTS message_tsv;")
    op.execute("ALTER TABLE chat_session DROP COLUMN IF EXISTS description_tsv;")

    op.execute("DROP INDEX IF EXISTS idx_chat_message_message_lower;")
