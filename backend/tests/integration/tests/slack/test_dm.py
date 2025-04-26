import pytest
from tests.integration.common_utils.managers.slack import SlackManager
from onyx.utils.logger import setup_logger
from typing import Dict, Any
from tests.integration.tests.slack.slack_test_helpers import (
    send_and_receive_dm,
    update_channel_config,
    assert_button_presence,
    extract_dm_slack_context,
    send_dm_with_optional_timeout
)

logger = setup_logger()
"""NOTE: Slack treats messages sent by our test suite as bot messages. So we will enable respond to bot config in most of the test cases"""
"""Test cases for Slack DMs using the default configuration."""
@pytest.mark.parametrize(
    "test_name, config_update",
    [
        ("enabled", None),
        ("disabled", {"disabled": True}),
    ]
)
def test_dm_default_config(slack_test_context: Dict[str, Any], test_name: str, config_update: Any) -> None:
    logger.info(f"Testing DM config: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    if config_update:
        update_channel_config(bot_id, admin_user, updated_config_data=config_update)

    message = send_and_receive_dm(slack_bot_client, slack_user_client, "How many books did Lena receive last Friday?", timeout_secs=20)
    #Message is treated as bot message so we won't get a response
    assert message is None, f"Bot should not respond when {test_name}"

"""Test cases for Slack DMs with respond to bots enabled. If we tag the bot, it should respond eventhough the message is sent as a bot message."""
@pytest.mark.parametrize(
    "test_name, config_update, expected_text",
    [
        ("enabled", {"respond_to_bots": True}, "42"),
        ("disabled", {"disabled": True, "respond_to_bots":True}, None),
    ]
)
def test_dm_default_config_by_enabling_respond_to_bot(slack_test_context: Dict[str, Any], test_name: str, config_update: Any, expected_text: Any) -> None:
    logger.info(f"Testing DM config by enabling respond to bot: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    if config_update:
        update_channel_config(bot_id, admin_user, updated_config_data=config_update)
    message = send_dm_with_optional_timeout(slack_bot_client, slack_user_client, "How many books did Lena receive last Friday?", expected_text=expected_text)
    if expected_text is not None:
        assert message is not None, f"Bot should respond when {test_name}"
        blocks = message["blocks"]
        assert blocks is not None and len(blocks) > 0, f"Response should have blocks when {test_name}"
        assert expected_text in blocks[0]["text"]["text"], f"Response should contain '{expected_text}' when {test_name}"
    else:
        assert message is None, f"Bot should not respond when {test_name}"

"""Test cases for continue_in_web_ui button in DM"""
@pytest.mark.parametrize(
    "test_name, config_update, expect_button, expected_text",
    [
        ("continue_in_web_ui_button_enabled", {"show_continue_in_web_ui": True, "respond_to_bots": True}, True, "42"),
        ("continue_in_web_ui_button_disabled", {"show_continue_in_web_ui": False, "respond_to_bots": True}, False, "42"),
    ]
)
def test_dm_continue_in_web_ui_button(
    slack_test_context: Dict[str, Any],
    test_name: str,
    config_update: Any,
    expect_button: bool,
    expected_text: str
):
    logger.info(f"Testing DM continue_in_web_ui button: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    update_channel_config(bot_id, admin_user, updated_config_data=config_update)
    message = send_and_receive_dm(slack_bot_client, slack_user_client, "How many books did Lena receive last Friday?")
    assert message is not None, f"{test_name}: Bot should respond"
    blocks = message["blocks"]
    assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks"
    assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain {expected_text}"
    assert_button_presence(blocks, "continue-in-web-ui", expect_button, test_name)

"""Test cases for follow_up button in DM"""
@pytest.mark.parametrize(
    "test_name, config_update, expect_button, expected_text",
    [
        ("follow_up_tags_enabled", {"follow_up_tags": ["help@onyx.app"], "respond_to_bots": True}, True, "42"),
        ("follow_up_tags_disabled", {"respond_to_bots": True}, False, "42"),
    ]
)
def test_dm_follow_up_button(
    slack_test_context: Dict[str, Any],
    test_name: str,
    config_update: Any,
    expect_button: bool,
    expected_text: str
):
    logger.info(f"Testing DM follow_up button: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    update_channel_config(bot_id, admin_user, updated_config_data=config_update)
    message = send_and_receive_dm(slack_bot_client, slack_user_client, "How many books did Lena receive last Friday?")
    assert message is not None, f"{test_name}: Bot should respond"
    blocks = message["blocks"]
    assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks"
    assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain {expected_text}"
    assert_button_presence(blocks, "followup-button", expect_button, test_name)

"""Test cases for respond_to_questions in DM"""
@pytest.mark.parametrize(
    "test_name, config_update, message_text, expected_text",
    [
        (
            "respond_to_questions_enabled_with_question",
            {"respond_to_bots": True, "answer_filters": ["questionmark_prefilter"]},
            "How many books did Lena receive last Friday?",
            "42"
        ),
        (
            "respond_to_questions_enabled_without_question",
            {"respond_to_bots": True, "answer_filters": ["questionmark_prefilter"]},
            "How many books did Lena receive last Friday",
            None
        ),
        (
            "respond_to_questions_enabled_without_question",
            {"respond_to_bots": True},
            "How many books did Lena receive last Friday",
            "42"
        ),
    ]
)
def test_dm_respond_to_questions(
    slack_test_context: Dict[str, Any],
    test_name: str,
    config_update: Any,
    message_text: str,
    expected_text: Any
):
    logger.info(f"Testing DM respond_to_questions: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    update_channel_config(bot_id, admin_user, updated_config_data=config_update)
    message = send_dm_with_optional_timeout(slack_bot_client, slack_user_client, message_text, expected_text=expected_text)
    if expected_text is None:
        assert message is None, f"{test_name}: Bot should not respond"
    else:
        assert message is not None, f"{test_name}: Bot should respond"
        blocks = message["blocks"]
        assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks"
        assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain '{expected_text}'"

"""Test cases for standard answer category in DM"""
@pytest.mark.parametrize(
    "test_name, config_update, expected_text",
    [
        (
            "with_standard_answer_category",
            "std_ans_category",  # special marker, handled in test
            "support@onyx.app"
        ),
        (
            "without_standard_answer_category",
            {"respond_to_bots": True},
            None  # Should NOT contain standard answer
        ),
    ]
)
def test_dm_standard_answer_category(
    slack_test_context: Dict[str, Any],
    test_name: str,
    config_update: Any,
    expected_text: Any
):
    logger.info(f"Testing DM standard answer category: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    if config_update == "std_ans_category":
        categories = slack_test_context["std_ans_category"]
        cat_id = categories["id"]
        config = {"respond_to_bots": True, "standard_answer_categories": [cat_id]}
    else:
        config = config_update

    update_channel_config(bot_id, admin_user, updated_config_data=config)
    message = send_and_receive_dm(slack_bot_client, slack_user_client, "I need support")
    assert message is not None, f"{test_name}: Bot should respond"
    blocks = message["blocks"]
    if expected_text is None:
        assert "support@onyx.app" not in blocks[0]["text"]["text"], f"{test_name}: Response should NOT contain the standard answer"
    else:
        assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain '{expected_text}'"

"""Test cases for respond only to tag in DM, In DM eventough we enabled this config onyx bot will reply for both tag and untagged"""
@pytest.mark.parametrize(
    "test_name, config_update, expected_text",
    [
        (
            "respond_tag_only_enabled",
            {"respond_tag_only": True, "respond_to_bots": True},
            "42"
        ),
        (
            "respond_tag_only_disabled",
            {"respond_tag_only": False, "respond_to_bots": True},
            "42"
        ),
    ]
)
def test_dm_respond_tag_only(
    slack_test_context: Dict[str, Any],
    test_name: str,
    config_update: Any,
    expected_text: Any
):
    logger.info(f"Testing DM respond_tag_only: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    update_channel_config(bot_id, admin_user, updated_config_data=config_update)
    message = send_and_receive_dm(slack_bot_client, slack_user_client, "How many books did Lena receive last Friday?")
    assert message is not None, f"{test_name}: Bot should respond"
    blocks = message["blocks"]
    assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks"
    assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain '{expected_text}'"

"""Test cases for respond to bot in DM, Message sent by test suite is treated as bot message so just sending the messsage is fine"""
@pytest.mark.parametrize(
    "test_name, config_update, expected_text",
    [
        (
            "respond_to_bots_enabled",
            {"respond_to_bots": True},
            "42"
        ),
        (
            "respond_to_bots_disabled",
            {"respond_to_bots": False},
            None
        ),
    ]
)
def test_dm_respond_to_bots(
    slack_test_context: Dict[str, Any],
    test_name: str,
    config_update: Any,
    expected_text: Any
):
    logger.info(f"Testing DM respond_to_bots: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    update_channel_config(bot_id, admin_user, updated_config_data=config_update)
    message = send_dm_with_optional_timeout(slack_bot_client, slack_user_client, "How many books did Lena receive last Friday?", expected_text)
    if expected_text is None:
        assert message is None, f"{test_name}: Bot should not respond"
    else:
        assert message is not None, f"{test_name}: Bot should respond"
        blocks = message["blocks"]
        assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks"
        assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain '{expected_text}'"

"""Test cases to verify that the bot responds if it is tagged even when 'Respond to Bots' is disabled, 'Respond to Questions' is enabled and the overall config is disabled."""
@pytest.mark.parametrize(
    "test_name, config_update, expected_text",
    [
        (
            "respond_to_bots_disabled_respond_to_questions_disabled",
            {"respond_to_bots": False},
            "42"
        ),
        (
            "respond_to_bots_disabled_respond_to_questions_enabled",
            {"respond_to_bots": False, "answer_filters": ["questionmark_prefilter"]},
            "42"
        ),
        (
            "default_config_disabled",
            {"disabled": True},
            "42"
        )
        
    ]
)
def test_dm_tag_with_restriction(
    slack_test_context: Dict[str, Any],
    test_name: str,
    config_update: Any,
    expected_text: Any
):
    logger.info(f"Testing DM respond_to_bots with restrictions: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id = extract_dm_slack_context(slack_test_context)

    update_channel_config(bot_id, admin_user, updated_config_data=config_update)
    
    user_id, _ = SlackManager.get_onyxbot_user_and_bot_ids(slack_bot_client)
    logger.info(f"Slack bot user ID: {user_id}")

    #tag the bot in the message
    message = f"<@{user_id}> How many books did Lena receive last Friday?"
    logger.info(f"Sending message to bot: {message}")

    message = send_and_receive_dm(slack_bot_client, slack_user_client, message)
    assert message is not None, f"{test_name}: Bot should respond"
    blocks = message["blocks"]
    assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks"
    assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain '{expected_text}'"