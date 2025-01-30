import pytest
from sqlalchemy.orm import Session

from onyx.db.engine import get_session_context_manager


@pytest.fixture
def db_session() -> Session:
    with get_session_context_manager() as session:
        yield session
