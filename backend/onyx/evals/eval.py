import os
from contextlib import contextmanager
from typing import Any

from braintrust import Eval
from braintrust.logger import Dataset
from sqlalchemy import Engine
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import SessionTransaction

from onyx.chat.chat_utils import prepare_chat_message_request
from onyx.chat.process_message import gather_stream
from onyx.chat.process_message import stream_chat_message_objects
from onyx.context.search.models import RetrievalDetails
from onyx.db.engine.sql_engine import get_sqlalchemy_engine
from onyx.llm.override_models import LLMOverride


@contextmanager
def session_factory_context_manager(engine: Engine):
    conn = engine.connect()
    outer_tx = conn.begin()
    Maker = sessionmaker(bind=conn, expire_on_commit=False, future=True)

    def make_session() -> Session:
        s = Maker()
        s.begin_nested()

        @event.listens_for(s, "after_transaction_end")
        def _restart_savepoint(session: Session, transaction: SessionTransaction):
            if transaction.nested and not (
                transaction._parent is not None and transaction._parent.nested
            ):
                session.begin_nested()

        return s

    try:
        yield make_session
    finally:
        outer_tx.rollback()
        conn.close()


def _get_answer(
    message: str,
) -> str:
    engine = get_sqlalchemy_engine()
    with session_factory_context_manager(engine) as SessionLocal:
        with SessionLocal() as db_session:
            request = prepare_chat_message_request(
                message_text=message,
                user=None,
                persona_id=None,  # TODO: Use an "Eval" persona which will be relevant for prod as well
                persona_override_config=None,
                prompt=None,
                message_ts_to_respond_to=None,
                retrieval_details=RetrievalDetails(),
                rerank_settings=None,
                db_session=db_session,
                use_agentic_search=False,
                skip_gen_ai_answer_generation=False,
                llm_override=LLMOverride(
                    name="Default",
                    model_version="gpt-4.1",
                    temperature=0.7,
                ),
            )
            # can do tool / llm configuration here
            packets = stream_chat_message_objects(
                new_msg_req=request,
                user=None,
                db_session=db_session,
            )
            answer = gather_stream(packets)
            return answer.answer


def eval(data: list[Any] | Dataset) -> float:
    braintrust_project = os.environ.get("BRAINTRUST_PROJECT")
    if not braintrust_project:
        raise ValueError("BRAINTRUST_PROJECT is not set")
    data = [
        {"input": "What is the capital of France?"},
        {"input": "What is the capital of Spain?"},
    ]

    Eval(
        name=braintrust_project,
        data=data,
        task=lambda input: _get_answer(input),
        scores=[],
    )
    return 1.0
