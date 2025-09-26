"""Module for lazy loading and configuring the litellm module."""

from typing import Any
from typing import TYPE_CHECKING

from onyx.configs.app_configs import BRAINTRUST_ENABLED

if TYPE_CHECKING:
    import litellm

    LiteLLMModule = litellm
else:
    LiteLLMModule = Any

# Cache for the configured litellm module
_litellm_module: LiteLLMModule | None = None


def get_litellm() -> LiteLLMModule:
    """Get the configured litellm module. Lazily imports and configures on first use."""
    global _litellm_module
    if _litellm_module is None:
        import litellm

        # If a user configures a different model and it doesn't support all the same
        # parameters like frequency and presence, just ignore them
        litellm.drop_params = True
        litellm.telemetry = False

        if BRAINTRUST_ENABLED:
            litellm.callbacks = ["braintrust"]

        _litellm_module = litellm

    return _litellm_module
