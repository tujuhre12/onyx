from typing import Any
from typing import Dict
from typing import List

import pytest

from onyx.db.engine import get_session_context_manager
from onyx.utils.logger import setup_logger
from tests.integration.common_utils.managers.slack import SlackManager
from tests.integration.tests.slack.slack_test_helpers import assert_button_presence
from tests.integration.tests.slack.slack_test_helpers import (
    extract_channel_slack_context,
)
from tests.integration.tests.slack.slack_test_helpers import (
    get_last_chat_session_and_messages,
)
from tests.integration.tests.slack.slack_test_helpers import get_slack_user_record
from tests.integration.tests.slack.slack_test_helpers import (
    send_and_receive_channel_message,
)
from tests.integration.tests.slack.slack_test_helpers import (
    send_channel_msg_with_optional_timeout,
)
from tests.integration.tests.slack.slack_test_helpers import send_message_to_channel
from tests.integration.tests.slack.slack_test_helpers import update_channel_config

logger = setup_logger()
"""NOTE: Slack treats messages sent by our test suite as bot messages.
So we will enable respond to bot config in most of the test cases"""


def default_config_and_channel_config_enabled(
    slack_test_context: Dict[str, Any],
) -> None:
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
        tag_bot=True,
    )
    assert message is not None, "Bot should respond"
    message = send_and_receive_channel_message(
        slack_user_client=slack_user_client,
        slack_bot_client=slack_bot_client,
        message="Hi, What are you doing?",
        channel=test_channel_2,
        tag_bot=True,
    )
    assert message is not None, "Bot should respond"


def default_config_and_channel_config_disabled(
    slack_test_context: Dict[str, Any],
) -> None:
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
        updated_config_data={"disabled": True},
    )
    message = send_and_receive_channel_message(
        slack_user_client=slack_user_client,
        slack_bot_client=slack_bot_client,
        message="Hi, What are you doing?",
        channel=test_channel_1,
        tag_bot=True,
        timeout_secs=40,
    )
    assert message is None, "Bot should not respond when disabled"

    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data={"disabled": True},
    )

    message = send_and_receive_channel_message(
        slack_user_client=slack_user_client,
        slack_bot_client=slack_bot_client,
        message="Hi, What are you doing?",
        channel=test_channel_2,
        tag_bot=True,
        timeout_secs=40,
    )
    assert message is None, "Bot should respond when enabled"


"""Test cases for continue_in_web_ui button in channels"""


@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expect_button_channel_1, expect_button_channel_2, expected_text",
    [
        (
            "enabled_in_both",
            {"show_continue_in_web_ui": True, "respond_to_bots": True},
            {"show_continue_in_web_ui": True, "respond_to_bots": True},
            True,
            True,
            ["42", "40"],
        ),
        (
            "enabled_in_channel_1_only",
            {"show_continue_in_web_ui": True, "respond_to_bots": True},
            {"show_continue_in_web_ui": False, "respond_to_bots": True},
            True,
            False,
            ["42", "40"],
        ),
        (
            "disabled_in_both",
            {"show_continue_in_web_ui": False, "respond_to_bots": True},
            {"show_continue_in_web_ui": False, "respond_to_bots": True},
            False,
            False,
            ["42", "40"],
        ),
    ],
)
def test_show_continue_in_web_ui_button(
    slack_test_context,
    test_name,
    channel_1_config,
    channel_2_config,
    expect_button_channel_1,
    expect_button_channel_2,
    expected_text,
):
    logger.info(f"Running test: {test_name}")
    (
        slack_bot_client,
        slack_user_client,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config,
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config,
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
            tag_bot=True,
        )
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert (
            blocks is not None and len(blocks) > 0
        ), f"{test_name}: Response should have blocks in {channel_name}"
        assert any(
            text in blocks[0]["text"]["text"] for text in expected_text
        ), f"{test_name}: Response should contain one of '{expected_text}'"
        assert_button_presence(
            blocks, "continue-in-web-ui", expect_button, test_name, channel_name
        )


