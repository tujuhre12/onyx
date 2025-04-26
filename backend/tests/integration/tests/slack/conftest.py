import os
import pytest
from datetime import datetime
from datetime import timezone
from typing import IO
from typing import Tuple
from typing import List
from typing import Generator
from typing import Dict
from typing import Any

from onyx.utils.logger import setup_logger
from tests.integration.common_utils.managers.cc_pair import CCPairManager
from tests.integration.common_utils.managers.user import UserManager
from tests.integration.common_utils.test_models import DATestUser
from tests.integration.common_utils.managers.file import FileManager
from tests.integration.common_utils.reset import reset_all
from tests.integration.tests.slack.utils import create_slack_bot
from tests.integration.tests.slack.utils import list_slack_channel_configs
from tests.integration.tests.slack.utils import update_slack_channel_config
from tests.integration.tests.slack.utils import create_slack_channel_config
from tests.integration.tests.slack.utils import list_slack_channels_from_api
from tests.integration.tests.slack.utils import create_standard_answer_with_category
from tests.integration.common_utils.managers.slack import SlackManager
from tests.integration.common_utils.managers.llm_provider import LLMProviderManager
from slack_sdk import WebClient

logger = setup_logger()
@pytest.fixture(scope="session")
def reset_db_and_index() -> None:
    """Fixture to reset the database and Vespa index before each test."""
    reset_all()
    logger.info("Database and Vespa index reset successfully.")


def _admin_user() -> DATestUser:
    """Creates the admin user once per module."""
    user = UserManager.create(email="admin@onyx-test.com")
    logger.info(f"Admin user created: {user.email}")
    return user


def _slack_bot(admin_user: DATestUser) -> Dict[str, Any]:
    """Fixture to create a Slack bot and return its details."""

    app_token = os.environ.get("SLACK_APP_TOKEN")
    bot_token = os.environ.get("SLACK_BOT_TOKEN")
    if not app_token or not bot_token:
        raise RuntimeError("SLACK_APP_TOKEN and/or SLACK_BOT_TOKEN environment variables not set")

    # Create the Slack bot
    bot_details = create_slack_bot(
        bot_token=bot_token,
        app_token=app_token,
        user_performing_action=admin_user
    )
    logger.info(f"Slack bot created: {bot_details}")
    return bot_details

def _slack_bot_client() -> WebClient:
    """Fixture to create a Slack bot client."""
    bot_token = os.environ.get("SLACK_BOT_TOKEN")
    if not bot_token:
        raise RuntimeError("SLACK_BOT_TOKEN environment variable not set")
    slack_client = WebClient(token=bot_token)
    return slack_client

def _slack_user_client() -> WebClient:
    """Fixture to create a Slack user client."""
    user_token = os.environ.get("SLACK_USER_TOKEN")
    if not user_token:
        raise RuntimeError("SLACK_USER_TOKEN environment variable not set")
    slack_client = WebClient(token=user_token)
    return slack_client

def _create_standard_answer_and_category(admin_user: DATestUser) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Creates a standard answer category and a standard answer using the combined utility."""
    category, standard_answer = create_standard_answer_with_category(
        category_name="IT",
        keyword="support",
        answer="If you need any support, Please contact support@onyx.app",
        user_performing_action=admin_user
    )
    logger.info(f"Standard answer category created: {category}")
    logger.info(f"Standard answer created: {standard_answer}")
    return category, standard_answer

def _create_slack_channels(slack_user_client: WebClient, slack_bot_client: WebClient) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Creates Slack channels with the bot and user"""
    slack_bot_user_id, _ =  SlackManager.get_onyxbot_user_and_bot_ids(slack_bot_client)
    logger.info(f"Slack bot user ID: {slack_bot_user_id}")
    slack_user_id, _ =  SlackManager.get_onyxbot_user_and_bot_ids(slack_user_client)
    logger.info(f"Slack user ID: {slack_user_id}")
    # Create a channels
    test_channel_1 = SlackManager.create_slack_channel(
        slack_client=slack_user_client,
        channel_name= "config-test-channel-1",
        is_private=True
    )
    logger.info(f"Channel created: {test_channel_1}")

    test_channel_2 = SlackManager.create_slack_channel(
        slack_client=slack_user_client,
        channel_name= "config-test-channel-2",
        is_private=True
    )
    logger.info(f"Channel created: {test_channel_2}")

    #add the bot to the channels
    SlackManager.set_channel_members(
        slack_client=slack_user_client,
        admin_user_id=slack_user_id,
        channel=test_channel_1,
        user_ids=[slack_bot_user_id]
    )
    logger.info(f"Added bot to channel: {test_channel_1}")
    SlackManager.set_channel_members(
        slack_client=slack_user_client,
        admin_user_id=slack_user_id,
        channel=test_channel_2,
        user_ids=[slack_bot_user_id]
    )
    logger.info(f"Added bot to channel: {test_channel_2}")

    return test_channel_1, test_channel_2

