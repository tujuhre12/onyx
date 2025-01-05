from uuid import UUID

from sqlalchemy.orm import Session

from onyx.db.models import SubQuery
from onyx.db.models import SubQuestion


def create_sub_question(
    db_session: Session,
    chat_session_id: UUID,
    primary_message_id: int,
    sub_question: str,
    sub_answer: str,
) -> SubQuestion:
    """Create a new sub-question record in the database."""
    sub_q = SubQuestion(
        chat_session_id=chat_session_id,
        primary_question_id=primary_message_id,
        sub_question=sub_question,
        sub_answer=sub_answer,
    )
    db_session.add(sub_q)
    db_session.flush()
    return sub_q


def create_sub_query(
    db_session: Session,
    chat_session_id: UUID,
    parent_question_id: int,
    sub_query: str,
) -> SubQuery:
    """Create a new sub-query record in the database."""
    sub_q = SubQuery(
        chat_session_id=chat_session_id,
        parent_question_id=parent_question_id,
        sub_query=sub_query,
    )
    db_session.add(sub_q)
    db_session.flush()
    return sub_q


def get_sub_questions_for_message(
    db_session: Session,
    primary_message_id: int,
) -> list[SubQuestion]:
    """Get all sub-questions for a given primary message."""
    return (
        db_session.query(SubQuestion)
        .filter(SubQuestion.primary_question_id == primary_message_id)
        .all()
    )


def get_sub_queries_for_question(
    db_session: Session,
    sub_question_id: int,
) -> list[SubQuery]:
    """Get all sub-queries for a given sub-question."""
    return (
        db_session.query(SubQuery)
        .filter(SubQuery.parent_question_id == sub_question_id)
        .all()
    )
