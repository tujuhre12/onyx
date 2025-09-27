"""add_mcp_auth_performer

Revision ID: b30353be4eec
Revises: 8818cf73fa1a
Create Date: 2025-09-13 14:58:08.413534

"""

from alembic import op
import sqlalchemy as sa
from onyx.db.enums import MCPAuthenticationPerformer


# revision identifiers, used by Alembic.
revision = "b30353be4eec"
down_revision = "8818cf73fa1a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable column first for backward compatibility
    op.add_column(
        "mcp_server",
        sa.Column(
            "auth_performer",
            sa.Enum(MCPAuthenticationPerformer, native_enum=False),
            nullable=True,
        ),
    )

    # Backfill values using existing data and inference rules
    bind = op.get_bind()

    # 1) OAUTH servers are always PER_USER
    bind.execute(
        sa.text(
            """
        UPDATE mcp_server
        SET auth_performer = 'PER_USER'
        WHERE auth_type = 'OAUTH'
        """
        )
    )

    # 2) If there is no admin connection config, mark as ADMIN (and not set yet)
    bind.execute(
        sa.text(
            """
        UPDATE mcp_server
        SET auth_performer = 'ADMIN'
        WHERE admin_connection_config_id IS NULL
          AND auth_performer IS NULL
        """
        )
    )

    # 3) If there exists any user-specific connection config (user_email != ''), mark as PER_USER
    bind.execute(
        sa.text(
            """
        UPDATE mcp_server AS ms
        SET auth_performer = 'PER_USER'
        FROM mcp_connection_config AS mcc
        WHERE mcc.mcp_server_id = ms.id
          AND COALESCE(mcc.user_email, '') <> ''
          AND ms.auth_performer IS NULL
        """
        )
    )

    # 4) Default any remaining nulls to ADMIN (covers API_TOKEN admin-managed and NONE)
    bind.execute(
        sa.text(
            """
        UPDATE mcp_server
        SET auth_performer = 'ADMIN'
        WHERE auth_performer IS NULL
        """
        )
    )

    # Finally, make the column non-nullable
    op.alter_column(
        "mcp_server",
        "auth_performer",
        existing_type=sa.Enum(MCPAuthenticationPerformer, native_enum=False),
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column("mcp_server", "auth_performer")
