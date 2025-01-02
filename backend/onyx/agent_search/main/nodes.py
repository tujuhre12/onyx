from typing import Any
from typing import cast

from langchain_core.callbacks.manager import dispatch_custom_event
from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_content

from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.answer_question.states import QuestionAnswerResults
from onyx.agent_search.base_raw_search.states import BaseRawSearchOutput
from onyx.agent_search.main.states import BaseDecompUpdate
from onyx.agent_search.main.states import DecompAnswersUpdate
from onyx.agent_search.main.states import ExpandedRetrievalUpdate
from onyx.agent_search.main.states import InitialAnswerBASEUpdate
from onyx.agent_search.main.states import InitialAnswerUpdate
from onyx.agent_search.main.states import MainState
from onyx.agent_search.shared_graph_utils.models import AgentChunkStats
from onyx.agent_search.shared_graph_utils.models import InitialAgentResultStats
from onyx.agent_search.shared_graph_utils.operators import dedup_inference_sections
from onyx.agent_search.shared_graph_utils.prompts import (
    INITIAL_DECOMPOSITION_PROMPT_QUESTIONS,
)
from onyx.agent_search.shared_graph_utils.prompts import INITIAL_RAG_BASE_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import INITIAL_RAG_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import (
    INITIAL_RAG_PROMPT_NO_SUB_QUESTIONS,
)
from onyx.agent_search.shared_graph_utils.utils import clean_and_parse_list_string
from onyx.agent_search.shared_graph_utils.utils import format_docs


def main_decomp_base(state: MainState) -> BaseDecompUpdate:
    question = state["search_request"].query

    msg = [
        HumanMessage(
            content=INITIAL_DECOMPOSITION_PROMPT_QUESTIONS.format(question=question),
        )
    ]

    # Get the rewritten queries in a defined format
    model = state["fast_llm"]
    streamed_tokens: list[str | list[str | dict[str, Any]]] = [""]
    for message in model.stream(msg):
        dispatch_custom_event(
            "decomp_qs",
            message.content,
        )
        streamed_tokens.append(message.content)

    response = merge_content(*streamed_tokens)

    # this call should only return strings. Commenting out for efficiency
    # assert [type(tok) == str for tok in streamed_tokens]

    # use no-op cast() instead of str() which runs code
    list_of_subquestions = clean_and_parse_list_string(cast(str, response))

    decomp_list: list[str] = [
        sub_question["sub_question"].strip() for sub_question in list_of_subquestions
    ]

    return BaseDecompUpdate(
        initial_decomp_questions=decomp_list,
    )


def _calculate_initial_agent_stats(
    decomp_answer_results: list[QuestionAnswerResults],
    original_question_stats: AgentChunkStats,
) -> InitialAgentResultStats:
    initial_agent_result_stats: InitialAgentResultStats = InitialAgentResultStats(
        sub_questions={},
        original_question={},
        agent_effectiveness={},
    )

    orig_verified = original_question_stats.verified_count
    orig_support_score = original_question_stats.verified_avg_scores

    verified_document_chunk_ids = []
    support_scores = 0.0

    for decomp_answer_result in decomp_answer_results:
        verified_document_chunk_ids += (
            decomp_answer_result.sub_question_retrieval_stats.verified_doc_chunk_ids
        )
        if (
            decomp_answer_result.sub_question_retrieval_stats.verified_avg_scores
            is not None
        ):
            support_scores += (
                decomp_answer_result.sub_question_retrieval_stats.verified_avg_scores
            )

    verified_document_chunk_ids = list(set(verified_document_chunk_ids))

    # Calculate sub-question stats
    if (
        verified_document_chunk_ids
        and len(verified_document_chunk_ids) > 0
        and support_scores is not None
    ):
        sub_question_stats: dict[str, float | int | None] = {
            "num_verified_documents": len(verified_document_chunk_ids),
            "verified_avg_score": float(support_scores / len(decomp_answer_results)),
        }
    else:
        sub_question_stats = {"num_verified_documents": 0, "verified_avg_score": None}

    initial_agent_result_stats.sub_questions.update(sub_question_stats)

    # Get original question stats
    initial_agent_result_stats.original_question.update(
        {
            "num_verified_documents": original_question_stats.verified_count,
            "verified_avg_score": original_question_stats.verified_avg_scores,
        }
    )

    # Calculate chunk utilization ratio
    sub_verified = initial_agent_result_stats.sub_questions["num_verified_documents"]

    chunk_ratio: float | None = None
    if sub_verified is not None and orig_verified is not None and orig_verified > 0:
        chunk_ratio = (float(sub_verified) / orig_verified) if sub_verified > 0 else 0.0
    elif sub_verified is not None and sub_verified > 0:
        chunk_ratio = 10.0

    initial_agent_result_stats.agent_effectiveness["utilized_chunk_ratio"] = chunk_ratio

    if (
        orig_support_score is None
        and initial_agent_result_stats.sub_questions["verified_avg_score"] is None
    ):
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = None
    elif orig_support_score is None:
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = 10
    elif initial_agent_result_stats.sub_questions["verified_avg_score"] is None:
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = 0
    else:
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = (
            initial_agent_result_stats.sub_questions["verified_avg_score"]
            / orig_support_score
        )

    return initial_agent_result_stats


