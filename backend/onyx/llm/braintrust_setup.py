"""
Simple Braintrust setup for LangGraph applications.

This module provides a simple way to configure Braintrust tracing
for LangGraph applications following the official Braintrust guide.
"""

import os

from braintrust import init_logger
from braintrust_langchain import BraintrustCallbackHandler
from braintrust_langchain import set_global_handler

from onyx.configs.app_configs import BRAINTRUST_ENABLED
from onyx.configs.app_configs import BRAINTRUST_PROJECT
from onyx.utils.logger import setup_logger

logger = setup_logger()


def setup_braintrust_tracing() -> bool:
    """
    Set up Braintrust tracing for LangGraph applications.

    This function initializes Braintrust and sets up a global callback handler
    following the official Braintrust LangGraph guide.

    Returns:
        True if Braintrust tracing was successfully set up, False otherwise
    """

    # Check if Braintrust should be enabled
    if not BRAINTRUST_ENABLED:
        logger.info("Braintrust tracing is disabled")
        return False

    try:
        # Initialize Braintrust logger
        braintrust_logger = init_logger(
            project=BRAINTRUST_PROJECT,
            api_key=os.getenv("BRAINTRUST_API_KEY"),
        )
        # Create and set global callback handler
        handler = BraintrustCallbackHandler({"logger": braintrust_logger})
        set_global_handler(handler)

        logger.info(f"Braintrust tracing enabled for project: {BRAINTRUST_PROJECT}")
        logger.info("Experiment will be managed automatically by Braintrust")

        return True

    except Exception as e:
        logger.warning(f"Failed to set up Braintrust tracing: {e}")
        return False


def is_braintrust_enabled() -> bool:
    """
    Check if Braintrust tracing is enabled.

    Returns:
        True if Braintrust tracing is enabled, False otherwise
    """
    return BRAINTRUST_ENABLED
