import pytest
from tests.integration.common_utils.managers.slack import SlackManager
from onyx.utils.logger import setup_logger
from slack_sdk import WebClient
from typing import Dict
from typing import Any
from tests.integration.common_utils.test_models import DATestUser
from tests.integration.tests.slack.slack_test_helpers import send_and_receive_channel_message
from tests.integration.tests.slack.slack_test_helpers import update_channel_config
from tests.integration.tests.slack.slack_test_helpers import extract_channel_slack_context
from tests.integration.tests.slack.slack_test_helpers import assert_button_presence
from tests.integration.tests.slack.slack_test_helpers import send_channel_msg_with_optional_timeout

logger = setup_logger()

def default_config_and_channel_config_enabled(slack_test_context: Dict[str, Any]) -> None:
    logger.info("Testing default config")
    slack_bot_client = slack_test_context["slack_bot_client"]
    slack_user_client = slack_test_context["slack_user_client"]
    test_channel_1 = slack_test_context["test_channel_1"]
    test_channel_2 = slack_test_context["test_channel_2"]

    message = send_and_receive_channel_message(
        slack_user_client=slack_user_client,
        slack_bot_client=slack_bot_client,
        message="Hi, What are you doing?",
        channel=test_channel_1,
        tag_bot=True
    )
    assert message is not None, "Bot should respond"
    message = send_and_receive_channel_message(
        slack_user_client=slack_user_client,
        slack_bot_client=slack_bot_client,
        message="Hi, What are you doing?",
        channel=test_channel_2,
        tag_bot=True
    )
    assert message is not None, "Bot should respond"

def default_config_and_channel_config_disabled(slack_test_context: Dict[str, Any]) -> None:
    logger.info("Testing default config with 'respond to bots' enabled")
    slack_bot_client = slack_test_context["slack_bot_client"]
    slack_user_client = slack_test_context["slack_user_client"]
    test_channel_1 = slack_test_context["test_channel_1"]
    test_channel_2 = slack_test_context["test_channel_2"]
    admin_user = slack_test_context["admin_user"]
    slack_bot = slack_test_context["slack_bot"]
    bot_id = slack_bot["id"]

    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data={"disabled": True}
    )
    message = send_and_receive_channel_message(
        slack_user_client=slack_user_client,
        slack_bot_client=slack_bot_client,
        message="Hi, What are you doing?",
        channel=test_channel_1,
        tag_bot=True,
        timeout_secs=40
    )
    assert message is None, "Bot should not respond when disabled"

    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data={"disabled": True}
    )

    message = send_and_receive_channel_message(
        slack_user_client=slack_user_client,
        slack_bot_client=slack_bot_client,
        message="Hi, What are you doing?",
        channel=test_channel_2,
        tag_bot=True,
        timeout_secs=40
    )
    assert message is None, "Bot should respond when enabled"

"""Test cases for continue_in_web_ui button in channels"""
@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expect_button_channel_1, expect_button_channel_2, expected_text",
    [
        (
            "enabled_in_both",
            {"show_continue_in_web_ui": True},
            {"show_continue_in_web_ui": True},
            True,
            True,
            "42"
        ),
        (
            "enabled_in_channel_1_only",
            {"show_continue_in_web_ui": True},
            {"show_continue_in_web_ui": False},
            True,
            False,
            "42"
        ),
        (
            "disabled_in_both",
            {"show_continue_in_web_ui": False},
            {"show_continue_in_web_ui": False},
            False,
            False,
            "42"
        ),
    ]
)
def test_show_continue_in_web_ui_button(
    slack_test_context,
    test_name,
    channel_1_config,
    channel_2_config,
    expect_button_channel_1,
    expect_button_channel_2,
    expected_text
):
    logger.info(f"Running test: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id, test_channel_1, test_channel_2 = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config
    )

    for channel, expect_button, channel_name in [
        (test_channel_1, expect_button_channel_1, "test_channel_1"),
        (test_channel_2, expect_button_channel_2, "test_channel_2"),
    ]:
        message = send_and_receive_channel_message(
            slack_user_client=slack_user_client,
            slack_bot_client=slack_bot_client,
            message="How many books did Lena receive last Friday?",
            channel=channel,
            tag_bot=True
        )
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks in {channel_name}"
        assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain '{expected_text}'"
        assert_button_presence(blocks, "continue_in_web_ui", expect_button, test_name, channel_name)