"""Test cases for respond to bot in channels, Message sent by test suite is
treated as bot message so just sending the messsage is fine"""


@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expected_text_channel_1, expected_text_channel_2",
    [
        (
            "enabled_in_both",
            {"respond_to_bots": True, "respond_tag_only": False},
            {"respond_to_bots": True, "respond_tag_only": False},
            ["42", "40"],
            ["42", "40"],
        ),
        (
            "enabled_in_channel_1_only",
            {"respond_to_bots": True, "respond_tag_only": False},
            {"respond_to_bots": False, "respond_tag_only": False},
            ["42", "40"],
            None,
        ),
        (
            "disabled_in_both",
            {"respond_to_bots": False, "respond_tag_only": False},
            {"respond_to_bots": False, "respond_tag_only": False},
            None,
            None,
        ),
    ],
)
def test_respond_to_bot(
    slack_test_context,
    test_name,
    channel_1_config,
    channel_2_config,
    expected_text_channel_1,
    expected_text_channel_2,
):
    logger.info(f"Running test: {test_name}")
    (
        slack_bot_client,
        slack_user_client,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config,
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config,
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
            expected_text=expected_text,
        )
        if expected_text is None:
            assert (
                message is None
            ), f"{test_name}: Bot should not respond in {channel_name}"
            continue
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert (
            blocks is not None and len(blocks) > 0
        ), f"{test_name}: Response should have blocks in {channel_name}"
        assert any(
            text in blocks[0]["text"]["text"] for text in expected_text
        ), f"{test_name}: Response should contain one of '{expected_text}'"


"""Test cases for follow_up button"""


@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expect_button_channel_1, expect_button_channel_2",
    [
        (
            "enabled_in_both",
            {"follow_up_tags": ["help@onyx.app"], "respond_to_bots": True},
            {"follow_up_tags": ["help@onyx.app"], "respond_to_bots": True},
            True,
            True,
        ),
        (
            "enabled_in_channel_1_only",
            {"follow_up_tags": ["help@onyx.app"], "respond_to_bots": True},
            {"respond_to_bots": True},
            True,
            False,
        ),
        (
            "disabled_in_both",
            {"respond_to_bots": True},
            {"respond_to_bots": True},
            False,
            False,
        ),
    ],
)
def test_follow_up_tags(
    slack_test_context,
    test_name,
    channel_1_config,
    channel_2_config,
    expect_button_channel_1,
    expect_button_channel_2,
):
    logger.info(f"Running test: {test_name}")
    (
        slack_bot_client,
        slack_user_client,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config,
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config,
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
            tag_bot=True,
        )
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert (
            blocks is not None and len(blocks) > 0
        ), f"{test_name}: Response should have blocks in {channel_name}"
        assert_button_presence(
            blocks, "followup-button", expect_button, test_name, channel_name
        )


"""Test cases for respond to questions in channels"""


