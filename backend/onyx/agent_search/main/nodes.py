import json
import re

from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_message_runs

from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.answer_question.states import QuestionAnswerResults
from onyx.agent_search.base_raw_search.states import BaseRawSearchOutput
from onyx.agent_search.main.models import Entity
from onyx.agent_search.main.models import EntityRelationshipTermExtraction
from onyx.agent_search.main.models import Relationship
from onyx.agent_search.main.models import Term
from onyx.agent_search.main.states import BaseDecompUpdate
from onyx.agent_search.main.states import DecompAnswersUpdate
from onyx.agent_search.main.states import EntityTermExtractionUpdate
from onyx.agent_search.main.states import ExpandedRetrievalUpdate
from onyx.agent_search.main.states import InitialAnswerBASEUpdate
from onyx.agent_search.main.states import InitialAnswerQualityUpdate
from onyx.agent_search.main.states import InitialAnswerUpdate
from onyx.agent_search.main.states import MainState
from onyx.agent_search.main.states import RefinedAnswerUpdate
from onyx.agent_search.main.states import RequireRefinedAnswerUpdate
from onyx.agent_search.shared_graph_utils.models import AgentChunkStats
from onyx.agent_search.shared_graph_utils.models import InitialAgentResultStats
from onyx.agent_search.shared_graph_utils.models import RefinedAgentStats
from onyx.agent_search.shared_graph_utils.operators import dedup_inference_sections
from onyx.agent_search.shared_graph_utils.prompts import ENTITY_TERM_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import (
    INITIAL_DECOMPOSITION_PROMPT_QUESTIONS,
)
from onyx.agent_search.shared_graph_utils.prompts import INITIAL_RAG_BASE_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import INITIAL_RAG_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import (
    INITIAL_RAG_PROMPT_NO_SUB_QUESTIONS,
)
from onyx.agent_search.shared_graph_utils.prompts import REVISED_RAG_PROMPT
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
    response = model.invoke(msg)

    content = response.pretty_repr()
    list_of_subquestions = clean_and_parse_list_string(content)

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
        or orig_support_score == 0.0
        and initial_agent_result_stats.sub_questions["verified_avg_score"] is None
    ):
        initial_agent_result_stats.agent_effectiveness["support_ratio"] = None
    elif orig_support_score is None or orig_support_score == 0.0:
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
    response = model.invoke(msg)
    answer = response.pretty_repr()

    initial_agent_stats = _calculate_initial_agent_stats(
        state["decomp_answer_results"], state["original_question_retrieval_stats"]
    )

    print(f"\n\n---INITIAL AGENT ANSWER START---\n\n Answer:\n Agent: {answer}")

    print(f"\n\nSub-Questions:\n\n{sub_question_answer_str}\n\nStas:\n\n")

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


def initial_answer_quality_check(state: MainState) -> InitialAnswerQualityUpdate:
    """
    Check whether the final output satisfies the original user question

    Args:
        state (messages): The current state

    Returns:
        InitialAnswerQualityUpdate
    """

    # print("---CHECK INITIAL QUTPUT QUALITY---")

    # question = state["search_request"].query
    # initial_answer = state["initial_answer"]

    # msg = [
    #     HumanMessage(
    #         content=BASE_CHECK_PROMPT.format(question=question, initial_answer=initial_answer)
    #     )
    # ]

    # model = state["fast_llm"]
    # response = model.invoke(msg)

    # if 'yes' in response.content.lower():
    #     verdict = True
    # else:
    #     verdict = False

    # print(f"Verdict: {verdict}")

    print("Checking for base answer validity - for not set True/False manually")

    verdict = True

    return InitialAnswerQualityUpdate(initial_answer_quality=verdict)


