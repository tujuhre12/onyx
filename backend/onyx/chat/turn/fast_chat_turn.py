from agents import Agent
from agents import ModelSettings
from agents.extensions.models.litellm_model import LitellmModel

from onyx.chat.turn.infra.chat_turn_event_stream import OnyxRunner
from onyx.chat.turn.infra.chat_turn_orchestration import unified_event_stream
from onyx.chat.turn.infra.packet_translation import default_packet_translation
from onyx.chat.turn.models import MyContext
from onyx.chat.turn.models import RunDependencies
from onyx.server.query_and_chat.streaming_models import OverallStop
from onyx.server.query_and_chat.streaming_models import Packet
from onyx.tools.tool_implementations_v2.internal_search import internal_search
from onyx.tools.tool_implementations_v2.web import web_fetch
from onyx.tools.tool_implementations_v2.web import web_search


# TODO: Dependency injection?
@unified_event_stream
def fast_chat_turn(messages: list[dict], dependencies: RunDependencies) -> None:
    ctx = MyContext(
        run_dependencies=dependencies,
    )
    agent = Agent(
        name="Assistant",
        model=LitellmModel(
            model=dependencies.llm.config.model_name,
            api_key=dependencies.llm.config.api_key,
        ),
        tools=[web_search, web_fetch, internal_search],
        model_settings=ModelSettings(
            temperature=0.0,
            include_usage=True,
        ),
    )

    bridge = OnyxRunner().run_streamed(agent, messages, context=ctx, max_turns=100)
    for ev in bridge.events():
        ctx.current_run_step
        obj = default_packet_translation(ev)
        if obj:
            dependencies.emitter.emit(Packet(ind=ctx.current_run_step, obj=obj))
    # TODO: Error handling
    # Should there be a timeout and some error on the queue?
    dependencies.emitter.emit(
        Packet(ind=ctx.current_run_step, obj=OverallStop(type="stop"))
    )
