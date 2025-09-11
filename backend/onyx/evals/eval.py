from contextlib import contextmanager

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
from onyx.db.users import get_user_by_email
from onyx.evals.models import EvalConfigurationOptions
from onyx.evals.models import EvaluationResult
from onyx.evals.provider import get_default_provider
from onyx.server.evals.models import Data


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
    message,
    configuration: EvalConfigurationOptions,
) -> str:
    engine = get_sqlalchemy_engine()
    with session_factory_context_manager(engine) as SessionLocal:
        with SessionLocal() as db_session:
            full_configuration = configuration.get_configuration(db_session)
            user = (
                get_user_by_email(full_configuration.impersonation_email, db_session)
                if full_configuration.impersonation_email
                else None
            )
            request = prepare_chat_message_request(
                message_text=message,
                user=user,
                persona_id=None,
                persona_override_config=full_configuration.persona_override_config,
                prompt=None,
                message_ts_to_respond_to=None,
                retrieval_details=RetrievalDetails(),
                rerank_settings=None,
                db_session=db_session,
                use_agentic_search=False,
                skip_gen_ai_answer_generation=False,
                llm_override=full_configuration.llm,
            )
            # can do tool / llm configuration here
            packets = stream_chat_message_objects(
                new_msg_req=request,
                user=user,
                db_session=db_session,
            )
            answer = gather_stream(packets)
            return answer.answer


def eval(data: Data, configuration: EvalConfigurationOptions) -> EvaluationResult:
    provider = get_default_provider()
    return provider.eval(
        configuration, lambda input: _get_answer(input, configuration), data
    )