def entity_term_extraction(state: MainState) -> EntityTermExtractionUpdate:
    print("---GENERATE ENTITIES & TERMS---")

    # first four lines duplicates from generate_initial_answer
    question = state["search_request"].query
    sub_question_docs = state["documents"]
    all_original_question_documents = state["all_original_question_documents"]
    relevant_docs = dedup_inference_sections(
        sub_question_docs, all_original_question_documents
    )

    # start with the entity/term/extraction

    doc_context = format_docs(relevant_docs)

    msg = [
        HumanMessage(
            content=ENTITY_TERM_PROMPT.format(question=question, context=doc_context),
        )
    ]
    fast_llm = state["fast_llm"]
    # Grader
    llm_response_list = list(
        fast_llm.stream(
            prompt=msg,
        )
    )
    llm_response = merge_message_runs(llm_response_list, chunk_separator="")[0].content

    cleaned_response = re.sub(r"```json\n|\n```", "", llm_response)
    parsed_response = json.loads(cleaned_response)

    entities = []
    relationships = []
    terms = []
    for entity in parsed_response.get("retrieved_entities_relationships", {}).get(
        "entities", {}
    ):
        entity_name = entity.get("entity_name", "")
        entity_type = entity.get("entity_type", "")
        entities.append(Entity(entity_name=entity_name, entity_type=entity_type))

    for relationship in parsed_response.get("retrieved_entities_relationships", {}).get(
        "relationships", {}
    ):
        relationship_name = relationship.get("relationship_name", "")
        relationship_type = relationship.get("relationship_type", "")
        relationship_entities = relationship.get("relationship_entities", [])
        relationships.append(
            Relationship(
                relationship_name=relationship_name,
                relationship_type=relationship_type,
                relationship_entities=relationship_entities,
            )
        )

    for term in parsed_response.get("retrieved_entities_relationships", {}).get(
        "terms", {}
    ):
        term_name = term.get("term_name", "")
        term_type = term.get("term_type", "")
        term_similar_to = term.get("term_similar_to", [])
        terms.append(
            Term(
                term_name=term_name,
                term_type=term_type,
                term_similar_to=term_similar_to,
            )
        )

    return EntityTermExtractionUpdate(
        entity_retlation_term_extractions=EntityRelationshipTermExtraction(
            entities=entities,
            relationships=relationships,
            terms=terms,
        )
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


def refined_answer_decision(state: MainState) -> RequireRefinedAnswerUpdate:
    print("---REFINED ANSWER DECISION---")

    if False:
        return RequireRefinedAnswerUpdate(require_refined_answer=False)

    else:
        return RequireRefinedAnswerUpdate(require_refined_answer=True)


def generate_refined_answer(state: MainState) -> RefinedAnswerUpdate:
    print("---GENERATE REFINED ANSWER---")

    initial_documents = state["documents"]
    revised_documents = state["follow_up_documents"]

    combined_documents = dedup_inference_sections(initial_documents, revised_documents)

    if len(initial_documents) > 0:
        revision_doc_effectiveness = len(combined_documents) / len(initial_documents)
    elif len(revised_documents) == 0:
        revision_doc_effectiveness = 0.0
    else:
        revision_doc_effectiveness = 10.0

    question = state["search_request"].query

    decomp_answer_results = state["decomp_answer_results"]
    revised_answer_results = state["follow_up_decomp_answer_results"]

    good_qa_list: list[str] = []
    decomp_questions = []

    _SUB_QUESTION_ANSWER_TEMPLATE = """
    Sub-Question:\n  - {sub_question}\n  --\nAnswer:\n  - {sub_answer}\n\n
    """

    initial_good_sub_questions: list[str] = []
    new_revised_good_sub_questions: list[str] = []

    for answer_set in [decomp_answer_results, revised_answer_results]:
        for decomp_answer_result in answer_set:
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
                if answer_set == decomp_answer_results:
                    initial_good_sub_questions.append(decomp_answer_result.question)
                else:
                    new_revised_good_sub_questions.append(decomp_answer_result.question)

    initial_good_sub_questions = list(set(initial_good_sub_questions))
    new_revised_good_sub_questions = list(set(new_revised_good_sub_questions))
    total_good_sub_questions = list(
        set(initial_good_sub_questions + new_revised_good_sub_questions)
    )
    revision_question_efficiency = len(total_good_sub_questions) / len(
        initial_good_sub_questions
    )

    sub_question_answer_str = "\n\n------\n\n".join(list(set(good_qa_list)))

    # original answer

    initial_answer = state["initial_answer"]

    if len(good_qa_list) > 0:
        msg = [
            HumanMessage(
                content=REVISED_RAG_PROMPT.format(
                    question=question,
                    answered_sub_questions=sub_question_answer_str,
                    relevant_docs=format_docs(combined_documents),
                    initial_answer=initial_answer,
                )
            )
        ]
    else:
        msg = [
            HumanMessage(
                content=INITIAL_RAG_PROMPT_NO_SUB_QUESTIONS.format(
                    question=question,
                    relevant_docs=format_docs(combined_documents),
                )
            )
        ]

    # Grader
    model = state["fast_llm"]
    response = model.invoke(msg)
    answer = response.pretty_repr()

    # refined_agent_stats = _calculate_refined_agent_stats(
    #     state["decomp_answer_results"], state["original_question_retrieval_stats"]
    # )

    initial_good_sub_questions_str = "\n".join(list(set(initial_good_sub_questions)))
    new_revised_good_sub_questions_str = "\n".join(
        list(set(new_revised_good_sub_questions))
    )

    refined_agent_stats = RefinedAgentStats(
        revision_doc_efficiency=revision_doc_effectiveness,
        revision_question_efficiency=revision_question_efficiency,
    )

    print(f"\n\n---INITIAL ANSWER START---\n\n Answer:\n Agent: {initial_answer}")
    print("-" * 10)
    print(f"\n\n---REVISED AGENT ANSWER START---\n\n Answer:\n Agent: {answer}")

    print("-" * 100)
    print(f"\n\nINITAL Sub-Questions\n\n{initial_good_sub_questions_str}\n\n")
    print("-" * 10)
    print(f"\n\nNEW REVISED Sub-Questions\n\n{new_revised_good_sub_questions_str}\n\n")

    print("-" * 100)

    print(
        f"\n\nINITAL & REVISED Sub-Questions & Answers:\n\n{sub_question_answer_str}\n\nStas:\n\n"
    )

    print("-" * 100)

    if state["initial_agent_stats"]:
        initial_doc_boost_factor = state["initial_agent_stats"].agent_effectiveness.get(
            "utilized_chunk_ratio", "--"
        )
        initial_support_boost_factor = state[
            "initial_agent_stats"
        ].agent_effectiveness.get("support_ratio", "--")
        initial_verified_docs = state["initial_agent_stats"].original_question.get(
            "num_verified_documents", "--"
        )
        initial_verified_docs_avg_score = state[
            "initial_agent_stats"
        ].original_question.get("verified_avg_score", "--")
        initial_sub_questions_verified_docs = state[
            "initial_agent_stats"
        ].sub_questions.get("num_verified_documents", "--")

        print("INITIAL AGENT STATS")
        print(f"Document Boost Factor: {initial_doc_boost_factor}")
        print(f"Support Boost Factor: {initial_support_boost_factor}")
        print(f"Originally Verified Docs: {initial_verified_docs}")
        print(f"Originally Verified Docs Avg Score: {initial_verified_docs_avg_score}")
        print(f"Sub-Questions Verified Docs: {initial_sub_questions_verified_docs}")
    if refined_agent_stats:
        print("-" * 10)
        print("REFINED AGENT STATS")
        print(f"Revision Doc Factor: {refined_agent_stats.revision_doc_efficiency}")
        print(
            f"Revision Question Factor: {refined_agent_stats.revision_question_efficiency}"
        )

    print("\n\n ---INITIAL AGENT ANSWER  END---\n\n")

    return RefinedAnswerUpdate(
        refined_answer=answer,
        refined_answer_quality=True,  # TODO: replace this with the actual check value
        refined_agent_stats=refined_agent_stats,
    )


# def check_refined_answer(state: MainState) -> RefinedAnswerUpdate:
#     print("---CHECK REFINED ANSWER---")

#     return RefinedAnswerUpdate(
#         refined_answer="",
#         refined_answer_quality=True
#     )