@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expected_text_channel_1, expected_text_channel_2, message_text",
    [
        (
            "enabled_in_both",
            {
                "respond_to_bots": True,
                "answer_filters": ["questionmark_prefilter"],
                "respond_tag_only": False,
            },
            {
                "respond_to_bots": True,
                "answer_filters": ["questionmark_prefilter"],
                "respond_tag_only": False,
            },
            None,
            None,
            "How many books did Lena receive last Friday",
        ),
        (
            "enabled_in_channel_1_only",
            {
                "respond_to_bots": True,
                "answer_filters": ["questionmark_prefilter"],
                "respond_tag_only": False,
            },
            {"respond_to_bots": True, "respond_tag_only": False},
            None,
            ["42", "40"],
            "How many books did Lena receive last Friday",
        ),
        (
            "disabled_in_both",
            {"respond_to_bots": True, "respond_tag_only": False},
            {"respond_to_bots": True, "respond_tag_only": False},
            ["42", "40"],
            ["42", "40"],
            "How many books did Lena receive last Friday",
        ),
        (
            "enabled_in_both_with_question",
            {
                "respond_to_bots": True,
                "answer_filters": ["questionmark_prefilter"],
                "respond_tag_only": False,
            },
            {
                "respond_to_bots": True,
                "answer_filters": ["questionmark_prefilter"],
                "respond_tag_only": False,
            },
            ["42", "40"],
            ["42", "40"],
            "How many books did Lena receive last Friday?",
        ),
    ],
)
def test_respond_to_questions(
    slack_test_context,
    test_name,
    channel_1_config,
    channel_2_config,
    expected_text_channel_1,
    expected_text_channel_2,
    message_text,
):
    logger.info(f"Running test: {test_name}")
    (
        slack_bot_client,
        slack_user_client,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config,
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config,
    )

    for channel, expected_text, channel_name in [
        (test_channel_1, expected_text_channel_1, "test_channel_1"),
        (test_channel_2, expected_text_channel_2, "test_channel_2"),
    ]:
        message = send_channel_msg_with_optional_timeout(
            slack_bot_client=slack_bot_client,
            slack_user_client=slack_user_client,
            message_text=message_text,
            channel=channel,
            expected_text=expected_text,
        )
        if expected_text is None:
            assert (
                message is None
            ), f"{test_name}: Bot should not respond in {channel_name}"
            continue
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert (
            blocks is not None and len(blocks) > 0
        ), f"{test_name}: Response should have blocks in {channel_name}"
        assert any(
            text in blocks[0]["text"]["text"] for text in expected_text
        ), f"{test_name}: Response should contain one of '{expected_text}'"


"""Test cases for standard answer category in channels"""


@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expected_text_channel_1, expected_text_channel_2",
    [
        (
            "enabled_in_both",
            "std_ans_category",
            "std_ans_category",
            "support@onyx.app",
            "support@onyx.app",
        ),
        (
            "enabled_in_channel_1_only",
            "std_ans_category",
            {"respond_to_bots": True},
            "support@onyx.app",
            None,
        ),
        (
            "disabled_in_both",
            {"respond_to_bots": True},
            {"respond_to_bots": True},
            None,
            None,
        ),
    ],
)
def test_standard_answer(
    slack_test_context: Dict[str, Any],
    test_name: str,
    channel_1_config: Any,
    channel_2_config: Any,
    expected_text_channel_1: str,
    expected_text_channel_2: str,
):
    logger.info(f"Running test: {test_name}")
    (
        slack_bot_client,
        slack_user_client,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    if channel_1_config == "std_ans_category":
        categories = slack_test_context["std_ans_category"]
        cat_id = categories["id"]
        channel_1_config = {
            "respond_to_bots": True,
            "standard_answer_categories": [cat_id],
        }

    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config,
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    if channel_2_config == "std_ans_category":
        categories = slack_test_context["std_ans_category"]
        cat_id = categories["id"]
        channel_2_config = {
            "respond_to_bots": True,
            "standard_answer_categories": [cat_id],
        }
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config,
    )
    for channel, expected_text, channel_name in [
        (test_channel_1, expected_text_channel_1, "test_channel_1"),
        (test_channel_2, expected_text_channel_2, "test_channel_2"),
    ]:
        message = send_channel_msg_with_optional_timeout(
            slack_bot_client=slack_bot_client,
            slack_user_client=slack_user_client,
            message_text="I need support",
            channel=channel,
            expected_text=expected_text,
            tag_bot=True,
        )
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        if expected_text is None:
            assert (
                "support@onyx.app" not in blocks[0]["text"]["text"]
            ), f"{test_name}: Response should NOT contain the standard answer in {channel_name}"
        else:
            assert (
                expected_text in blocks[0]["text"]["text"]
            ), f"{test_name}: Response should contain '{expected_text}'"


# tag with restrictions
"""Test cases to verify that the bot responds if it is tagged even when 'Respond to Bots'
is disabled, 'Respond to Questions' is enabled and the overall config is disabled."""


