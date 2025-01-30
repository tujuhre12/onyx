from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker
from sqlalchemy.types import JSON
from sqlalchemy.types import Text
from sqlalchemy.types import TypeDecorator
from sqlalchemy.types import String
from typing import Any
from uuid import UUID

from onyx.db.models import Base

class SQLiteUUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value: UUID | str | None, dialect: Any) -> str | None:
        if value is None:
            return value
        return str(value)

    def process_result_value(self, value: str | None, dialect: Any) -> UUID | None:
        if value is None:
            return value
        return UUID(value)


@event.listens_for(Base.metadata, "before_create")
def adapt_jsonb_for_sqlite(target, connection, **kw):
    """Replace PostgreSQL-specific types with SQLite-compatible types."""
    for table in target.tables.values():
        # Remove schema prefix for SQLite
        if table.schema:
            table.schema = None

        for column in table.columns:
            if isinstance(column.type, JSONB):
                json_type = JSON()
                json_type.should_evaluate_none = True
                column.type = json_type
            elif isinstance(column.type, ARRAY):
                column.type = Text()
            elif str(column.type) == 'UUID':
                column.type = SQLiteUUID()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
