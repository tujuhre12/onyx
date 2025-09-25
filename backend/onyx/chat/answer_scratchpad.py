from __future__ import annotations

import json
import os
from typing import Any
from typing import Dict
from typing import List
from typing import Optional

import litellm
from agents import Agent
from agents import AgentHooks
from agents import function_tool
from agents import ModelSettings
from agents import RunContextWrapper
from agents.extensions.handoff_prompt import prompt_with_handoff_instructions
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
from agents.extensions.models.litellm_model import LitellmModel
from agents.handoffs import HandoffInputData
from agents.stream_events import RawResponsesStreamEvent
from agents.stream_events import RunItemStreamEvent
from braintrust import traced
from openai.types import Reasoning
from pydantic import BaseModel

from onyx.agents.agent_search.dr.constants import MAX_CHAT_HISTORY_MESSAGES
from onyx.agents.agent_search.dr.dr_prompt_builder import (
    get_dr_prompt_orchestration_templates,
)
from onyx.agents.agent_search.dr.enums import ResearchType
from onyx.agents.agent_search.dr.models import DRPromptPurpose
from onyx.agents.agent_search.dr.utils import get_chat_history_string
from onyx.agents.agent_search.models import GraphConfig
from onyx.chat.turn import fast_chat_turn
from onyx.chat.turn.infra.chat_turn_event_stream import Emitter
from onyx.chat.turn.infra.chat_turn_event_stream import OnyxRunner
from onyx.chat.turn.infra.chat_turn_event_stream import RunDependencies
from onyx.chat.turn.models import MyContext
from onyx.llm.interfaces import (
    LLM,
)
from onyx.tools.built_in_tools import SearchTool
from onyx.tools.tool_implementations_v2.internal_search import internal_search
from onyx.tools.tool_implementations_v2.web import web_fetch
from onyx.tools.tool_implementations_v2.web import web_search
from onyx.utils.logger import setup_logger

logger = setup_logger()


@traced(name="llm_completion", type="llm")
def llm_completion(
    model_name: str,
    temperature: float,
    messages: List[Dict[str, Any]],
    stream: bool = False,
) -> litellm.ModelResponse:
    return litellm.responses(
        model=model_name,
        input=messages,
        tools=[],
        stream=stream,
        reasoning=litellm.Reasoning(effort="medium", summary="detailed"),
    )


class ResearchScratchpad(BaseModel):
    notes: List[dict] = []


scratchpad = ResearchScratchpad()


@function_tool
def add_note(note: str, source_url: str | None = None):
    """Store a factual note you want to cite later."""
    scratchpad.notes.append({"note": note, "source_url": source_url})
    return {"ok": True, "count": len(scratchpad.notes)}


@function_tool
def finalize_report():
    """Signal you're done researching. Return a structured, citation-rich report."""
    # The model should *compose* the report as the tool *result*, using notes in scratchpad.
    # Some teams have the model return the full report as this tool's return value
    # so the UI can detect completion cleanly.
    return {
        "status": "ready_to_render",
        "notes_index": scratchpad.notes,  # the model can read these to assemble citations
    }


class CompactionHooks(AgentHooks[Any]):
    async def on_llm_start(
        self,
        context: RunContextWrapper[MyContext],
        agent: Agent[Any],
        system_prompt: Optional[str],
        input_items: List[dict],
    ) -> None:
        print(f"[{agent.name}] LLM start")
        print("system_prompt:", system_prompt)
        print("usage so far:", context.usage.total_tokens)
        usage = context.usage.total_tokens
        if usage > 10000:
            context.context.needs_compaction = True


def compaction_input_filter(input_data: HandoffInputData):
    filtered_messages = []
    for msg in input_data.input_history[:-1]:
        if isinstance(msg, dict) and msg.get("content") is not None:
            # Convert tool messages to user messages to avoid API errors
            if msg.get("role") == "tool":
                filtered_msg = {
                    "role": "user",
                    "content": f"Tool response: {msg.get('content', '')}",
                }
                filtered_messages.append(filtered_msg)
            else:
                filtered_messages.append(msg)

    # Only proceed with compaction if we have valid messages
    if filtered_messages:
        return [filtered_messages[-1]]


