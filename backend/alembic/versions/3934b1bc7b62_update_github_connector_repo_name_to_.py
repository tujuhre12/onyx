"""Update GitHub connector repo_name to repo_names

Revision ID: 3934b1bc7b62
Revises: b7c2b63c4a03
Create Date: 2025-03-05 10:50:30.516962

"""
from alembic import op
import sqlalchemy as sa
import json

# revision identifiers, used by Alembic.
revision = "3934b1bc7b62"
down_revision = "b7c2b63c4a03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Get all GitHub connectors
    conn = op.get_bind()

    # First get all GitHub connectors
    github_connectors = conn.execute(
        sa.text(
            """
            SELECT id, connector_specific_config
            FROM connector
            WHERE source = 'GITHUB'
            """
        )
    ).fetchall()

    # Update each connector's config
    for connector_id, config in github_connectors:
        if not config or "repo_name" not in config:
            continue

        # Create new config with repositories instead of repo_name
        new_config = dict(config)
        new_config["repositories"] = new_config.pop("repo_name")

        # Update the connector with the new config
        conn.execute(
            sa.text(
                """
                UPDATE connector
                SET connector_specific_config = :new_config
                WHERE id = :connector_id
                """
            ),
            {"connector_id": connector_id, "new_config": json.dumps(new_config)},
        )


def downgrade():
    # Get all GitHub connectors
    conn = op.get_bind()
    github_connectors = conn.execute(
        sa.text(
            """
            SELECT id, connector_specific_config
            FROM connector
            WHERE source = 'GITHUB'
            """
        )
    ).fetchall()

    # Revert each GitHub connector to use repo_name instead of repositories
    for connector_id, config in github_connectors:
        if config and "repositories" in config:
            # Create new config with repo_name instead of repositories
            new_config = dict(config)
            new_config["repo_name"] = new_config.pop("repositories")

            # Update the connector with the new config
            conn.execute(
                sa.text(
                    """
                    UPDATE connector
                    SET connector_specific_config = :new_config
                    WHERE id = :connector_id
                    """
                ),
                {"new_config": json.dumps(new_config), "connector_id": connector_id},
            )
