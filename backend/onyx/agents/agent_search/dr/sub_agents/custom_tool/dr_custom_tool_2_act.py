from datetime import datetime
from typing import cast

from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.dr.models import GenericToolAnswer
from onyx.agents.agent_search.dr.models import IterationAnswer
from onyx.agents.agent_search.dr.states import AnswerUpdate
from onyx.agents.agent_search.dr.sub_agents.states import BranchInput
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.llm import invoke_llm_json
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.prompts.dr_prompts import CUSTOM_TOOL_USE_W_TOOL_CALLING_PROMPT
from onyx.tools.tool_implementations.custom.custom_tool import CUSTOM_TOOL_RESPONSE_ID
from onyx.tools.tool_implementations.custom.custom_tool import CustomTool
from onyx.tools.tool_implementations.custom.custom_tool import CustomToolCallSummary
from onyx.utils.logger import setup_logger

logger = setup_logger()


def custom_tool_act(
    state: BranchInput,
    config: RunnableConfig,
    writer: StreamWriter = lambda _: None,
) -> AnswerUpdate:
    """
    LangGraph node to perform a generic tool call as part of the DR process.
    """

    node_start_time = datetime.now()
    iteration_nr = state.iteration_nr
    parallelization_nr = state.parallelization_nr

    if not state.available_tools:
        raise ValueError("available_tools is not set")

    custom_tool_info = state.available_tools[state.tools_used[-1]]
    custom_tool_name = custom_tool_info.llm_path
    custom_tool = cast(CustomTool, custom_tool_info.tool_object)

    branch_query = state.branch_question
    if not branch_query:
        raise ValueError("branch_query is not set")

    graph_config = cast(GraphConfig, config["metadata"]["config"])
    base_question = graph_config.inputs.prompt_builder.raw_user_query

    logger.debug(
        f"Tool call start for {custom_tool_name} {iteration_nr}.{parallelization_nr} at {datetime.now()}"
    )

    # call tool and generate response
    if graph_config.tooling.using_tool_calling_llm:
        tool_use_prompt = CUSTOM_TOOL_USE_W_TOOL_CALLING_PROMPT.build(
            query=branch_query,
            base_question=base_question,
        )
        # TODO: this fails, probably can't use both structured response and tool calling
        tool_use_response = invoke_llm_json(
            llm=graph_config.tooling.primary_llm,
            prompt=tool_use_prompt,
            schema=GenericToolAnswer,
            timeout_override=40,
            # max_tokens=1500,
            tools=[custom_tool.tool_definition()],
            tool_choice="required",
        )
    else:
        # get tool args for non-tool-calling LLM
        tool_args = custom_tool.get_args_for_non_tool_calling_llm(
            query=branch_query,
            history=[],
            llm=graph_config.tooling.primary_llm,
            force_run=True,
        )
        if tool_args is None:
            raise ValueError("Failed to call custom tool")

        # call tool with args
        response: CustomToolCallSummary | None = None
        for tool_response in custom_tool.run(**tool_args):
            if tool_response.id == CUSTOM_TOOL_RESPONSE_ID:
                response = cast(CustomToolCallSummary, tool_response.response)
                break

        if not response:
            raise ValueError("Failed to call custom tool")

        # TODO: use response and generate GenericToolAnswer
        raise NotImplementedError("Not implemented")

    logger.debug(
        f"Tool call end for {custom_tool_name} {iteration_nr}.{parallelization_nr} at {datetime.now()}"
    )

    return AnswerUpdate(
        iteration_responses=[
            IterationAnswer(
                tool=custom_tool_name,
                tool_id=custom_tool_info.tool_id,
                iteration_nr=iteration_nr,
                parallelization_nr=parallelization_nr,
                question=branch_query,
                answer=tool_use_response.answer,
                claims=[],
                cited_documents={},
                reasoning=tool_use_response.reasoning,
                additional_data=None,
            )
        ],
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="custom_tool",
                node_name="tool_calling",
                node_start_time=node_start_time,
            )
        ],
    )
