from backend.onyx.agent_search.answer_question.states import QuestionAnswerResults
from langchain_core.messages import HumanMessage

from onyx.agent_search.main.states import AgentStats
from onyx.agent_search.main.states import InitialAnswerUpdate
from onyx.agent_search.main.states import MainState
from onyx.agent_search.shared_graph_utils.prompts import INITIAL_RAG_PROMPT
from onyx.agent_search.shared_graph_utils.utils import format_docs


def _calculate_initial_agent_stats(
    decomp_answer_results: list[QuestionAnswerResults], original_question_stats: dict
) -> AgentStats:
    initial_agent_dict = {
        "sub_questions": {},
        "original_question": {},
        "agent_effectiveness": {},
    }

    verified_document_chunk_ids = []
    support_scores = 0

    for decomp_answer_result in decomp_answer_results:
        verified_document_chunk_ids += (
            decomp_answer_result.sub_question_retrieval_stats["verified_doc_chunk_ids"]
        )
        support_scores += decomp_answer_result.sub_question_retrieval_stats[
            "verified_avg_scores"
        ]

    verified_document_chunk_ids = list(set(verified_document_chunk_ids))

    # Calculate sub-question stats
    if verified_document_chunk_ids:
        sub_question_stats = {
            "num_verified_documents": len(verified_document_chunk_ids),
            "verified_avg_score": support_scores / len(decomp_answer_results),
        }
    else:
        sub_question_stats = {"num_verified_documents": 0, "verified_avg_score": None}
    initial_agent_dict["sub_questions"].update(sub_question_stats)

    # Get original question stats
    initial_agent_dict["original_question"].update(
        {
            "num_verified_documents": original_question_stats.get("verified_count", 0),
            "verified_avg_score": original_question_stats.get(
                "verified_avg_scores", None
            ),
        }
    )

    # Calculate chunk utilization ratio
    sub_verified = initial_agent_dict["sub_questions"]["num_verified_documents"]
    orig_verified = initial_agent_dict["original_question"]["num_verified_documents"]

    chunk_ratio = None
    if orig_verified > 0:
        chunk_ratio = sub_verified / orig_verified if sub_verified > 0 else 0
    elif sub_verified > 0:
        chunk_ratio = 10

    initial_agent_dict["agent_effectiveness"]["utilized_chunk_ratio"] = chunk_ratio

    if (
        initial_agent_dict["original_question"]["verified_avg_score"] is None
        and initial_agent_dict["sub_questions"]["verified_avg_score"] is None
    ):
        initial_agent_dict["agent_effectiveness"]["support_ratio"] = None
    elif initial_agent_dict["original_question"]["verified_avg_score"] is None:
        initial_agent_dict["agent_effectiveness"]["support_ratio"] = 10
    elif initial_agent_dict["sub_questions"]["verified_avg_score"] is None:
        initial_agent_dict["agent_effectiveness"]["support_ratio"] = 0
    else:
        initial_agent_dict["agent_effectiveness"]["support_ratio"] = (
            initial_agent_dict["sub_questions"]["verified_avg_score"]
            / initial_agent_dict["original_question"]["verified_avg_score"]
        )

    return initial_agent_dict


def generate_initial_answer(state: MainState) -> InitialAnswerUpdate:
    print("---GENERATE INITIAL---")

    question = state["search_request"].query
    sub_question_docs = state["documents"]
    all_original_question_documents = state["all_original_question_documents"]
    # combined_docs = dedup_inference_sections(docs + all_original_question_documents)

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
            decomp_answer_result.quality.lower() == "yes"
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

    msg = [
        HumanMessage(
            content=INITIAL_RAG_PROMPT.format(
                question=question,
                answered_sub_questions=sub_question_answer_str,
                sub_question_docs_context=format_docs(sub_question_docs),
                additional_relevant_docs=format_docs(net_new_original_question_docs),
            )
        )
    ]

    # Grader
    model = state["fast_llm"]
    response = model.invoke(msg)
    answer = response.pretty_repr()

    initial_agent_stats = _calculate_initial_agent_stats(
        state["decomp_answer_results"], state["sub_question_retrieval_stats"]
    )

    print("")
    print(
        f"---INITIAL AGENT ANSWER START---  {answer}  ---INITIAL AGENT ANSWER  END---"
    )

    return InitialAnswerUpdate(
        initial_answer=answer,
        initial_agent_stats=initial_agent_stats,
        generated_sub_questions=decomp_questions,
    )
