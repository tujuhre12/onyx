from datetime import datetime
from typing import cast

from langchain_core.messages import merge_content
from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.dr.constants import AVERAGE_TOOL_COSTS
from onyx.agents.agent_search.dr.constants import DR_TIME_BUDGET_BY_TYPE
from onyx.agents.agent_search.dr.constants import HIGH_LEVEL_PLAN_PREFIX
from onyx.agents.agent_search.dr.dr_prompt_builder import (
    get_dr_prompt_orchestration_templates,
)
from onyx.agents.agent_search.dr.models import DRPromptPurpose
from onyx.agents.agent_search.dr.models import DRTimeBudget
from onyx.agents.agent_search.dr.models import OrchestrationPlan
from onyx.agents.agent_search.dr.models import OrchestratorDecisonsNoPlan
from onyx.agents.agent_search.dr.states import DRPath
from onyx.agents.agent_search.dr.states import MainState
from onyx.agents.agent_search.dr.states import OrchestrationUpdate
from onyx.agents.agent_search.dr.utils import aggregate_context
from onyx.agents.agent_search.dr.utils import create_tool_call_string
from onyx.agents.agent_search.dr.utils import get_prompt_question
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.llm import invoke_llm_json
from onyx.agents.agent_search.shared_graph_utils.llm import stream_llm_answer
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.agents.agent_search.shared_graph_utils.utils import run_with_timeout
from onyx.agents.agent_search.shared_graph_utils.utils import write_custom_event
from onyx.chat.models import AgentAnswerPiece
from onyx.kg.utils.extraction_utils import get_entity_types_str
from onyx.kg.utils.extraction_utils import get_relationship_types_str
from onyx.prompts.dr_prompts import ORCHESTRATOR_NEXT_STEP_PURPOSE_PROMPT
from onyx.prompts.dr_prompts import SUFFICIENT_INFORMATION_STRING
from onyx.utils.logger import setup_logger

logger = setup_logger()


