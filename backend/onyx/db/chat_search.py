import time
from typing import List
from typing import Optional
from typing import Tuple
from uuid import UUID

from sqlalchemy import column
from sqlalchemy import desc
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import Session

from onyx.db.models import ChatMessage
from onyx.db.models import ChatSession


def search_chat_sessions(
    user_id: Optional[UUID],
    db_session: Session,
    query: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    include_deleted: bool = False,
    include_onyxbot_flows: bool = False,
) -> Tuple[List[ChatSession], bool]:
    """
    Extremely fast full-text search on ChatSession + ChatMessage.

    Returns (sessions, has_more)
    """
    start_time = time.time()
    offset_val = (page - 1) * page_size

    # If no query, just return the most recent sessions
    if not query or not query.strip():
        stmt = (
            select(ChatSession)
            .order_by(desc(ChatSession.time_created))
            .offset(offset_val)
            .limit(page_size + 1)
        )
        if user_id is not None:
            stmt = stmt.where(ChatSession.user_id == user_id)
        if not include_onyxbot_flows:
            stmt = stmt.where(ChatSession.onyxbot_flow.is_(False))
        if not include_deleted:
            stmt = stmt.where(ChatSession.deleted.is_(False))

        query_start = time.time()
        result = db_session.execute(stmt.options(joinedload(ChatSession.persona)))
        sessions = result.scalars().all()
        query_end = time.time()
        print(f"No-query fetch time: {query_end - query_start:.4f}s")

        has_more = len(sessions) > page_size
        if has_more:
            sessions = sessions[:page_size]

        total_time = time.time() - start_time
        print(f"Total no-query search time: {total_time:.4f}s")
        return sessions, has_more

    # Clean up the query string
    query = query.strip()

    # Build base conditions that apply to both queries
    base_conditions = []
    if user_id is not None:
        base_conditions.append(ChatSession.user_id == user_id)
    if not include_onyxbot_flows:
        base_conditions.append(ChatSession.onyxbot_flow.is_(False))
    if not include_deleted:
        base_conditions.append(ChatSession.deleted.is_(False))

    # Create references to the tsvector columns
    message_tsv = column("message_tsv")
    description_tsv = column("description_tsv")

    # Create a text search expression
    ts_query = func.plainto_tsquery("english", query)

    # A. Subselect of session IDs by matching description
    description_session_ids = (
        select(ChatSession.id)
        .where(*base_conditions)
        .where(description_tsv.op("@@")(ts_query))
    )

    # B. Subselect of session IDs by matching messages
    message_session_ids = (
        select(ChatMessage.chat_session_id)
        .join(ChatSession, ChatMessage.chat_session_id == ChatSession.id)
        .where(*base_conditions)
        .where(message_tsv.op("@@")(ts_query))
    )

    # C. Union the two sets of session IDs
    combined_ids = description_session_ids.union(message_session_ids).alias(
        "combined_ids"
    )

    # D. Now select the actual sessions, ordering by creation time
    #    We do an INNER JOIN on combined_ids so we only get matched sessions.
    final_stmt = (
        select(ChatSession)
        .join(combined_ids, ChatSession.id == combined_ids.c.id)
        .order_by(desc(ChatSession.time_created))
        .distinct()  # ensure no duplicates from the union
        .offset(offset_val)
        .limit(page_size + 1)
        .options(joinedload(ChatSession.persona))
    )

    # Time the actual query execution
    query_start = time.time()
    session_objs = db_session.execute(final_stmt).scalars().all()
    query_end = time.time()
    print(f"Full-text search query time: {query_end - query_start:.4f}s")

    # If you still want to debug with EXPLAIN ANALYZE, use a simpler approach:
    # Run a separate query with the text() function instead
    if query and query.strip():  # Only run explain for actual searches
        try:
            # Simple explain query that doesn't try to convert the full SQLAlchemy statement
            explain_result = db_session.execute(
                text(
                    "EXPLAIN (ANALYZE, BUFFERS) SELECT 1 FROM chat_message WHERE message_tsv @@ plainto_tsquery('english', :q)"
                ).bindparams(q=query)
            )
            print("Sample EXPLAIN output for text search:")
            for row in explain_result:
                print(row[0])
        except Exception as e:
            print(f"Error running EXPLAIN: {e}")

    has_more = len(session_objs) > page_size
    if has_more:
        session_objs = session_objs[:page_size]

    total_time = time.time() - start_time
    print(f"Total search time: {total_time:.4f}s")
    return session_objs, has_more
