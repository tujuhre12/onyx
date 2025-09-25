from typing import cast

from agents import function_tool
from agents import RunContextWrapper

from onyx.chat.turn.models import MyContext
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.tools.models import SearchToolOverrideKwargs
from onyx.tools.tool_implementations.search.search_tool import (
    SEARCH_RESPONSE_SUMMARY_ID,
)
from onyx.tools.tool_implementations.search.search_tool import SearchResponseSummary


@function_tool
def internal_search(context_wrapper: RunContextWrapper[MyContext], query: str) -> str:
    """
    Search the internal knowledge base and documents.

    Use this tool when the answer is likely stored in private or company
    documents rather than on the public web. It returns snippets, titles,
    and links to relevant internal files.

    Args:
        query: The natural-language search query.
    """
    context_wrapper.context.run_dependencies.emitter.emit(
        kind="tool-progress", data={"query": query}
    )
    search_tool = context_wrapper.context.run_dependencies.search_tool
    if search_tool is None:
        raise RuntimeError("Search tool not available in context")

    with get_session_with_current_tenant() as search_db_session:
        for tool_response in search_tool.run(
            query=query,
            override_kwargs=SearchToolOverrideKwargs(
                force_no_rerank=True,
                alternate_db_session=search_db_session,
                skip_query_analysis=True,
                original_query=query,
            ),
        ):
            # get retrieved docs to send to the rest of the graph
            if tool_response.id == SEARCH_RESPONSE_SUMMARY_ID:
                response = cast(SearchResponseSummary, tool_response.response)
                retrieved_docs = response.top_sections

                break
    return retrieved_docs