def construct_deep_research_agent(llm: LLM) -> Agent:
    litellm_model = LitellmModel(
        # If you have access, prefer OpenAI’s deep research-capable models:
        # "o3-deep-research" or "o4-mini-deep-research"
        # otherwise keep your current model and lean on the prompt + tools
        model=llm.config.model_name,
        api_key=llm.config.api_key,
    )

    DR_INSTRUCTIONS = f"""
    {RECOMMENDED_PROMPT_PREFIX}
You are a deep-research agent. Work in explicit iterations:
1) PLAN: Decompose the user’s query into sub-questions and a step-by-step plan.
2) SEARCH: Use web_search to explore multiple angles, fanning out and searching in parallel.
3) FETCH: Use web_fetch for any promising URLs to extract specifics and quotes.
4) NOTE: After each useful find, call add_note(note, source_url) to save key facts.
5) REVISE: If evidence contradicts earlier assumptions, update your plan and continue.
6) FINALIZE: When confident, call finalize_report(). Your final answer must include:
   - Clear, structured conclusions
   - A short “How I searched” summary
   - Inline citations to sources (with URLs)
   - A bullet list of limitations/open questions
Guidelines:
- Prefer breadth-first exploration before deep dives.
- Compare sources and dates; prioritize recency for time-sensitive topics.
- Minimize redundancy by skimming before fetching.
- Think out loud in a compact way, but keep reasoning crisp.
- If context exceeds 10000 tokens, handoff to the compactor agent.
"""
    return Agent(
        name="Researcher",
        instructions=DR_INSTRUCTIONS,
        model=litellm_model,
        tools=[web_search, web_fetch, add_note, finalize_report, internal_search],
        model_settings=ModelSettings(
            temperature=llm.config.temperature,
            include_usage=True,
            parallel_tool_calls=True,
            # optional: let model choose tools freely
            # tool_choice="auto",  # if supported by your LitellmModel wrapper
        ),
        hooks=CompactionHooks(),
    )


def construct_simple_agent(
    llm: LLM,
) -> Agent:
    litellm_model = LitellmModel(
        model="o3-mini",
        api_key=llm.config.api_key,
    )
    return Agent(
        name="Assistant",
        instructions="""
        You are a helpful assistant that can search the web, fetch content from URLs,
        and search internal databases. Please do some reasoning and then return your answer.
        """,
        model=litellm_model,
        tools=[web_search, web_fetch, internal_search],
        model_settings=ModelSettings(
            temperature=0.0,
            include_usage=True,  # Track usage metrics
            reasoning=Reasoning(
                effort="medium", summary="detailed", generate_summary="detailed"
            ),
            verbose=True,
        ),
    )


def thread_worker_dr_turn(messages, cfg, llm, emitter, search_tool):
    """
    Worker function for deep research turn that runs in a separate thread.

    Args:
        messages: List of messages for the conversation
        cfg: Graph configuration
        llm: Language model instance
        emitter: Event emitter for streaming responses
        search_tool: Search tool instance (optional)
        eval_context: Evaluation context to be propagated to the worker thread
    """
    try:
        dr_turn(messages, cfg, llm, emitter, search_tool)
    except Exception as e:
        logger.error(f"Error in dr_turn: {e}", exc_info=e, stack_info=True)
        emitter.emit(kind="done", data={"ok": False})


def thread_worker_simple_turn(messages, cfg, llm, emitter, search_tool):
    try:
        fast_chat_turn.fast_chat_turn(
            messages=messages,
            dependencies=RunDependencies(
                emitter=emitter,
                llm=llm,
                search_tool=search_tool,
            ),
        )
    except Exception as e:
        logger.error(f"Error in simple_turn: {e}", exc_info=e, stack_info=True)
        emitter.emit(kind="done", data={"ok": False})


