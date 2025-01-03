from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_message_runs

from onyx.agent_search.answer_question.states import AnswerQuestionState
from onyx.agent_search.answer_question.states import QAGenerationUpdate
from onyx.agent_search.shared_graph_utils.prompts import ASSISTANT_SYSTEM_PROMPT_DEFAULT
from onyx.agent_search.shared_graph_utils.prompts import ASSISTANT_SYSTEM_PROMPT_PERSONA
from onyx.agent_search.shared_graph_utils.prompts import BASE_RAG_PROMPT
from onyx.agent_search.shared_graph_utils.utils import format_docs
from onyx.agent_search.shared_graph_utils.utils import get_persona_prompt
from onyx.utils.logger import setup_logger

logger = setup_logger()


def answer_generation(state: AnswerQuestionState) -> QAGenerationUpdate:
    question = state["question"]
    docs = state["documents"]
    persona_prompt = get_persona_prompt(state["subgraph_search_request"].persona)

    if len(persona_prompt) > 0:
        persona_specification = ASSISTANT_SYSTEM_PROMPT_DEFAULT
    else:
        persona_specification = ASSISTANT_SYSTEM_PROMPT_PERSONA.format(
            persona_prompt=persona_prompt
        )

    logger.info(f"Number of verified retrieval docs: {len(docs)}")

    msg = [
        HumanMessage(
            content=BASE_RAG_PROMPT.format(
                question=question,
                context=format_docs(docs),
                original_question=state["subgraph_search_request"].query,
                persona_specification=persona_specification,
            )
        )
    ]

    fast_llm = state["subgraph_fast_llm"]
    response = list(
        fast_llm.stream(
            prompt=msg,
        )
    )

    answer_str = merge_message_runs(response, chunk_separator="")[0].content
    return QAGenerationUpdate(
        answer=answer_str,
    )
