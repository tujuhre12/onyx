import json
import re

from langchain_core.messages import HumanMessage

from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.answer_question.states import AnswerQuestionState
from onyx.agent_search.answer_question.states import QuestionAnswerResults
from onyx.agent_search.main.states import FollowUpAnswerQuestionOutput
from onyx.agent_search.main.states import FollowUpDecompAnswersUpdate
from onyx.agent_search.main.states import FollowUpSubQuestionsUpdate
from onyx.agent_search.main.states import MainState
from onyx.agent_search.refined_answers.models import FollowUpSubQuestion
from onyx.agent_search.refined_answers.states import RefinedAnswerInput
from onyx.agent_search.refined_answers.states import RefinedAnswerOutput
from onyx.agent_search.shared_graph_utils.operators import dedup_inference_sections
from onyx.agent_search.shared_graph_utils.prompts import DEEP_DECOMPOSE_PROMPT
from onyx.agent_search.shared_graph_utils.utils import format_entity_term_extraction


def dummy_node(state: RefinedAnswerInput) -> RefinedAnswerOutput:
    print("---DUMMY NODE---")
    return {"dummy_output": "this is a dummy output"}


def follow_up_decompose(state: MainState) -> FollowUpSubQuestionsUpdate:
    """ """

    question = state["search_request"].query
    base_answer = state["initial_answer"]

    # get the entity term extraction dict and properly format it
    entity_retlation_term_extractions = state["entity_retlation_term_extractions"]

    entity_term_extraction_str = format_entity_term_extraction(
        entity_retlation_term_extractions
    )

    initial_question_answers = state["decomp_answer_results"]

    addressed_question_list = [
        x.question for x in initial_question_answers if "yes" in x.quality.lower()
    ]

    failed_question_list = [
        x.question for x in initial_question_answers if "no" in x.quality.lower()
    ]

    msg = [
        HumanMessage(
            content=DEEP_DECOMPOSE_PROMPT.format(
                question=question,
                entity_term_extraction_str=entity_term_extraction_str,
                base_answer=base_answer,
                answered_sub_questions="\n - ".join(addressed_question_list),
                failed_sub_questions="\n - ".join(failed_question_list),
            ),
        )
    ]

    # Grader
    model = state["fast_llm"]
    response = model.invoke(msg)

    if isinstance(response.content, str):
        cleaned_response = re.sub(r"```json\n|\n```", "", response.content)
        parsed_response = json.loads(cleaned_response)
    else:
        raise ValueError("LLM response is not a string")

    follow_up_sub_question_dict = {}
    for sub_question_nr, sub_question_dict in enumerate(
        parsed_response["sub_questions"]
    ):
        follow_up_sub_question = FollowUpSubQuestion(
            sub_question=sub_question_dict["sub_question"],
            verified=False,
            answered=False,
            answer="",
        )

        follow_up_sub_question_dict[sub_question_nr] = follow_up_sub_question

    return FollowUpSubQuestionsUpdate(
        follow_up_sub_questions=follow_up_sub_question_dict
    )


def ingest_follow_up_answers(
    state: AnswerQuestionOutput,
) -> FollowUpDecompAnswersUpdate:
    documents = []
    answer_results = state.get("answer_results", [])
    for answer_result in answer_results:
        documents.extend(answer_result.documents)
    return FollowUpDecompAnswersUpdate(
        # Deduping is done by the documents operator for the main graph
        # so we might not need to dedup here
        follow_up_documents=dedup_inference_sections(documents, []),
        follow_up_decomp_answer_results=answer_results,
    )


def format_follow_up_answer(state: AnswerQuestionState) -> FollowUpAnswerQuestionOutput:
    return FollowUpAnswerQuestionOutput(
        follow_up_answer_results=[
            QuestionAnswerResults(
                question=state["question"],
                quality=state.get("answer_quality", "No"),
                answer=state["answer"],
                # expanded_retrieval_results=state["expanded_retrieval_results"],
                documents=state["documents"],
                sub_question_retrieval_stats=state["sub_question_retrieval_stats"],
            )
        ],
    )


# def ingest_follow_up_answers(state: AnswerQuestionOutput) -> DecompAnswersUpdate:
#     documents = []
#     answer_results = state.get("answer_results", [])
#     for answer_result in answer_results:
#         documents.extend(answer_result.documents)
#     return DecompAnswersUpdate(
#         # Deduping is done by the documents operator for the main graph
#         # so we might not need to dedup here
#         documents=dedup_inference_sections(documents, []),
#         decomp_answer_results=answer_results,
#     )
