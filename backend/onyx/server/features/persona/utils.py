from onyx.db.models import Persona
from onyx.server.features.document_set.models import DocumentSet
from onyx.server.features.persona.models import PersonaLabelSnapshot
from onyx.server.features.persona.models import PersonaSnapshot
from onyx.server.features.persona.models import PromptSnapshot
from onyx.server.features.tool.models import ToolSnapshot
from onyx.server.models import MinimalUserSnapshot
from onyx.utils.logger import setup_logger


logger = setup_logger()


def build_persona_snapshot(
    persona: Persona, allow_deleted: bool = False
) -> PersonaSnapshot:
    if persona.deleted:
        error_msg = f"Persona with ID {persona.id} has been deleted"
        if not allow_deleted:
            raise ValueError(error_msg)
        else:
            logger.warning(error_msg)

    return PersonaSnapshot(
        id=persona.id,
        name=persona.name,
        owner=(
            MinimalUserSnapshot(id=persona.user.id, email=persona.user.email)
            if persona.user
            else None
        ),
        is_visible=persona.is_visible,
        is_public=persona.is_public,
        display_priority=persona.display_priority,
        description=persona.description,
        num_chunks=persona.num_chunks,
        llm_relevance_filter=persona.llm_relevance_filter,
        llm_filter_extraction=persona.llm_filter_extraction,
        llm_model_provider_override=persona.llm_model_provider_override,
        llm_model_version_override=persona.llm_model_version_override,
        starter_messages=persona.starter_messages,
        builtin_persona=persona.builtin_persona,
        is_default_persona=persona.is_default_persona,
        prompts=[PromptSnapshot.from_model(prompt) for prompt in persona.prompts],
        tools=[ToolSnapshot.from_model(tool) for tool in persona.tools],
        document_sets=[
            DocumentSet.from_model(document_set_model)
            for document_set_model in persona.document_sets
        ],
        users=[
            MinimalUserSnapshot(id=user.id, email=user.email) for user in persona.users
        ],
        groups=[user_group.id for user_group in persona.groups],
        icon_color=persona.icon_color,
        icon_shape=persona.icon_shape,
        uploaded_image_id=persona.uploaded_image_id,
        search_start_date=persona.search_start_date,
        labels=[PersonaLabelSnapshot.from_model(label) for label in persona.labels],
    )
