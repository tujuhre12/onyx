from __future__ import annotations

import json
import time
from collections.abc import Callable
from collections.abc import Generator
from typing import Any
from typing import Dict
from typing import List

import litellm

from onyx.agents.agent_search.dr.sub_agents.web_search.clients.exa_client import (
    ExaClient,
)
from onyx.agents.agent_search.models import GraphConfig
from onyx.llm.interfaces import (
    LLM,
)  # sync call that supports stream=True with an iterator

# ---------- Tool registry (sync) ----------


class ToolSpec:
    def __init__(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        func: Callable[..., Any],
        private: bool = False,
    ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.func = func
        self.private = private


TOOL_REGISTRY: Dict[str, ToolSpec] = {}


def short_tag(link: str, i: int) -> str:
    # Stable, readable; index keeps it deterministic across a batch
    return f"S{i+1}"


def register_tool(spec: ToolSpec) -> None:
    if spec.name in TOOL_REGISTRY:
        raise ValueError(f"Tool {spec.name} already registered")
    TOOL_REGISTRY[spec.name] = spec


# Example tool
def web_search(query: str, outer_ctx: Dict[str, Any]) -> Dict[str, Any]:
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
    return {"results": results}


register_tool(
    ToolSpec(
        name="web_search",
        description="Search the web for information.",
        parameters={
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
        func=web_search,
    )
)


def web_fetch(urls: List[str], outer_ctx: Dict[str, Any]) -> Dict[str, Any]:
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
    return {"results": out}


register_tool(
    ToolSpec(
        name="web_fetch",
        description="Fetch the contents of a list of URLs.",
        parameters={
            "type": "object",
            "properties": {"urls": {"type": "array", "items": {"type": "string"}}},
            "required": ["urls"],
        },
        func=web_fetch,
    )
)


def reasoning(outer_ctx: Dict[str, Any]) -> Dict[str, Any]:
    PRIVATE_SCRATCHPAD_SYS = (
        "You are writing PRIVATE scratch notes for yourself. "
        "These notes will NOT be shown to the user. "
        "Do NOT copy these notes verbatim into the final answer. "
        "Use them to plan, compute, and create structured intermediate results."
    )
    messages = outer_ctx["messages"]
    llm = outer_ctx["model"]
    revised_messages = [
        {"role": "system", "content": PRIVATE_SCRATCHPAD_SYS},
    ] + messages[1:]
    results = litellm.completion(
        model=llm.config.model_name,
        temperature=llm.config.temperature,
        messages=revised_messages,
    )
    return {"results": results["choices"][0]["message"]["content"]}


register_tool(
    ToolSpec(
        name="reasoning",
        description="Reason about the message history and the goal.",
        parameters={"type": "object", "properties": {}, "required": []},
        func=reasoning,
    )
)


def tool_specs_for_openai() -> List[Dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            },
        }
        for t in TOOL_REGISTRY.values()
    ]


def run_tool_sync(
    name: str, args: Dict[str, Any], outer_ctx: Dict[str, Any]
) -> Dict[str, Any]:
    spec = TOOL_REGISTRY[name]
    try:
        result = spec.func(**args, outer_ctx=outer_ctx)
    except TypeError as e:
        result = {"ok": False, "error": f"Bad arguments: {e}"}
    except Exception as e:
        result = {"ok": False, "error": str(e)}
    return {"name": name, "private": spec.private, "result": result}


def stream_chat_sync(
    messages: List[Dict[str, Any]], cfg: GraphConfig, llm: LLM
) -> Generator[Dict[str, Any], None, None]:
    """
    Yields events suitable for SSE/WebSocket:
      {"type":"delta","text": "..."}         -> stream to user
      {"type":"tool","name":..., "args":..., "private": bool}
      {"type":"final"}
    """
    start = time.time()
    tools_decl = tool_specs_for_openai()
    tool_step = 0

    while True:
        if time.time() - start > 200:
            yield {"type": "delta", "text": "\n[Timed out while composing reply]"}
            break
        # Start a streaming completion (sync iterator of deltas)
        stream_iter = litellm.completion(
            model=llm.config.model_name,
            temperature=llm.config.temperature,
            messages=messages,
            tools=tools_decl,
            stream=True,  # iterator of chunks
        )

        # Accumulate assistant text & tool call chunks
        assistant_text_parts: List[str] = []
        tool_calls_accum: List[Dict[str, Any]] = []  # indexed by tool call index

        for chunk in stream_iter:
            choice = chunk.choices[0]
            delta = getattr(choice, "delta", getattr(choice, "message", None))

            # 1) Text deltas
            content_piece = getattr(delta, "content", None)
            if content_piece:
                assistant_text_parts.append(content_piece)
                yield {"type": "delta", "text": content_piece}

            # 2) Tool call deltas (arrive chunked)
            tcs = getattr(delta, "tool_calls", None)
            if tcs:
                for tc in tcs:
                    if tc.get("type") != "function":
                        continue
                    idx = tc.get("index", 0)
                    while len(tool_calls_accum) <= idx:
                        tool_calls_accum.append(
                            {"id": None, "fn": {"name": "", "arguments": ""}}
                        )
                        buf = tool_calls_accum[idx]
                    if tc.get("id"):
                        buf["id"] = tc["id"]
                    fn = tc.get("function", {})
                    if fn.get("name"):
                        buf["fn"]["name"] = fn["name"]
                    if fn.get("arguments"):
                        buf["fn"]["arguments"] += fn["arguments"]

        # Finalize assistant message for this turn
        assistant_text = "".join(assistant_text_parts).strip()
        assistant_msg: Dict[str, Any] = {"role": "assistant", "content": assistant_text}
        if tool_calls_accum:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["fn"]["name"],
                        "arguments": tc["fn"]["arguments"],
                    },
                }
                for tc in tool_calls_accum
            ]
        messages.append(assistant_msg)

        # If we have tool calls and haven’t exceeded step cap, execute and loop again
        if tool_calls_accum and tool_step < 10:
            tool_step += 1
            for tc in tool_calls_accum:
                name = tc["fn"]["name"]
                try:
                    args = json.loads(tc["fn"]["arguments"] or "{}")
                except json.JSONDecodeError:
                    args = {"raw": tc["fn"]["arguments"]}

                # Surface tool activity to UI (don’t stream private payloads)
                yield {
                    "type": "tool",
                    "name": name,
                    "args": args,
                    "private": TOOL_REGISTRY[name].private,
                }

                outer_ctx = {
                    "model": llm,
                    "messages": messages,
                    "cfg": cfg,
                }
                tool_result = run_tool_sync(name, args, outer_ctx)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "name": name,
                        "content": [
                            {"type": "text", "text": json.dumps(result)}
                            for result in tool_result["result"]["results"]
                        ],
                    }
                )

            # Loop: the model now sees tool outputs and will either answer or call more tools
            continue

        # No tools (final answer) or step cap reached
        break

    yield {"type": "final"}
