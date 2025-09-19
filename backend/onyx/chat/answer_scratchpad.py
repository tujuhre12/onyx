from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncGenerator
from collections.abc import Generator
from dataclasses import dataclass
from typing import Any
from typing import cast
from typing import Dict
from typing import List

import litellm
from agents import Agent
from agents import function_tool
from agents import ModelSettings
from agents import RunContextWrapper
from agents import Runner
from agents.extensions.models.litellm_model import LitellmModel
from braintrust import traced

from onyx.agents.agent_search.dr.sub_agents.web_search.clients.exa_client import (
    ExaClient,
)
from onyx.agents.agent_search.models import GraphConfig
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.llm.interfaces import (
    LLM,
)
from onyx.tools.models import SearchToolOverrideKwargs
from onyx.tools.tool_implementations.search.search_tool import (
    SEARCH_RESPONSE_SUMMARY_ID,
)
from onyx.tools.tool_implementations.search.search_tool import SearchResponseSummary
from onyx.tools.tool_implementations.search.search_tool import SearchTool


@dataclass
class MyContext:
    """Context class to hold search tool and other dependencies"""

    search_tool: SearchTool | None = None


def short_tag(link: str, i: int) -> str:
    # Stable, readable; index keeps it deterministic across a batch
    return f"S{i+1}"


@function_tool
@traced(name="web_search")
def web_search(query: str) -> str:
    """Search the web for information. This tool provides urls and short snippets,
    but does not fetch the full content of the urls."""
    exa_client = ExaClient()
    hits = exa_client.search(query)
    results = []
    for i, r in enumerate(hits):
        results.append(
            {
                "tag": short_tag(r.link, i),  # <-- add a tag
                "title": r.title,
                "link": r.link,
                "snippet": r.snippet,
                "author": r.author,
                "published_date": (
                    r.published_date.isoformat() if r.published_date else None
                ),
            }
        )
    return json.dumps({"results": results})


@function_tool
@traced(name="web_fetch")
def web_fetch(urls: List[str]) -> str:
    """Fetch the full contents of a list of URLs."""
    exa_client = ExaClient()
    docs = exa_client.contents(urls)
    out = []
    for i, d in enumerate(docs):
        out.append(
            {
                "tag": short_tag(d.link, i),  # <-- add a tag
                "title": d.title,
                "link": d.link,
                "full_content": d.full_content,
                "published_date": (
                    d.published_date.isoformat() if d.published_date else None
                ),
            }
        )
    return json.dumps({"results": out})


@function_tool
@traced(name="reasoning")
def reasoning() -> str:
    """Use this tool for reasoning. Powerful for complex questions and
    tasks, or questions that require multiple steps to answer."""
    # Note: This is a simplified version. In the full implementation,
    # we would need to pass the context through the agent's context system
    return (
        "Reasoning tool - this would need to be implemented with proper context access"
    )


@traced(name="llm_completion", type="llm")
def llm_completion(
    model_name: str,
    temperature: float,
    messages: List[Dict[str, Any]],
    tools: List[Dict[str, Any]],
    stream: bool = False,
) -> Any:
    return litellm.completion(
        model=model_name,
        temperature=temperature,
        messages=messages,
        tools=tools,
        stream=stream,
    )


@function_tool
@traced(name="internal_search")
def internal_search(context_wrapper: RunContextWrapper[MyContext], query: str) -> str:
    """Search internal company vector database for information. Sources
    include:
    - Fireflies (internal company call transcripts)
    - Google Drive (internal company documents)
    - Gmail (internal company emails)
    - Linear (internal company issues)
    - Slack (internal company messages)
    """
    search_tool = context_wrapper.context.search_tool
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


async def stream_chat_async(
    messages: List[Dict[str, Any]],
    cfg: GraphConfig,
    llm: LLM,
    search_tool: SearchTool,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Yields events suitable for SSE/WebSocket using OpenAI Agents framework:
      {"type":"delta","text": "..."}         -> stream to user
      {"type":"tool","name":..., "args":..., "private": bool}
      {"type":"final"}
    """
    time.time()

    # Create LiteLLM model for OpenAI Agents
    litellm_model = LitellmModel(
        model=llm.config.model_name,
        api_key=llm.config.api_key,
    )

    # Get the search tool from config
    search_tool = cfg.tooling.search_tool

    # Create context with search tool
    context = MyContext(search_tool=search_tool)

    # Create agent with tools
    agent = Agent(
        name="Assistant",
        instructions="""
        You are a helpful assistant that can search the web, fetch content from URLs,
        and search internal databases.
        """,
        model=litellm_model,
        tools=[web_search, web_fetch, reasoning, internal_search],
        model_settings=ModelSettings(
            temperature=llm.config.temperature,
            include_usage=True,  # Track usage metrics
        ),
    )

    # Convert messages to a single user message for the agent
    user_message = ""
    for msg in messages:
        if msg.get("role") == "user":
            user_message += msg.get("content", "")
        elif msg.get("role") == "assistant":
            user_message += f"\nAssistant: {msg.get('content', '')}"

    try:
        # Run the agent with timeout and context
        result = await asyncio.wait_for(
            Runner.run(agent, user_message, context=context), timeout=200
        )

        # Stream the final output
        if result.final_output:
            yield {"type": "delta", "text": result.final_output}

    except asyncio.TimeoutError:
        yield {"type": "delta", "text": "\n[Timed out while composing reply]"}
    except Exception as e:
        yield {"type": "delta", "text": f"\n[Error: {str(e)}]"}

    yield {"type": "final"}


def stream_chat_sync(
    messages: List[Dict[str, Any]],
    cfg: GraphConfig,
    llm: LLM,
    search_tool: SearchTool,
) -> Generator[Dict[str, Any], None, None]:
    """
    Synchronous wrapper for the async streaming function.
    Yields events suitable for SSE/WebSocket:
      {"type":"delta","text": "..."}         -> stream to user
      {"type":"tool","name":..., "args":..., "private": bool}
      {"type":"final"}
    """
    # Create a new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        # Run the async generator and collect all items
        async def collect_all_items():
            items = []
            async for item in stream_chat_async(messages, cfg, llm, search_tool):
                items.append(item)
            return items

        # Get all items from async generator
        items = loop.run_until_complete(collect_all_items())
        for item in items:
            yield item
    finally:
        loop.close()
