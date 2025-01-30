import threading
from typing import List

import pytest
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from onyx.auth.schemas import UserRole
from onyx.db.models import User
from onyx.db.users import batch_add_ext_perm_user_if_not_exists


def _call_parallel(engine, email_list: List[str]) -> None:
    # Create a new session for each thread
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    session = SessionLocal()
    try:
        batch_add_ext_perm_user_if_not_exists(session, email_list)
    finally:
        session.close()


@pytest.mark.parametrize(
    "emails",
    [
        [
            "user1@example.com",
            "user2@example.com",
            "USER1@EXAMPLE.COM",  # Test case insensitivity
        ]
    ],
)
def test_batch_add_ext_perm_user_if_not_exists_concurrent(
    db_session: Session, emails: List[str]
) -> None:
    thread_count = 5
    threads = []
    engine = db_session.get_bind()

    # Create and start multiple threads that all try to add the same users
    for _ in range(thread_count):
        t = threading.Thread(target=_call_parallel, args=(engine, emails))
        threads.append(t)
        t.start()

    # Wait for all threads to complete
    for t in threads:
        t.join()

    # Verify results - should have exactly one user per unique email (case insensitive)
    stmt = select(User).filter(
        func.lower(User.email).in_([email.lower() for email in emails])
    )
    created_users = db_session.scalars(stmt).unique().all()

    # Check total number of users (should be 2 since one email is a duplicate with different case)
    assert len(created_users) == 2

    # Verify all users have the correct role
    for user in created_users:
        assert user.role == UserRole.EXT_PERM_USER

    # Verify emails are present (case insensitive)
    created_emails = [user.email.lower() for user in created_users]
    assert "user1@example.com" in created_emails
    assert "user2@example.com" in created_emails