"""Test cases for respond to bot in channels, Message sent by test suite is treated as bot message so just sending the messsage is fine"""
@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expected_text_channel_1, expected_text_channel_2",
    [
        (
            "enabled_in_both",
            {"respond_to_bots": True, "respond_tag_only": False},
            {"respond_to_bots": True, "respond_tag_only": False},
            "42",
            "42"
        ),
        (
            "enabled_in_channel_1_only",
            {"respond_to_bots": True, "respond_tag_only": False},
            {"respond_to_bots": False, "respond_tag_only": False},
            "42",
            None
        ),
        (
            "disabled_in_both",
            {"respond_to_bots": False, "respond_tag_only": False},
            {"respond_to_bots": False, "respond_tag_only": False},
            None,
            None
        ),
    ]
)
def test_respond_to_bot(
    slack_test_context,
    test_name,
    channel_1_config,
    channel_2_config,
    expected_text_channel_1,
    expected_text_channel_2
):
    logger.info(f"Running test: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id, test_channel_1, test_channel_2 = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config
    )

    for channel, expected_text, channel_name in [
        (test_channel_1, expected_text_channel_1, "test_channel_1"),
        (test_channel_2, expected_text_channel_2, "test_channel_2"),
    ]:
        message = send_channel_msg_with_optional_timeout(
            slack_bot_client=slack_bot_client,
            slack_user_client=slack_user_client,
            message_text="How many books did Lena receive last Friday?",
            channel=channel,
            expected_text=expected_text
        )
        if expected_text is None:
            assert message is None, f"{test_name}: Bot should not respond in {channel_name}"
            continue
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks in {channel_name}"
        assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain '{expected_text}'"

"""Test cases for follow_up button"""
@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expect_button_channel_1, expect_button_channel_2",
    [
        (
            "enabled_in_both",
            {"follow_up_tags": ["help@onyx.app"]},
            {"follow_up_tags": ["help@onyx.app"]},
            True,
            True
        ),
        (
            "enabled_in_channel_1_only",
            {"follow_up_tags": ["help@onyx.app"]},
            {},
            True,
            False
        ),
        (
            "disabled_in_both",
            {},
            {},
            False,
            False
        ),
    ]
)
def test_follow_up_tags(
    slack_test_context,
    test_name,
    channel_1_config,
    channel_2_config,
    expect_button_channel_1,
    expect_button_channel_2
):
    logger.info(f"Running test: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id, test_channel_1, test_channel_2 = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config
    )

    for channel, expect_button, channel_name in [
        (test_channel_1, expect_button_channel_1, "test_channel_1"),
        (test_channel_2, expect_button_channel_2, "test_channel_2"),
    ]:
        message = send_and_receive_channel_message(
            slack_user_client=slack_user_client,
            slack_bot_client=slack_bot_client,
            message="How many books did Lena receive last Friday?",
            channel=channel,
            tag_bot=True
        )
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks in {channel_name}"
        assert_button_presence(blocks, "followup-button", expect_button, test_name, channel_name)


@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expected_text_channel_1, expected_text_channel_2",
    [
        (
            "enabled_in_both",
            {"respond_to_bots": True, "answer_filters": ["questionmark_prefilter"], "respond_tag_only": False},
            {"respond_to_bots": True, "answer_filters": ["questionmark_prefilter"], "respond_tag_only": False},
            None,
            None
        ),
        (
            "enabled_in_channel_1_only",
            {"respond_to_bots": True, "answer_filters": ["questionmark_prefilter"], "respond_tag_only": False},
            {"respond_to_bots": True, "respond_tag_only": False},
            None,
            "42"
        ),
        (
            "disabled_in_both",
            {"respond_to_bots": True, "respond_tag_only": False},
            {"respond_to_bots": True, "respond_tag_only": False},
            "42",
            "42"
        ),
    ]
)
def test_respond_to_questions(
    slack_test_context,
    test_name,
    channel_1_config,
    channel_2_config,
    expected_text_channel_1,
    expected_text_channel_2
):
    logger.info(f"Running test: {test_name}")
    slack_bot_client, slack_user_client, admin_user, bot_id, test_channel_1, test_channel_2 = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config
    )

    for channel, expected_text, channel_name in [
        (test_channel_1, expected_text_channel_1, "test_channel_1"),
        (test_channel_2, expected_text_channel_2, "test_channel_2"),
    ]:
        message = send_channel_msg_with_optional_timeout(
            slack_bot_client=slack_bot_client,
            slack_user_client=slack_user_client,
            message_text="How many books did Lena receive last Friday",
            channel=channel,
            expected_text=expected_text,
            tag_bot=True
        )
        if expected_text is None:
            assert message is None, f"{test_name}: Bot should not respond in {channel_name}"
            continue
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert blocks is not None and len(blocks) > 0, f"{test_name}: Response should have blocks in {channel_name}"
        assert expected_text in blocks[0]["text"]["text"], f"{test_name}: Response should contain '{expected_text}'"
