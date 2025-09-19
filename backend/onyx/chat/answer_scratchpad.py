from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Generator
from typing import Any
from typing import Dict
from typing import List

import litellm
from agents import Agent
from agents import function_tool
from agents import ModelSettings
from agents import Runner
from agents.extensions.models.litellm_model import LitellmModel
from braintrust import traced

from onyx.agents.agent_search.dr.sub_agents.web_search.clients.exa_client import (
    ExaClient,
)
from onyx.agents.agent_search.models import GraphConfig
from onyx.llm.interfaces import (
    LLM,
)  # sync call that supports stream=True with an iterator


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
) -> Dict[str, Any]:
    return litellm.completion(
        model=model_name,
        temperature=temperature,
        messages=messages,
        tools=tools,
        stream=stream,
    )


async def stream_chat_async(
    messages: List[Dict[str, Any]], cfg: GraphConfig, llm: LLM
) -> Generator[Dict[str, Any], None, None]:
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

    # Create agent with tools
    agent = Agent(
        name="Assistant",
        instructions="You are a helpful assistant that can search the web and fetch content from URLs.",
        model=litellm_model,
        tools=[web_search, web_fetch, reasoning],
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
        # Run the agent with timeout
        result = await asyncio.wait_for(Runner.run(agent, user_message), timeout=200)

        # Stream the final output
        if result.final_output:
            yield {"type": "delta", "text": result.final_output}

    except asyncio.TimeoutError:
        yield {"type": "delta", "text": "\n[Timed out while composing reply]"}
    except Exception as e:
        yield {"type": "delta", "text": f"\n[Error: {str(e)}]"}

    yield {"type": "final"}


def stream_chat_sync(
    messages: List[Dict[str, Any]], cfg: GraphConfig, llm: LLM
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
        # Run the async generator
        async_gen = stream_chat_async(messages, cfg, llm)

        # Convert async generator to sync generator
        while True:
            try:
                # Get the next item from the async generator
                item = loop.run_until_complete(async_gen.__anext__())
                yield item
            except StopAsyncIteration:
                break
    finally:
        loop.close()
