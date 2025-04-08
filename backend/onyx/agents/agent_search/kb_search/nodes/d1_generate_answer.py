from datetime import datetime
from typing import cast

from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.kb_search.states import MainOutput
from onyx.agents.agent_search.kb_search.states import MainState
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.utils import (
    dispatch_main_answer_stop_info,
)
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.agents.agent_search.shared_graph_utils.utils import write_custom_event
from onyx.chat.models import AgentAnswerPiece
from onyx.chat.models import StreamStopInfo
from onyx.chat.models import StreamStopReason
from onyx.chat.models import StreamType
from onyx.prompts.kg_prompts import OUTPUT_FORMAT_NO_EXAMPLES_PROMPT
from onyx.prompts.kg_prompts import OUTPUT_FORMAT_PROMPT
from onyx.utils.logger import setup_logger
from onyx.utils.threadpool_concurrency import run_with_timeout

logger = setup_logger()


def generate_answer(
    state: MainState, config: RunnableConfig, writer: StreamWriter = lambda _: None
) -> MainOutput:
    """
    LangGraph node to start the agentic search process.
    """
    node_start_time = datetime.now()

    graph_config = cast(GraphConfig, config["metadata"]["config"])
    question = graph_config.inputs.search_request.query
    state.entities_types_str
    query_results_data_str = state.query_results_data_str
    state.reference_results
    search_tool = graph_config.tooling.search_tool
    if search_tool is None:
        raise ValueError("Search tool is not set")

    question = graph_config.inputs.search_request.query
    state.entities_types_str
    state.query_results
    output_format = state.output_format
    if state.reference_results:
        examples = (
            state.reference_results.citations
            or state.reference_results.general_entities
            or []
        )
        example_str = "\n".join([f"- {example}" for example in examples])
    else:
        example_str = ""

    # if reference_results and reference_results.citations:
    #     aaa = yield_search_responses(
    #         query=question,
    #         get_retrieved_sections=lambda: reference_results.citations,
    #         get_final_context_sections=lambda: reference_results.citations[:10],
    #         search_query_info=SearchQueryInfo(
    #         predicted_search=SearchType.SEMANTIC,
    #         final_filters=IndexFilters(access_control_list=None),
    #         recency_bias_multiplier=1.0,
    #     ),
    #     get_section_relevance=lambda: None,
    #     search_tool=search_tool,
    # )

    #     for aa in aaa:
    #         write_custom_event(
    #             "tool_response",
    #             ToolResponse(
    #                 id=SEARCH_RESPONSE_SUMMARY_ID,
    #                 response=aa,
    #             ),
    #             writer,
    #         )

    assert query_results_data_str is not None

    if example_str:
        output_format_prompt = (
            OUTPUT_FORMAT_PROMPT.replace("---question---", question)
            .replace("---results_data_str---", query_results_data_str)
            .replace("---output_format---", str(output_format) if output_format else "")
            .replace("---examples---", example_str)
        )

    else:
        output_format_prompt = (
            OUTPUT_FORMAT_NO_EXAMPLES_PROMPT.replace("---question---", question)
            .replace("---results_data_str---", query_results_data_str)
            .replace("---output_format---", str(output_format) if output_format else "")
        )

    msg = [
        HumanMessage(
            content=output_format_prompt,
        )
    ]
    fast_llm = graph_config.tooling.fast_llm
    dispatch_timings: list[float] = []
    response: list[str] = []

    def stream_answer() -> list[str]:
        for message in fast_llm.stream(
            prompt=msg,
            timeout_override=30,
            max_tokens=300,
        ):
            # TODO: in principle, the answer here COULD contain images, but we don't support that yet
            content = message.content
            if not isinstance(content, str):
                raise ValueError(
                    f"Expected content to be a string, but got {type(content)}"
                )
            start_stream_token = datetime.now()
            write_custom_event(
                "initial_agent_answer",
                AgentAnswerPiece(
                    answer_piece=content,
                    level=0,
                    level_question_num=0,
                    answer_type="agent_level_answer",
                ),
                writer,
            )
            logger.debug(f"Answer piece: {content}")
            end_stream_token = datetime.now()
            dispatch_timings.append(
                (end_stream_token - start_stream_token).microseconds
            )
            response.append(content)
        return response

    try:
        response = run_with_timeout(
            30,
            stream_answer,
        )

    except Exception as e:
        raise ValueError(f"Could not generate the answer. Error {e}")

    stop_event = StreamStopInfo(
        stop_reason=StreamStopReason.FINISHED,
        stream_type=StreamType.SUB_ANSWER,
        level=0,
        level_question_num=0,
    )
    write_custom_event("stream_finished", stop_event, writer)

    dispatch_main_answer_stop_info(0, writer)

    return MainOutput(
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="main",
                node_name="query completed",
                node_start_time=node_start_time,
            )
        ],
    )