def orchestrator(
    state: MainState, config: RunnableConfig, writer: StreamWriter = lambda _: None
) -> OrchestrationUpdate:
    """
    LangGraph node to decide the next step in the DR process.
    """

    node_start_time = datetime.now()

    graph_config = cast(GraphConfig, config["metadata"]["config"])
    question = state.original_question
    if not question:
        raise ValueError("Question is required for orchestrator")

    plan_of_record = state.plan_of_record
    clarification = state.clarification
    iteration_nr = state.iteration_nr + 1
    time_budget = graph_config.behavior.time_budget
    remaining_time_budget = state.remaining_time_budget
    chat_history_string = state.chat_history_string or "(No chat history yet available)"
    if time_budget == DRTimeBudget.FAST:
        answer_history_string = (
            aggregate_context(
                state.iteration_responses,
                include_answers_claims=False,
                include_documents=True,
            ).context
            or "(No answer history yet available)"
        )
    else:
        answer_history_string = (
            aggregate_context(
                state.iteration_responses, include_answers_claims=True
            ).context
            or "(No answer history yet available)"
        )

    questions = [
        f"{iteration_response.tool}: {iteration_response.question}"
        for iteration_response in state.iteration_responses
        if len(iteration_response.question) > 0
    ]

    question_history_string = (
        "\n".join(f"  - {question}" for question in questions)
        if questions
        else "(No question history yet available)"
    )

    prompt_question = get_prompt_question(question, clarification)

    gaps_str = (
        ("\n  - " + "\n  - ".join(state.gaps))
        if state.gaps
        else "(No explicit gaps were pointed out so far)"
    )

    all_entity_types = get_entity_types_str(active=True)
    all_relationship_types = get_relationship_types_str(active=True)

    # default to closer
    query_path = DRPath.CLOSER
    query_list = ["Answer the question with the information you have."]
    decision_prompt = None

    if time_budget == DRTimeBudget.FAST:

        reasoning_result = "(No reasoning result provided yet.)"
        tool_calls_string = "(No tool calls provided yet.)"

        if iteration_nr == 1:
            remaining_time_budget = DR_TIME_BUDGET_BY_TYPE[DRTimeBudget.FAST]

        if iteration_nr > 1:

            # for each iteration past the first one, we need to see whether we
            # have enough information to answer the question.
            # if we do, we can stop the iteration and return the answer.
            # if we do not, we need to continue the iteration.

            base_reasoning_prompt = get_dr_prompt_orchestration_templates(
                DRPromptPurpose.NEXT_STEP_REASONING,
                DRTimeBudget.FAST,
                entity_types_string=all_entity_types,
                relationship_types_string=all_relationship_types,
                available_tools=state.available_tools,
            )

            write_custom_event(
                "basic_response",
                AgentAnswerPiece(
                    answer_piece="\n\n\nREASONING TO STOP/CONTINUE:\n\n\n",
                    level=0,
                    level_question_num=0,
                    answer_type="agent_level_answer",
                ),
                writer,
            )

            reasoning_prompt = (
                base_reasoning_prompt.replace("---question---", question)
                .replace("---chat_history_string---", chat_history_string)
                .replace("---answer_history_string---", answer_history_string)
                .replace("---iteration_nr---", str(iteration_nr))
                .replace("---remaining_time_budget---", str(remaining_time_budget))
            )

            reasoning_tokens: list[str] = [""]

            reasoning_tokens, _ = run_with_timeout(
                80,
                lambda: stream_llm_answer(
                    llm=graph_config.tooling.primary_llm,
                    prompt=reasoning_prompt,
                    event_name="basic_response",
                    writer=writer,
                    agent_answer_level=0,
                    agent_answer_question_num=0,
                    agent_answer_type="agent_level_answer",
                    timeout_override=60,
                    max_tokens=None,
                ),
            )
            reasoning_result = cast(str, merge_content(*reasoning_tokens))

            if SUFFICIENT_INFORMATION_STRING in reasoning_result:

                return OrchestrationUpdate(
                    query_path=[DRPath.CLOSER],
                    query_list=[],
                    iteration_nr=iteration_nr,
                    log_messages=[
                        get_langgraph_node_log_string(
                            graph_component="main",
                            node_name="orchestrator",
                            node_start_time=node_start_time,
                        )
                    ],
                    clarification=clarification,
                    plan_of_record=plan_of_record,
                    remaining_time_budget=remaining_time_budget,
                )

        base_decision_prompt = get_dr_prompt_orchestration_templates(
            DRPromptPurpose.NEXT_STEP,
            DRTimeBudget.FAST,
            entity_types_string=all_entity_types,
            relationship_types_string=all_relationship_types,
            available_tools=state.available_tools,
        )
        decision_prompt = (
            base_decision_prompt.replace("---question---", question)
            .replace("---chat_history_string---", chat_history_string)
            .replace("---answer_history_string---", answer_history_string)
            .replace("---iteration_nr---", str(iteration_nr))
            .replace("---remaining_time_budget---", str(remaining_time_budget))
            .replace("---reasoning_result---", reasoning_result)
        )

        if remaining_time_budget > 0:
            if decision_prompt is None:
                raise ValueError("Decision prompt is required")
            try:
                orchestrator_action = invoke_llm_json(
                    llm=graph_config.tooling.primary_llm,
                    prompt=decision_prompt,
                    schema=OrchestratorDecisonsNoPlan,
                    timeout_override=35,
                    max_tokens=2500,
                )
                next_step = orchestrator_action.next_step
                query_path = next_step.tool
                query_list = [q for q in (next_step.questions or []) if q is not None]

                tool_calls_string = create_tool_call_string(query_path, query_list)

            except Exception as e:
                logger.error(f"Error in approach extraction: {e}")
                raise e

            remaining_time_budget = (
                remaining_time_budget - AVERAGE_TOOL_COSTS[query_path]
            )
    else:
        if iteration_nr == 1 and not plan_of_record:
            # by default, we start a new iteration, but if there is a feedback request,
            # we start a new iteration 0 again (set a bit later)

            remaining_time_budget = DR_TIME_BUDGET_BY_TYPE[DRTimeBudget.DEEP]

            base_plan_prompt = get_dr_prompt_orchestration_templates(
                DRPromptPurpose.PLAN,
                DRTimeBudget.DEEP,
                entity_types_string=all_entity_types,
                relationship_types_string=all_relationship_types,
                available_tools=state.available_tools,
            )
            plan_generation_prompt = base_plan_prompt.replace(
                "---question---", prompt_question
            ).replace("---chat_history_string---", chat_history_string)

            try:
                plan_of_record = invoke_llm_json(
                    llm=graph_config.tooling.primary_llm,
                    prompt=plan_generation_prompt,
                    schema=OrchestrationPlan,
                    timeout_override=25,
                    max_tokens=3000,
                )
            except Exception as e:
                logger.error(f"Error in plan generation: {e}")
                raise

            write_custom_event(
                "basic_response",
                AgentAnswerPiece(
                    answer_piece=f"{HIGH_LEVEL_PLAN_PREFIX} {plan_of_record.plan}\n\n",
                    level=0,
                    level_question_num=0,
                    answer_type="agent_level_answer",
                ),
                writer,
            )

        if not plan_of_record:
            raise ValueError(
                "Plan information is required for iterative decision making"
            )

        base_decision_prompt = get_dr_prompt_orchestration_templates(
            DRPromptPurpose.NEXT_STEP,
            DRTimeBudget.DEEP,
            entity_types_string=all_entity_types,
            relationship_types_string=all_relationship_types,
            available_tools=state.available_tools,
        )
        decision_prompt = (
            base_decision_prompt.replace(
                "---answer_history_string---", answer_history_string
            )
            .replace("---question_history_string---", question_history_string)
            .replace("---question---", prompt_question)
            .replace("---iteration_nr---", str(iteration_nr))
            .replace("---current_plan_of_record_string---", plan_of_record.plan)
            .replace("---chat_history_string---", chat_history_string)
            .replace("---remaining_time_budget---", str(remaining_time_budget))
            .replace("---gaps---", gaps_str)
        )

        if remaining_time_budget > 0:
            if decision_prompt is None:
                raise ValueError("Decision prompt is required")
            try:
                orchestrator_action = invoke_llm_json(
                    llm=graph_config.tooling.primary_llm,
                    prompt=decision_prompt,
                    schema=OrchestratorDecisonsNoPlan,
                    timeout_override=15,
                    max_tokens=1500,
                )
                next_step = orchestrator_action.next_step
                query_path = next_step.tool
                query_list = [q for q in (next_step.questions or []) if q is not None]
                reasoning_result = orchestrator_action.reasoning

                tool_calls_string = create_tool_call_string(query_path, query_list)
            except Exception as e:
                logger.error(f"Error in approach extraction: {e}")
                raise e

            remaining_time_budget = (
                remaining_time_budget - AVERAGE_TOOL_COSTS[query_path]
            )

    orchestration_next_step_purpose_prompt = (
        ORCHESTRATOR_NEXT_STEP_PURPOSE_PROMPT.replace("---question---", prompt_question)
        .replace("---reasoning_result---", reasoning_result)
        .replace("---tool_calls---", tool_calls_string)
    )

    purpose_tokens: list[str] = [""]

    # Write short purpose
    write_custom_event(
        "basic_response",
        AgentAnswerPiece(
            answer_piece=f"\n\n\nITERATION {iteration_nr}:\n\n\n",
            level=0,
            level_question_num=0,
            answer_type="agent_level_answer",
        ),
        writer,
    )

    try:
        purpose_tokens, _ = run_with_timeout(
            80,
            lambda: stream_llm_answer(
                llm=graph_config.tooling.primary_llm,
                prompt=orchestration_next_step_purpose_prompt,
                event_name="basic_response",
                writer=writer,
                agent_answer_level=0,
                agent_answer_question_num=0,
                agent_answer_type="agent_level_answer",
                timeout_override=60,
                max_tokens=None,
            ),
        )
    except Exception as e:
        logger.error(f"Error in orchestration next step purpose: {e}")
        raise e

    cast(str, merge_content(*purpose_tokens))

    return OrchestrationUpdate(
        query_path=[query_path],
        query_list=query_list or [],
        iteration_nr=iteration_nr,
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="main",
                node_name="orchestrator",
                node_start_time=node_start_time,
            )
        ],
        clarification=clarification,
        plan_of_record=plan_of_record,
        remaining_time_budget=remaining_time_budget,
    )