def generate_initial_answer(state: MainState) -> InitialAnswerUpdate:
    print("---GENERATE INITIAL---")

    question = state["search_request"].query
    sub_question_docs = state["documents"]
    all_original_question_documents = state["all_original_question_documents"]
    relevant_docs = dedup_inference_sections(
        sub_question_docs, all_original_question_documents
    )

    net_new_original_question_docs = []
    for all_original_question_doc in all_original_question_documents:
        if all_original_question_doc not in sub_question_docs:
            net_new_original_question_docs.append(all_original_question_doc)

    decomp_answer_results = state["decomp_answer_results"]

    good_qa_list: list[str] = []
    decomp_questions = []

    _SUB_QUESTION_ANSWER_TEMPLATE = """
    Sub-Question:\n  - {sub_question}\n  --\nAnswer:\n  - {sub_answer}\n\n
    """
    for decomp_answer_result in decomp_answer_results:
        decomp_questions.append(decomp_answer_result.question)
        if (
            decomp_answer_result.quality.lower().startswith("yes")
            and len(decomp_answer_result.answer) > 0
            and decomp_answer_result.answer != "I don't know"
        ):
            good_qa_list.append(
                _SUB_QUESTION_ANSWER_TEMPLATE.format(
                    sub_question=decomp_answer_result.question,
                    sub_answer=decomp_answer_result.answer,
                )
            )

    sub_question_answer_str = "\n\n------\n\n".join(good_qa_list)

    if len(good_qa_list) > 0:
        msg = [
            HumanMessage(
                content=INITIAL_RAG_PROMPT.format(
                    question=question,
                    answered_sub_questions=sub_question_answer_str,
                    relevant_docs=format_docs(relevant_docs),
                )
            )
        ]
    else:
        msg = [
            HumanMessage(
                content=INITIAL_RAG_PROMPT_NO_SUB_QUESTIONS.format(
                    question=question,
                    relevant_docs=format_docs(relevant_docs),
                )
            )
        ]

    # Grader
    model = state["fast_llm"]
    streamed_tokens: list[str | list[str | dict[str, Any]]] = [""]
    for message in model.stream(msg):
        dispatch_custom_event(
            "main_answer",
            message.content,
        )
        streamed_tokens.append(message.content)
    response = merge_content(*streamed_tokens)
    answer = cast(str, response)

    initial_agent_stats = _calculate_initial_agent_stats(
        state["decomp_answer_results"], state["original_question_retrieval_stats"]
    )

    print(f"\n\n---INITIAL AGENT ANSWER START---\n\n Answer:\n Agent: {answer}")

    print(f"\n\nSub-Questions:\n\n{sub_question_answer_str}\n\nStats:\n\n")

    if initial_agent_stats:
        print(initial_agent_stats.original_question)
        print(initial_agent_stats.sub_questions)
        print(initial_agent_stats.agent_effectiveness)
    print("\n\n ---INITIAL AGENT ANSWER  END---\n\n")

    return InitialAnswerUpdate(
        initial_answer=answer,
        initial_agent_stats=initial_agent_stats,
        generated_sub_questions=decomp_questions,
    )


def generate_initial_base_answer(state: MainState) -> InitialAnswerBASEUpdate:
    print("---GENERATE INITIAL BASE ANSWER---")

    question = state["search_request"].query
    original_question_docs = state["all_original_question_documents"]

    msg = [
        HumanMessage(
            content=INITIAL_RAG_BASE_PROMPT.format(
                question=question,
                context=format_docs(original_question_docs),
            )
        )
    ]

    # Grader
    model = state["fast_llm"]
    response = model.invoke(msg)
    answer = response.pretty_repr()

    print()
    print(
        f"\n\n---INITIAL BASE ANSWER START---\n\nBase:  {answer}\n\n  ---INITIAL BASE ANSWER  END---\n\n"
    )
    return InitialAnswerBASEUpdate(initial_base_answer=answer)


def ingest_answers(state: AnswerQuestionOutput) -> DecompAnswersUpdate:
    documents = []
    answer_results = state.get("answer_results", [])
    for answer_result in answer_results:
        documents.extend(answer_result.documents)
    return DecompAnswersUpdate(
        # Deduping is done by the documents operator for the main graph
        # so we might not need to dedup here
        documents=dedup_inference_sections(documents, []),
        decomp_answer_results=answer_results,
    )


def ingest_initial_retrieval(state: BaseRawSearchOutput) -> ExpandedRetrievalUpdate:
    sub_question_retrieval_stats = state[
        "base_expanded_retrieval_result"
    ].sub_question_retrieval_stats
    if sub_question_retrieval_stats is None:
        sub_question_retrieval_stats = AgentChunkStats()
    else:
        sub_question_retrieval_stats = sub_question_retrieval_stats

    return ExpandedRetrievalUpdate(
        original_question_retrieval_results=state[
            "base_expanded_retrieval_result"
        ].expanded_queries_results,
        all_original_question_documents=state[
            "base_expanded_retrieval_result"
        ].all_documents,
        original_question_retrieval_stats=sub_question_retrieval_stats,
    )
