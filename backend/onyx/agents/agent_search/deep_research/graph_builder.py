import random
from datetime import datetime
from json import JSONDecodeError

from langchain_core.messages import AIMessage
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END
from langgraph.graph import START
from langgraph.graph import StateGraph
from langgraph.types import Send

from onyx.agents.agent_search.deep_research.configuration import Configuration
from onyx.agents.agent_search.deep_research.prompts import answer_instructions
from onyx.agents.agent_search.deep_research.prompts import get_current_date
from onyx.agents.agent_search.deep_research.prompts import onyx_searcher_instructions
from onyx.agents.agent_search.deep_research.prompts import query_writer_instructions
from onyx.agents.agent_search.deep_research.prompts import reflection_instructions
from onyx.agents.agent_search.deep_research.states import DeepResearchInput
from onyx.agents.agent_search.deep_research.states import OverallState
from onyx.agents.agent_search.deep_research.states import QueryGenerationState
from onyx.agents.agent_search.deep_research.states import ReflectionState
from onyx.agents.agent_search.deep_research.states import WebSearchState
from onyx.agents.agent_search.deep_research.tools_and_schemas import json_to_pydantic
from onyx.agents.agent_search.deep_research.tools_and_schemas import Reflection
from onyx.agents.agent_search.deep_research.tools_and_schemas import SearchQueryList
from onyx.agents.agent_search.deep_research.utils import collate_messages
from onyx.llm.factory import get_default_llms
from onyx.utils.logger import setup_logger

logger = setup_logger()

test_mode = False


def do_onyx_search(query: str) -> str:
    random_answers = [
        "Onyx is a startup founded by Yuhong Sun and Chris Weaver.",
        "Chris Weaver was born in the country of Wakanda",
        "Yuhong Sun is the CEO of Onyx",
        "Yuhong Sun was born in the country of Valhalla",
    ]
    return {"text": random.choice(random_answers)}


def generate_query(state: OverallState, config: RunnableConfig) -> QueryGenerationState:
    """
    LangGraph node that generates a search queries based on the User's question.

    Uses an LLM to create an optimized search query for onyx research based on
    the User's question.

    Args:
        state: Current graph state containing the User's question
        config: Configuration for the runnable

    Returns:
        Dictionary with state update, including search_query key containing the generated query
    """
    configurable = Configuration.from_runnable_config(config)

    # check for custom initial search query count
    if state.get("initial_search_query_count") is None:
        state["initial_search_query_count"] = configurable.number_of_initial_queries

    primary_llm, fast_llm = get_default_llms()
    llm = primary_llm if configurable.query_generator_model == "primary" else fast_llm

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = query_writer_instructions.format(
        current_date=current_date,
        research_topic=collate_messages(state["messages"]),
        number_queries=state["initial_search_query_count"],
    )

    # Get the LLM response and extract its content
    llm_response = llm.invoke(formatted_prompt)
    try:
        result = json_to_pydantic(llm_response.content, SearchQueryList)
        return {"query_list": result.query}
    except JSONDecodeError:
        return {"query_list": [llm_response.content]}


def continue_to_onyx_research(state: QueryGenerationState) -> OverallState:
    """
    LangGraph node that sends the search queries to the onyx research node.

    This is used to spawn n number of onyx research nodes, one for each search query.
    """
    return [
        Send("onyx_research", {"search_query": search_query, "id": int(idx)})
        for idx, search_query in enumerate(state["query_list"])
    ]


def onyx_research(state: WebSearchState, config: RunnableConfig) -> OverallState:
    """LangGraph node that performs onyx research using onyx search interface.

    Executes an onyx search in combination with an llm.

    Args:
        state: Current graph state containing the search query and research loop count
        config: Configuration for the runnable, including any search API settings or llm settings

    Returns:
        Dictionary with state update, including sources_gathered, research_loop_count, and web_research_results
    """
    formatted_prompt = onyx_searcher_instructions.format(
        current_date=get_current_date(),
        research_topic=state["search_query"],
    )

    # TODO: think about whether we should use any filtered returned results in addition to the final text answer
    response = do_onyx_search(formatted_prompt)

    text = response["text"]
    sources_gathered = []

    return {
        "sources_gathered": sources_gathered,
        "search_query": [state["search_query"]],
        "onyx_research_result": [text],
    }


def reflection(state: OverallState, config: RunnableConfig) -> ReflectionState:
    """LangGraph node that identifies knowledge gaps and generates potential follow-up queries.

    Analyzes the current summary to identify areas for further research and generates
    potential follow-up queries. Uses structured output to extract
    the follow-up query in JSON format.

    Args:
        state: Current graph state containing the running summary and research topic
        config: Configuration for the runnable, including LLM settings

    Returns:
        Dictionary with state update, including search_query key containing the generated follow-up query
    """
    configurable = Configuration.from_runnable_config(config)
    # Increment the research loop count and get the reasoning model
    state["research_loop_count"] = state.get("research_loop_count", 0) + 1
    # TODO: maybe do time checking here?

    # Format the prompt
    # First, collate the messages to give a historical context of the current conversation
    # Then, produce a concatenation of the onyx research results
    # Then, pass this to the reflection instructions
    # Then, the LLM will produce a JSON response with the following fields:
    # - is_sufficient: boolean indicating if the research is sufficient
    # - knowledge_gap: string describing the knowledge gap
    # - follow_up_queries: list of follow-up queries
    current_date = get_current_date()
    formatted_prompt = reflection_instructions.format(
        current_date=current_date,
        research_topic=collate_messages(state["messages"]),
        summaries="\n\n---\n\n".join(state["onyx_research_result"]),
    )

    # Get result from LLM
    primary_llm, fast_llm = get_default_llms()
    llm = primary_llm if configurable.reflection_model == "primary" else fast_llm
    result = json_to_pydantic(llm.invoke(formatted_prompt).content, Reflection)

    # TODO: convert to pydantic here
    return {
        "is_sufficient": result.is_sufficient,
        "knowledge_gap": result.knowledge_gap,
        "follow_up_queries": result.follow_up_queries,
        "research_loop_count": state["research_loop_count"],
        "number_of_ran_queries": len(state["search_query"]),
    }


