"""Add native-vs-custom LLM Provider field

Revision ID: 5d816b240b7a
Revises: 7a70b7664e37
Create Date: 2025-04-21 14:17:15.812325

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5d816b240b7a"
down_revision = "7a70b7664e37"
branch_labels = None
depends_on = None


PROVIDER_TO_MODEL_MAP: dict[str, set[str]] = {
    "openai": set([]),
}


def upgrade() -> None:
    llm_provider_table = sa.sql.table(
        "llm_provider",
        sa.column("id", sa.Integer),
        sa.column("provider", sa.String),
    )
    model_configuration_table = sa.sql.table(
        "model_configuration",
        sa.column("llm_provider_id", sa.Integer),
        sa.column("name", sa.String),
    )

    connection = op.get_bind()
    sa.Enum("custom", "native", name="source_type").create(connection)

    op.add_column(
        "llm_provider",
        sa.Column(
            "native_or_custom",
            sa.Enum("custom", "native", name="source_type"),
            autoincrement=False,
            # Set to nullable first.
            # Then, find the appropriate value to put in each row, and update accordingly.
            # Finally, update column to be non-nullable.
            nullable=True,
        ),
    )

    llm_providers = connection.execute(
        sa.select(
            llm_provider_table.c.id,
            llm_provider_table.c.provider,
        ).where(llm_provider_table.c.id)
    ).fetchall()

    for llm_provider in llm_providers:
        provider_id: int = llm_provider[0]
        provider_name: str = llm_provider[1]

        native_or_custom: str

        if provider_name in PROVIDER_TO_MODEL_MAP:
            model_configurations = connection.execute(
                sa.select(
                    model_configuration_table.c.name,
                ).where(model_configuration_table.c.llm_provider_id == provider_id)
            ).fetchall()

            canonical_model_names_for_provider_that_we_support = PROVIDER_TO_MODEL_MAP[
                provider_name
            ]
            current_model_names: set[str] = set(
                [model_configuration[0] for model_configuration in model_configurations]
            )

            native_or_custom = (
                "native"
                if current_model_names.issubset(
                    canonical_model_names_for_provider_that_we_support
                )
                else "custom"
            )
        else:
            native_or_custom = "custom"

        connection.execute(
            sa.update(llm_provider_table).values(native_or_custom=native_or_custom)
        )


def downgrade() -> None:
    op.drop_column("llm_provider", "native_or_custom")
