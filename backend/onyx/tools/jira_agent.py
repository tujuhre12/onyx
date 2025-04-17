from collections.abc import Generator
from typing import Any
from typing import cast
from typing import TypeVar

from langchain_core.messages import HumanMessage

from onyx.chat.prompt_builder.answer_prompt_builder import AnswerPromptBuilder
from onyx.llm.interfaces import LLM
from onyx.llm.models import PreviousMessage
from onyx.tools.base_tool import BaseTool
from onyx.tools.message import ToolCallSummary
from onyx.tools.models import ToolResponse
from onyx.utils.logger import setup_logger
from onyx.utils.special_types import JSON_ro

OVERRIDE_T = TypeVar("OVERRIDE_T")

QUERY_FIELD = "query"

logger = setup_logger()


class JiraAgentTool(BaseTool):
    """Tool for querying Jira directly"""

    _NAME = "Jira_Agent"
    _DESCRIPTION = "This tool will fetch the results based on a user query."
    _DISPLAY_NAME = "Jira Tool"

    def __init__(self) -> None:
        super().__init__()

    @property
    def name(self) -> str:
        return self._NAME

    @property
    def description(self) -> str:
        return self._DESCRIPTION

    @property
    def display_name(self) -> str:
        return self._DISPLAY_NAME

    def tool_definition(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "user_query": {
                        "type": "string",
                        "description": "The user query that is sent to the LLM.",
                    },
                },
                "required": ["user_query"],
            },
        }

    def build_tool_message_content(
        self, *args: "ToolResponse"
    ) -> str | list[str | dict[str, Any]]:
        return "hi"

    def get_args_for_non_tool_calling_llm(
        self,
        query: str,
        history: list[PreviousMessage],
        llm: LLM,
        force_run: bool = False,
    ) -> dict[str, JSON_ro] | None:
        response = llm.invoke(prompt="Who is the CEO of google?")
        logger.info("Intermediate LLM Query ---------->")
        logger.info(response)
        return {QUERY_FIELD: query, "jql": response.content}

    def run(
        self, override_kwargs: OVERRIDE_T | None = None, **llm_kwargs: Any
    ) -> Generator["ToolResponse", None, None]:
        query = cast(str, llm_kwargs[QUERY_FIELD])
        jql = cast(str, llm_kwargs["jql"])
        logger.info("Jira Agent Tool Query ---------->")
        logger.info(query)
        logger.info("Jira Agent Tool JQL ---------->")
        logger.info(jql)

        yield ToolResponse(
            id="jira_agent", response="Bob's task for the day is to fix the Jira bug"
        )

    def final_result(self, *args: "ToolResponse") -> JSON_ro:
        """
        This is the "final summary" result of the tool.
        It is the result that will be stored in the database.
        """
        response = cast(str, args[0].response)
        return {"response": response}

    def build_next_prompt(
        self,
        prompt_builder: AnswerPromptBuilder,
        tool_call_summary: ToolCallSummary,
        tool_responses: list[ToolResponse],
        using_tool_calling_llm: bool,
    ) -> AnswerPromptBuilder:
        # this will be what is yielded in `run`
        tool_response = tool_responses[0].response
        prompt_builder.update_user_prompt(
            HumanMessage(
                content=f"The user query is: {prompt_builder.get_user_message_content()}. "
                f"The tool response is: {tool_response}"
            )
        )
        return prompt_builder
