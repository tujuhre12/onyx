import os

from backend.onyx.configs.chat_configs import NUM_RETURNED_HITS


#####
# Agent Configs
#####

AGENT_TEST = os.environ.get("AGENT_TEST", False)
AGENT_TEST_MAX_QUERY_RETRIEVAL_RESULTS = os.environ.get(
    "MAX_AGENT_QUERY_RETRIEVAL_RESULTS", NUM_RETURNED_HITS
)