@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expected_text_channel_1, expected_text_channel_2",
    [
        (
            "disabled_in_both_respond_to_bots",
            {"respond_to_bots": False},
            {"respond_to_bots": False},
            ["42", "40"],
            ["42", "40"],
        ),
        (
            "respond_to_bots_enabled_respond_to_questions_enabled",
            {"respond_to_bots": False, "answer_filters": ["questionmark_prefilter"]},
            {"respond_to_bots": False, "answer_filters": ["questionmark_prefilter"]},
            ["42", "40"],
            ["42", "40"],
        ),
        (
            "config_disabled",
            {"disabled": True},
            {"disabled": True},
            ["42", "40"],
            ["42", "40"],
        ),
    ],
)
def test_tag_with_restriction(
    slack_test_context: Dict[str, Any],
    test_name: str,
    channel_1_config: Any,
    channel_2_config: Any,
    expected_text_channel_1: List[str],
    expected_text_channel_2: List[str],
):
    logger.info(f"Running test: {test_name}")
    (
        slack_bot_client,
        slack_user_client,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config,
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config,
    )

    for channel, expected_text, channel_name in [
        (test_channel_1, expected_text_channel_1, "test_channel_1"),
        (test_channel_2, expected_text_channel_2, "test_channel_2"),
    ]:
        message = send_and_receive_channel_message(
            slack_user_client=slack_user_client,
            slack_bot_client=slack_bot_client,
            message="How many books did Lena receive last Friday",
            channel=channel,
            tag_bot=True,
        )
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"
        blocks = message["blocks"]
        assert (
            blocks is not None and len(blocks) > 0
        ), f"{test_name}: Response should have blocks in {channel_name}"
        assert any(
            text in blocks[0]["text"]["text"] for text in expected_text
        ), f"{test_name}: Response should contain one of '{expected_text}'"


"""Test cases for citations in channels"""


@pytest.mark.xfail(
    reason="Skipping the test on failure, as we are currently receiving a response regardless of whether a citation is present."
)
@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expected_text_channel_1, expected_text_channel_2, message_text",
    [
        (
            "enabled_in_both",
            {"respond_to_bots": True, "answer_filters": ["well_answered_postfilter"]},
            {"respond_to_bots": True, "answer_filters": ["well_answered_postfilter"]},
            None,
            None,
            "What is the capital of France?",
        ),
        (
            "enabled_in_channel_1_only",
            {"respond_to_bots": True, "answer_filters": ["well_answered_postfilter"]},
            {"respond_to_bots": True},
            None,
            "",
            "What is the capital of France?",
        ),
        (
            "disabled_in_both",
            {"respond_to_bots": True},
            {"respond_to_bots": True},
            "",
            "",
            "What is the capital of France?",
        ),
    ],
)
def test_citation(
    slack_test_context: Dict[str, Any],
    test_name: str,
    channel_1_config: Any,
    channel_2_config: Any,
    expected_text_channel_1: str,
    expected_text_channel_2: str,
    message_text: str,
):
    logger.info(f"Running test: {test_name}")
    (
        slack_bot_client,
        slack_user_client,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config,
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config,
    )

    for channel, expected_text, channel_name in [
        (test_channel_1, expected_text_channel_1, "test_channel_1"),
        (test_channel_2, expected_text_channel_2, "test_channel_2"),
    ]:
        message = send_and_receive_channel_message(
            slack_user_client=slack_user_client,
            slack_bot_client=slack_bot_client,
            message=message_text,
            channel=channel,
            tag_bot=True,
        )
        if expected_text is None:
            assert (
                message is None
            ), f"{test_name}: Bot should not respond in {channel_name}"
            continue
        assert message is not None, f"{test_name}: Bot should respond in {channel_name}"


"""Test cases for llm auto filter in channels"""


