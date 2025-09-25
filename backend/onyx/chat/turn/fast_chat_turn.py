from dataclasses import dataclass

from agents import Agent
from agents import ModelSettings
from agents import RawResponsesStreamEvent
from agents import RunItemStreamEvent
from agents.extensions.models.litellm_model import LitellmModel

from onyx.chat.turn.infra.chat_turn_event_stream import OnyxRunner
from onyx.chat.turn.infra.chat_turn_event_stream import RunDependencies
from onyx.chat.turn.infra.chat_turn_orchestration import unified_event_stream


@dataclass
class MyContext:
    """Context class to hold search tool and other dependencies"""

    run_dependencies: RunDependencies | None = None
    needs_compaction: bool = False


# TODO: Dependency injection?
@unified_event_stream
def fast_chat_turn(messages: list[dict], dependencies: RunDependencies) -> None:
    ctx = MyContext(
        run_dependencies=dependencies,
    )
    agent = Agent(
        name="Assistant",
        instructions="""
        You are a helpful assistant that can search the web, fetch content from URLs,
        and search internal databases. Please do some reasoning and then return your answer.
        """,
        model=LitellmModel(
            model=dependencies.llm.config.model_name,
            api_key=dependencies.llm.config.api_key,
        ),
        tools=[],
        model_settings=ModelSettings(
            temperature=0.0,
            include_usage=True,
        ),
    )

    bridge = OnyxRunner().run_streamed(agent, messages, context=ctx, max_turns=100)
    try:
        for ev in bridge.events():
            if isinstance(ev, RunItemStreamEvent):
                pass
            elif isinstance(ev, RawResponsesStreamEvent):
                # TODO: use very standardized schema for the emitter that is close to
                # front end schema
                dependencies.emitter.emit(kind="agent", data=ev.data.model_dump())
    finally:
        # TODO: Handle done signal more reliably?
        dependencies.emitter.emit(kind="done", data={"ok": True})