def _create_slack_channel_config(
        channel_name: str,
        slack_bot_id: str,
        admin_user: DATestUser,
) -> Dict[str, Any]:
    """Creates a Slack channel config."""
    slack_channel_config = create_slack_channel_config(
        bot_id=slack_bot_id,
        channel_name=channel_name,
        user_performing_action=admin_user,
    )
    logger.info(f"Slack channel config created: {slack_channel_config}")
    return slack_channel_config

@pytest.fixture(scope="session")
def slack_test_context(reset_db_and_index: None) -> Dict[str, Any]:
    """Fixture to create the Slack test context."""
    # Create the admin user
    admin_user =  _admin_user()

    # Create a Slack bot
    slack_bot = _slack_bot(admin_user)

    # Create a Slack bot client
    slack_bot_client = _slack_bot_client()

    # Create a Slack user client
    slack_user_client = _slack_user_client()

    # Create standard answer and category
    std_ans_category, std_answer = _create_standard_answer_and_category(admin_user)

    # Create Slack channels
    test_channel_1, test_channel_2 = _create_slack_channels(slack_user_client, slack_bot_client)

    # Create Slack channel config
    slack_channel_config = _create_slack_channel_config(
        channel_name="config-test-channel-1",
        slack_bot_id=slack_bot["id"],
        admin_user=admin_user,
    )
    # Return the context
    return {
        "admin_user": admin_user,
        "slack_bot": slack_bot,
        "slack_bot_client": slack_bot_client,
        "slack_user_client": slack_user_client,
        "std_ans_category": std_ans_category,
        "std_answer": std_answer,
        "test_channel_1": test_channel_1,
        "test_channel_2": test_channel_2,
        "slack_channel_config": slack_channel_config,
    }

#TODO: Please add skip for the test initially to confirm whether we are getting the alembic script location error.
@pytest.fixture(autouse=True, scope="session")
def setup_module(slack_test_context: Dict[str, Any]) -> Generator[None, None, None]:

    admin_user = slack_test_context["admin_user"]

    # Create LLM provider
    llm_api_key = os.environ.get("LLM_PROVIDER_API_KEY")
    if not llm_api_key:
        raise RuntimeError("LLM_PROVIDER_API_KEY environment variable not set")
    LLMProviderManager.create(
        user_performing_action=admin_user,
        api_key=llm_api_key
    )

    #Upload a file to the connector
    filepath = "tests/integration/tests/slack/resources/story.pdf"
    files = FileManager.upload_file_for_connector(
        file_path=filepath,
        file_name="story.pdf",
        user_performing_action=admin_user,
    )
    logger.info(f"Uploaded {len(files)} documents.")
    logger.info(f"Files: {files}")
    file_paths = files['file_paths']
    logger.info(f"File paths: {file_paths}")
    connector_config = {
        "zip_metadata": {},
        "file_locations": file_paths[0:1]
    }
    cc_pair = CCPairManager.create_from_scratch(
        user_performing_action=admin_user,
        connector_specific_config=connector_config
    )

    now = datetime.now(timezone.utc)
    CCPairManager.wait_for_indexing_completion(
        cc_pair, now, timeout=360, user_performing_action=admin_user
    )
    logger.info("Indexing completed successfully.")

    yield

    # This part will always run after the test, even if it fails
    #reset_all()
    logger.info("Test module teardown completed.")

#@pytest.fixture(autouse=True, scope="session")
def delete_all_messages(slack_test_context: Dict[str, Any]) -> None:
    """Fixture to delete all messages in the Slack bot's channels."""
    slack_bot_client = slack_test_context["slack_bot_client"]
    slack_user_client = slack_test_context["slack_user_client"]
    user_id, bot_id = SlackManager.get_onyxbot_user_and_bot_ids(slack_bot_client)
    logger.info(f"Slack user ID: {user_id}, Slack bot ID: {bot_id}")

    # Open DM channel with the bot
    channel = SlackManager.get_dm_channel(slack_user_client, user_id)
    logger.info(f"Opened DM channel {channel} with bot {bot_id}")
    channel_info = SlackManager.get_full_channel_info(
        slack_client=slack_user_client,
        channel=channel,
    )
    #logger.info(f"Channel info: {channel_info}")

    SlackManager.delete_all_messages_and_threads(
        slack_bot_client=slack_bot_client,
        slack_user_client=slack_user_client,
        channel=channel_info,
    )


