from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker
from sqlalchemy.types import JSON

from onyx.db.models import Base

@event.listens_for(Base.metadata, "before_create")
def adapt_jsonb_for_sqlite(target, connection, **kw):
    """Replace JSONB with JSON for SQLite."""
    for table in target.tables.values():
        for column in table.columns:
            if isinstance(column.type, JSONB):
                # Create a new JSON type that SQLite can handle
                json_type = JSON()
                json_type.should_evaluate_none = True
                column.type = json_type


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
