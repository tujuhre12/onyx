"""add default slack channel config

Revision ID: eaa3b5593925
Revises: 2f80c6a2550f
Create Date: 2025-02-03 18:07:56.552526

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "eaa3b5593925"
down_revision = "2f80c6a2550f"
branch_labels = None
depends_on = None


def upgrade():
    # Add is_default column
    op.add_column(
        "slack_channel_config",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Add unique constraint
    op.create_unique_constraint(
        "uq_slack_channel_config_slack_bot_id_default",
        "slack_channel_config",
        ["slack_bot_id", "is_default"],
    )
    op.create_index(
        "ix_slack_channel_config_slack_bot_id_default",
        "slack_channel_config",
        ["slack_bot_id", "is_default"],
        unique=True,
        postgresql_where=sa.text("is_default IS TRUE"),
    )


def downgrade():
    # Remove index
    op.drop_index(
        "ix_slack_channel_config_slack_bot_id_default",
        table_name="slack_channel_config",
    )

    # Remove unique constraint
    op.drop_constraint(
        "uq_slack_channel_config_slack_bot_id_default",
        "slack_channel_config",
        type_="unique",
    )

    # Remove is_default column
    op.drop_column("slack_channel_config", "is_default")