def evaluate_research(
    state: ReflectionState,
    config: RunnableConfig,
) -> OverallState:
    """LangGraph routing function that determines the next step in the research flow.

    Controls the research loop by deciding whether to continue gathering information
    or to finalize the summary based on the configured maximum number of research loops.

    Args:
        state: Current graph state containing the research loop count
        config: Configuration for the runnable, including max_research_loops setting

    Returns:
        String literal indicating the next node to visit ("onyx_research" or "finalize_summary")
    """
    configurable = Configuration.from_runnable_config(config)
    max_research_loops = (
        state.get("max_research_loops")
        if state.get("max_research_loops") is not None
        else configurable.max_research_loops
    )
    if state["is_sufficient"] or state["research_loop_count"] >= max_research_loops:
        return "finalize_answer"
    else:
        return [
            Send(
                "onyx_research",
                {
                    "search_query": follow_up_query,
                    "id": state["number_of_ran_queries"] + int(idx),
                },
            )
            for idx, follow_up_query in enumerate(state["follow_up_queries"])
        ]


def finalize_answer(state: OverallState, config: RunnableConfig):
    """LangGraph node that finalizes the research summary.

    Prepares the final result based on the onyx research results.

    Args:
        state: Current graph state containing the running summary and sources gathered

    Returns:
        Dictionary with state update, including running_summary key containing the formatted final summary with sources
    """
    configurable = Configuration.from_runnable_config(config)
    answer_model = state.get("answer_model") or configurable.answer_model

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = answer_instructions.format(
        current_date=current_date,
        research_topic=collate_messages(state["messages"]),
        summaries="\n---\n\n".join(state["onyx_research_result"]),
    )

    # get the LLM to generate the final answer
    primary_llm, fast_llm = get_default_llms()
    llm = primary_llm if answer_model == "primary" else fast_llm
    result = llm.invoke(formatted_prompt)
    unique_sources = []
    return {
        "messages": [AIMessage(content=result.content)],
        "sources_gathered": unique_sources,
    }


def deep_research_graph_builder(test_mode: bool = False) -> StateGraph:
    """
    LangGraph graph builder for deep research process.
    """

    graph = StateGraph(
        OverallState,
        config_schema=Configuration,
    )

    ### Add nodes ###

    graph.add_node("generate_query", generate_query)
    graph.add_node("onyx_research", onyx_research)
    graph.add_node("reflection", reflection)
    graph.add_node("finalize_answer", finalize_answer)

    # Set the entrypoint as `generate_query`
    graph.add_edge(START, "generate_query")
    # Add conditional edge to continue with search queries in a parallel branch
    graph.add_conditional_edges(
        "generate_query", continue_to_onyx_research, ["onyx_research"]
    )
    # Reflect on the onyx research
    graph.add_edge("onyx_research", "reflection")
    # Evaluate the research
    graph.add_conditional_edges(
        "reflection", evaluate_research, ["onyx_research", "finalize_answer"]
    )
    # Finalize the answer
    graph.add_edge("finalize_answer", END)

    return graph


if __name__ == "__main__":
    # Initialize the SQLAlchemy engine first
    from onyx.db.engine import SqlEngine

    SqlEngine.init_engine(
        pool_size=5,  # You can adjust these values based on your needs
        max_overflow=10,
        app_name="graph_builder",
    )

    query_start_time = datetime.now()
    logger.debug(f"Start at {query_start_time}")
    graph = deep_research_graph_builder()
    compiled_graph = graph.compile()
    query_end_time = datetime.now()
    logger.debug(f"Graph compiled in {query_end_time - query_start_time} seconds")

    queries = [
        "What is the capital of France?",
        "What is Onyx?",
        "Who are the founders of Onyx?",
        "Who is the CEO of Onyx?",
        "Where was the CEO of Onyx born?",
    ]

    # Create the input state using DeepResearchInput
    input_state = DeepResearchInput(log_messages=[])

    for query in queries:
        # Create the initial state with all required fields
        initial_state = {
            "messages": [HumanMessage(content=query)],
            "search_query": [],
            "onyx_research_result": [],
            "sources_gathered": [],
            "initial_search_query_count": 3,  # Default value from Configuration
            "max_research_loops": 10,  # Default value from Configuration
            "research_loop_count": 0,
            "reasoning_model": "primary",
        }

        result = compiled_graph.invoke(initial_state)
        print("Question: ", query)
        print("Answer: ", result["messages"][-1].content)
        # print(result)
        print("Max research loops: ", result["max_research_loops"])
        print("Research loop count: ", result["research_loop_count"])
        print("Search query: ", result["search_query"])
        print("Onyx research result: ", result["onyx_research_result"])
        print("--------------------------------")
        # from pdb import set_trace; set_trace()
