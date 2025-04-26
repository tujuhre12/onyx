import requests
from tests.integration.common_utils.constants import API_SERVER_URL
from tests.integration.common_utils.constants import GENERAL_HEADERS
from tests.integration.common_utils.test_models import DATestUser
from onyx.utils.logger import setup_logger
from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from typing import Tuple

logger = setup_logger()

def _format_request_exception_message(e: requests.exceptions.RequestException, context: str) -> str:
    """Formats an error message for a RequestException."""
    error_msg = f"Error {context}: {e}"
    if hasattr(e, 'response') and e.response is not None:
        error_msg += f" | Response body: {e.response.text}"
    return error_msg

def create_slack_bot(
    bot_token: str,
    app_token: str,
    user_performing_action: DATestUser,
    enabled: bool = True,
    name: str = "test-slack-bot",
) -> Dict[str, Any]:  
    """Create a Slack bot using the provided tokens and user information."""
    if not isinstance(user_performing_action, DATestUser):
        raise TypeError("user_performing_action must be of type DATestUser")
    if not isinstance(bot_token, str):
        raise TypeError("bot_token must be of type str")
    if not isinstance(app_token, str):
        raise TypeError("app_token must be of type str")

    body = {
        "name": name,
        "enabled": enabled,
        "bot_token": bot_token,
        "app_token": app_token,
    }
    try:
        response = requests.post(
            url = f"{API_SERVER_URL}/manage/admin/slack-app/bots",
            headers = user_performing_action.headers,
            json = body,
        )
        response.raise_for_status()
        response_json = response.json()
        logger.info(f"Slack bot created successfully: {response_json}")
        return response_json
    except requests.exceptions.RequestException as e:
        error_message = _format_request_exception_message(e, "creating Slack bot")
        logger.error(error_message)
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise

def list_slack_channel_configs(
    bot_id: int,
    user_performing_action: DATestUser,
) -> List[Dict[str, Any]]:
    """Lists Slack channel configurations for a given bot ID."""
    if not isinstance(user_performing_action, DATestUser):
        raise TypeError("user_performing_action must be of type DATestUser")
    if not isinstance(bot_id, int):
        raise TypeError("bot_id must be of type int")

    try:
        response = requests.get(
            url=f"{API_SERVER_URL}/manage/admin/slack-app/bots/{bot_id}/config",
            headers=user_performing_action.headers,
        )
        response.raise_for_status()
        response_json = response.json()
        logger.info(f"Successfully listed Slack channel configs for bot {bot_id}: {response_json}")
        return response_json
    except requests.exceptions.RequestException as e:
        error_message = _format_request_exception_message(e, f"listing Slack channel configs for bot {bot_id}")
        logger.error(error_message)
        raise
    except Exception as e:
        logger.error(f"Unexpected error listing Slack channel configs: {e}")
        raise


def update_slack_channel_config(
    config_id: int,
    update_data: Dict[str, Any],
    user_performing_action: DATestUser,
) -> Dict[str, Any]:
    """Updates a specific Slack channel configuration."""
    if not isinstance(user_performing_action, DATestUser):
        raise TypeError("user_performing_action must be of type DATestUser")
    if not isinstance(config_id, int):
        raise TypeError("config_id must be of type int")
    if not isinstance(update_data, dict):
        raise TypeError("update_data must be of type dict")

    try:
        response = requests.patch(
            url=f"{API_SERVER_URL}/manage/admin/slack-app/channel/{config_id}",
            headers=user_performing_action.headers,
            json=update_data,
        )
        response.raise_for_status()
        response_json = response.json()
        logger.info(f"Successfully updated Slack channel config {config_id}: {response_json}")
        return response_json
    except requests.exceptions.RequestException as e:
        error_message = _format_request_exception_message(e, f"updating Slack channel config {config_id}")
        logger.error(error_message)
        raise
    except Exception as e:
        logger.error(f"Unexpected error updating Slack channel config: {e}")
        raise


def list_slack_channels_from_api(
    bot_id: int,
    user_performing_action: DATestUser,
) -> List[Dict[str, Any]]:
    """Lists Slack channels available to the bot via the Slack API."""
    if not isinstance(user_performing_action, DATestUser):
        raise TypeError("user_performing_action must be of type DATestUser")
    if not isinstance(bot_id, int):
        raise TypeError("bot_id must be of type int")

    try:
        response = requests.get(
            url=f"{API_SERVER_URL}/manage/admin/slack-app/bots/{bot_id}/channels",
            headers=user_performing_action.headers,
        )
        response.raise_for_status()
        response_json = response.json()
        logger.info(f"Successfully listed Slack channels for bot {bot_id} from API: {response_json}")
        return response_json
    except requests.exceptions.RequestException as e:
        error_message = _format_request_exception_message(e, f"listing Slack channels from API for bot {bot_id}")
        logger.error(error_message)
        raise
    except Exception as e:
        logger.error(f"Unexpected error listing Slack channels from API: {e}")
        raise

