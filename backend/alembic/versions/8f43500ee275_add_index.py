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
    import time

    start_time = time.time()

    # Create a GIN index for full-text search on chat_message.message
    print("Adding message_tsv column to chat_message table...")
    op.execute(
        """
        ALTER TABLE chat_message
        ADD COLUMN message_tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('english', message)) STORED;
        """
    )
    print(f"Added message_tsv column in {time.time() - start_time:.2f} seconds")

    index_start_time = time.time()
    print("Creating GIN index on chat_message.message_tsv...")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_message_tsv
        ON chat_message
        USING GIN (message_tsv)
        """
    )
    print(f"Created chat_message index in {time.time() - index_start_time:.2f} seconds")

    # Also add a stored tsvector column for chat_session.description
    session_start_time = time.time()
    print("Adding description_tsv column to chat_session table...")
    op.execute(
        """
        ALTER TABLE chat_session
        ADD COLUMN description_tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(description, ''))) STORED;
        """
    )
    print(
        f"Added description_tsv column in {time.time() - session_start_time:.2f} seconds"
    )

    session_index_start_time = time.time()
    print("Creating GIN index on chat_session.description_tsv...")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_session_desc_tsv
        ON chat_session
        USING GIN (description_tsv)
        """
    )
    print(
        f"Created chat_session index in {time.time() - session_index_start_time:.2f} seconds"
    )
    print(f"Total upgrade time: {time.time() - start_time:.2f} seconds")


def downgrade() -> None:
    # Drop the indexes first
    op.execute("DROP INDEX IF EXISTS idx_chat_message_tsv;")
    op.execute("DROP INDEX IF EXISTS idx_chat_session_desc_tsv;")

    # Then drop the columns
    op.execute("ALTER TABLE chat_message DROP COLUMN IF EXISTS message_tsv;")
    op.execute("ALTER TABLE chat_session DROP COLUMN IF EXISTS description_tsv;")

    op.execute("DROP INDEX IF EXISTS idx_chat_message_message_lower;")