def dr_turn(
    messages: List[Dict[str, Any]],
    cfg: GraphConfig,
    llm: LLM,
    turn_event_stream_emitter: Emitter,  # TurnEventStream is the primary output of the turn
    search_tool: SearchTool,
) -> None:
    """
    Execute a deep research turn with evaluation context support.

    Args:
        messages: List of messages for the conversation
        cfg: Graph configuration
        llm: Language model instance
        turn_event_stream_emitter: Event emitter for streaming responses
        search_tool: Search tool instance (optional)
        eval_context: Evaluation context for the turn (optional)
    """
    clarification = get_clarification(
        messages, cfg, llm, turn_event_stream_emitter, search_tool
    )
    output = json.loads(clarification.choices[0].message.content)
    clarification_output = ClarificationOutput(**output)
    if clarification_output.clarification_needed:
        turn_event_stream_emitter.emit(
            kind="agent", data=clarification_output.clarification_question
        )
        turn_event_stream_emitter.emit(kind="done", data={"ok": True})
        return
    dr_agent = construct_deep_research_agent(llm)
    ctx = MyContext(
        run_dependencies=RunDependencies(
            search_tool=search_tool,
            emitter=turn_event_stream_emitter,
            llm=llm,
        )
    )
    bridge = OnyxRunner(dr_agent, messages, ctx, max_turns=100).start()
    for ev in bridge.events():
        if isinstance(ev, RunItemStreamEvent):
            pass
        elif isinstance(ev, RawResponsesStreamEvent):
            turn_event_stream_emitter.emit(kind="agent", data=ev.data.model_dump())

    turn_event_stream_emitter.emit(kind="done", data={"ok": True})


class ClarificationOutput(BaseModel):
    clarification_question: str
    clarification_needed: bool


def get_clarification(
    messages: List[Dict[str, Any]],
    cfg: GraphConfig,
    llm: LLM,
    search_tool: SearchTool,
) -> litellm.ModelResponse:
    chat_history_string = (
        get_chat_history_string(
            cfg.inputs.prompt_builder.message_history,
            MAX_CHAT_HISTORY_MESSAGES,
        )
        or "(No chat history yet available)"
    )
    base_clarification_prompt = get_dr_prompt_orchestration_templates(
        DRPromptPurpose.CLARIFICATION,
        research_type=ResearchType.DEEP,
        entity_types_string=None,
        relationship_types_string=None,
        available_tools={},
    )
    clarification_prompt = base_clarification_prompt.build(
        question=messages[-1]["content"],
        chat_history_string=chat_history_string,
    )
    clarifier_prompt = prompt_with_handoff_instructions(clarification_prompt)
    llm_response = llm_completion(
        model_name=llm.config.model_name,
        temperature=llm.config.temperature,
        messages=[{"role": "user", "content": clarifier_prompt}],
        stream=False,
    )
    return llm_response


if __name__ == "__main__":
    messages = [
        {
            "role": "user",
            "content": """
            Let $N$ denote the number of ordered triples of positive integers $(a, b, c)$ such that $a, b, c
            \\leq 3^6$ and $a^3 + b^3 + c^3$ is a multiple of $3^7$. Find the remainder when $N$ is divided by $1000$.
            """,
        }
    ]
    # OpenAI reasoning is not supported yet due to: https://github.com/BerriAI/litellm/pull/14117
    reasoning_agent = Agent(
        name="Reasoning",
        instructions="You are a reasoning agent. You are given a question and you need to reason about it.",
        model=LitellmModel(
            model="gpt-5-mini",
            api_key=os.getenv("OPENAI_API_KEY"),
        ),
        tools=[],
        model_settings=ModelSettings(
            temperature=0.0,
            reasoning=Reasoning(effort="medium", summary="detailed"),
        ),
    )
    llm_response = llm_completion(
        model_name="gpt-5-mini",
        temperature=0.0,
        messages=messages,
        stream=False,
    )
    x = llm_response.json()