def create_standard_answer_category(
    category_name: str,
    user_performing_action: DATestUser,
) -> Dict[str, Any]:
    """Creates a standard answer category."""
    if not isinstance(user_performing_action, DATestUser):
        raise TypeError("user_performing_action must be of type DATestUser")
    if not isinstance(category_name, str):
        raise TypeError("category_name must be of type str")

    body = {"name": category_name}
    try:
        response = requests.post(
            url=f"{API_SERVER_URL}/manage/admin/standard-answer/category",
            headers=user_performing_action.headers,
            json=body,
        )
        response.raise_for_status()
        response_json = response.json()
        logger.info(f"Standard answer category created successfully: {response_json}")
        return response_json
    except requests.exceptions.RequestException as e:
        error_message = _format_request_exception_message(e, f"creating standard answer category '{category_name}'")
        logger.error(error_message)
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating standard answer category: {e}")
        raise

def create_standard_answer(
    keyword: str,
    answer: str,
    category_ids: List[int],
    user_performing_action: DATestUser,
    match_regex: bool = False,
    match_any_keywords: bool = False,
) -> Dict[str, Any]:
    """Creates a standard answer."""
    if not isinstance(user_performing_action, DATestUser):
        raise TypeError("user_performing_action must be of type DATestUser")
    if not isinstance(keyword, str):
        raise TypeError("keyword must be of type str")
    if not isinstance(answer, str):
        raise TypeError("answer must be of type str")
    if not isinstance(category_ids, list) or not all(isinstance(cid, int) for cid in category_ids):
        raise TypeError("category_ids must be a list of integers")
    if not isinstance(match_regex, bool):
        raise TypeError("match_regex must be of type bool")
    if not isinstance(match_any_keywords, bool):
        raise TypeError("match_any_keywords must be of type bool")

    body = {
        "keyword": keyword,
        "answer": answer,
        "categories": category_ids,
        "match_regex": match_regex,
        "match_any_keywords": match_any_keywords,
    }
    try:
        response = requests.post(
            url=f"{API_SERVER_URL}/manage/admin/standard-answer",
            headers=user_performing_action.headers,
            json=body,
        )
        response.raise_for_status()
        response_json = response.json()
        logger.info(f"Standard answer created successfully: {response_json}")
        return response_json
    except requests.exceptions.RequestException as e:
        error_message = _format_request_exception_message(e, f"creating standard answer with keyword '{keyword}'")
        logger.error(error_message)
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating standard answer: {e}")
        raise

def create_standard_answer_with_category(
    category_name: str,
    keyword: str,
    answer: str,
    user_performing_action: DATestUser,
    match_regex: bool = False,
    match_any_keywords: bool = False,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Creates a standard answer category and then a standard answer using that category."""
    # Create the category first
    category = create_standard_answer_category(
        category_name=category_name,
        user_performing_action=user_performing_action,
    )
    category_id = category.get("id")
    if category_id is None:
        raise ValueError("Failed to get ID from created category")

    # Create the standard answer using the new category ID
    standard_answer = create_standard_answer(
        keyword=keyword,
        answer=answer,
        category_ids=[category_id],
        user_performing_action=user_performing_action,
        match_regex=match_regex,
        match_any_keywords=match_any_keywords,
    )

    return category, standard_answer

def create_slack_channel_config(
    bot_id: int,
    channel_name: str,
    user_performing_action: DATestUser,
    config_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Creates a Slack channel config for a given bot and channel.
    :param bot_id: The Slack bot ID.
    :param channel_name: The Slack channel name (without #).
    :param user_performing_action: The user performing the action.
    :param config_data: Optional additional config fields to override defaults.
    :return: The created Slack channel config as a dict.
    """
    if not isinstance(user_performing_action, DATestUser):
        raise TypeError("user_performing_action must be of type DATestUser")
    if not isinstance(bot_id, int):
        raise TypeError("bot_id must be of type int")
    if not isinstance(channel_name, str):
        raise TypeError("channel_name must be of type str")

    # body = {
    #     "slack_bot_id": bot_id,
    #     "channel_name": channel_name,
    #     "respond_tag_only": False,
    #     "respond_to_bots": False,
    #     "is_ephemeral": False,
    #     "show_continue_in_web_ui": False,
    #     "enable_auto_filters": False,
    #     "respond_member_group_list": [],
    #     "answer_filters": [],
    #     "follow_up_tags": [],
    #     "response_type": "citations",
    #     "standard_answer_categories": [],
    #     "disabled": False,
    # }

    body = {
        "slack_bot_id": bot_id,
        "channel_name": channel_name,
        "response_type": "citations",
        "respond_tag_only": True
    }

    if config_data:
        body.update(config_data)

    try:
        response = requests.post(
            url=f"{API_SERVER_URL}/manage/admin/slack-app/channel",
            headers=user_performing_action.headers,
            json=body,
        )
        response.raise_for_status()
        response_json = response.json()
        logger.info(f"Slack channel config created successfully: {response_json}")
        return response_json
    except requests.exceptions.RequestException as e:
        error_message = _format_request_exception_message(e, f"creating Slack channel config for channel '{channel_name}'")
        logger.error(error_message)
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating Slack channel config: {e}")
        raise