def test_llm_auto_filter(slack_test_context: Dict[str, Any]):
    logger.info("Running test: llm_auto_filter")
    (
        slack_bot_client,
        slack_user_client,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)

    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data={"enable_auto_filters": True},
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {test_channel_2}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data={"enable_auto_filters": True},
    )

    for channel in [test_channel_1, test_channel_2]:
        message = send_and_receive_channel_message(
            slack_user_client=slack_user_client,
            slack_bot_client=slack_bot_client,
            message="How many books is mentioned as Lena received in web source?",
            channel=channel,
            tag_bot=True,
        )
        assert message is not None, "Bot should respond"
        blocks = message["blocks"]
        assert blocks is not None and len(blocks) > 0, "Response should have blocks"
        assert "40" in blocks[0]["text"]["text"], "Response should contain '40'"


@pytest.mark.parametrize(
    "test_name, channel_1_config, channel_2_config, expected_text_primary_user, expected_text_secondary_user",
    [
        (
            "enabled_in_both",
            {
                "respond_to_bots": True,
                "respond_member_group_list": ["subashmohan75@gmail.com"],
                "respond_tag_only": False,
            },
            {
                "respond_to_bots": True,
                "respond_member_group_list": ["support"],
                "respond_tag_only": False,
            },
            None,
            ["42", "40"],
        ),
        (
            "disabled_in_both",
            {"respond_to_bots": True},
            {"respond_to_bots": True},
            ["42", "40"],
            ["42", "40"],
        ),
    ],
)
def test_respond_to_certain_users_or_groups(
    slack_test_context: Dict[str, Any],
    test_name: str,
    channel_1_config: Any,
    channel_2_config: Any,
    expected_text_primary_user: str,
    expected_text_secondary_user: str,
):
    logger.info(f"Running test: {test_name}")
    (
        slack_bot_client,
        slack_user_client,
        _,
        admin_user,
        bot_id,
        test_channel_1,
        test_channel_2,
    ) = extract_channel_slack_context(slack_test_context)
    # Update channel 1 config
    logger.info(f"test_channel_1 : {test_channel_1}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        channel_name=test_channel_1["name"],
        updated_config_data=channel_1_config,
    )
    # Update default config (applies to channel 2)
    logger.info(f"Channel 2 config: {channel_2_config}")
    update_channel_config(
        bot_id=bot_id,
        user_performing_action=admin_user,
        updated_config_data=channel_2_config,
    )

    for channel in [test_channel_1, test_channel_2]:
        ts = send_message_to_channel(
            slack_user_client=slack_user_client,
            slack_bot_client=slack_bot_client,
            message="How many books did Lena receive last Friday?",
            channel=channel,
            tag_bot=True,
        )
        assert ts is not None, "Bot should respond"
        reply = SlackManager.poll_for_reply(
            slack_user_client,
            channel=channel,
            original_message_ts=ts,
            timeout_seconds=180,
        )
        logger.info(f"Received message as primary user: {reply}")
        assert reply is not None, "Bot should respond"
        if expected_text_primary_user is None:
            assert (
                "42" not in reply["text"] and "40" not in reply["text"]
            ), "Response should NOT contain '42' or '40'"
        else:
            blocks = reply["blocks"]
            assert blocks is not None and len(blocks) > 0, "Response should have blocks"
            assert any(
                text in blocks[0]["text"]["text"] for text in expected_text_primary_user
            ), f"Response should contain one of '{expected_text_primary_user}'"

        with get_session_context_manager() as session:
            user = get_slack_user_record(session)
            user_id = user.id
            logger.info(f"Slack user ID: {user_id}")
            _, messages = get_last_chat_session_and_messages(
                user_id=user_id, db_session=session
            )
            assert (
                messages is not None and len(messages) > 0
            ), "Response should have messages"
            for message in messages:
                if message.message_type == "ASSISTANT":
                    assert message.message is not None, "Response should have messages"
                    assert any(
                        text in message.message for text in expected_text_secondary_user
                    ), f"Response should contain one of '{expected_text_secondary_user}'"
