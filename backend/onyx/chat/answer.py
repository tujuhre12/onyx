import csv
import json
import os
from collections import defaultdict
from collections.abc import Callable
from pathlib import Path
from uuid import UUID

from langchain_core.messages import HumanMessage
from sqlalchemy.orm import Session

from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.models import GraphInputs
from onyx.agents.agent_search.models import GraphPersistence
from onyx.agents.agent_search.models import GraphSearchConfig
from onyx.agents.agent_search.models import GraphTooling
from onyx.agents.agent_search.run_graph import run_agent_search_graph
from onyx.agents.agent_search.run_graph import run_basic_graph
from onyx.agents.agent_search.run_graph import (
    run_basic_graph as run_hackathon_graph,
)  # You can create your own graph
from onyx.agents.agent_search.run_graph import run_dc_graph
from onyx.agents.agent_search.run_graph import run_kb_graph
from onyx.chat.models import AgentAnswerPiece
from onyx.chat.models import AnswerPacket
from onyx.chat.models import AnswerStream
from onyx.chat.models import AnswerStyleConfig
from onyx.chat.models import CitationInfo
from onyx.chat.models import OnyxAnswerPiece
from onyx.chat.models import StreamStopInfo
from onyx.chat.models import StreamStopReason
from onyx.chat.models import SubQuestionKey
from onyx.chat.models import ToolCallFinalResult
from onyx.chat.prompt_builder.answer_prompt_builder import AnswerPromptBuilder
from onyx.configs.agent_configs import AGENT_ALLOW_REFINEMENT
from onyx.configs.agent_configs import INITIAL_SEARCH_DECOMPOSITION_ENABLED
from onyx.configs.app_configs import HACKATHON_OUTPUT_CSV_PATH
from onyx.configs.chat_configs import USE_DIV_CON_AGENT
from onyx.configs.constants import BASIC_KEY
from onyx.context.search.models import RerankingDetails
from onyx.db.kg_config import get_kg_config_settings
from onyx.db.models import Persona
from onyx.file_store.utils import InMemoryChatFile
from onyx.llm.interfaces import LLM
from onyx.tools.force import ForceUseTool
from onyx.tools.tool import Tool
from onyx.tools.tool_implementations.search.search_tool import SearchTool
from onyx.tools.utils import explicit_tool_calling_supported
from onyx.utils.gpu_utils import fast_gpu_status_request
from onyx.utils.logger import setup_logger

logger = setup_logger()

BASIC_SQ_KEY = SubQuestionKey(level=BASIC_KEY[0], question_num=BASIC_KEY[1])


def _calc_score_for_pos(pos: int, max_acceptable_pos: int = 15) -> float:
    """
    Calculate the score for a given position.
    """
    if pos > max_acceptable_pos:
        return 0

    elif pos == 1:
        return 1
    elif pos == 2:
        return 0.8
    else:
        return 4 / (pos + 5)


def _clean_doc_id_link(doc_link: str) -> str:
    """
    Clean the google doc link.
    """
    if "google.com" in doc_link:
        if "/edit" in doc_link:
            return "/edit".join(doc_link.split("/edit")[:-1])
        elif "/view" in doc_link:
            return "/view".join(doc_link.split("/view")[:-1])
        else:
            return doc_link

    if "app.fireflies.ai" in doc_link:
        return "?".join(doc_link.split("?")[:-1])
    return doc_link


def _get_doc_score(doc_id: str, doc_results: list[str]) -> float:
    """
    Get the score of a document from the document results.
    """

    match_pos = None
    for pos, comp_doc in enumerate(doc_results, start=1):

        clear_doc_id = _clean_doc_id_link(doc_id)
        clear_comp_doc = _clean_doc_id_link(comp_doc)

        if clear_doc_id == clear_comp_doc:
            match_pos = pos

    if match_pos is None:
        return 0.0

    return _calc_score_for_pos(match_pos)


def _append_empty_line(csv_path: str = HACKATHON_OUTPUT_CSV_PATH) -> None:
    """
    Append an empty line to the CSV file.
    """
    _append_answer_to_csv("", "", csv_path)


def _append_ground_truth_to_csv(
    query: str,
    ground_truth_docs: list[str],
    csv_path: str = HACKATHON_OUTPUT_CSV_PATH,
) -> None:
    """
    Append the score to the CSV file.
    """

    file_exists = os.path.isfile(csv_path)

    # Create directory if it doesn't exist
    csv_dir = os.path.dirname(csv_path)
    if csv_dir and not os.path.exists(csv_dir):
        Path(csv_dir).mkdir(parents=True, exist_ok=True)

    with open(csv_path, mode="a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)

        # Write header if file is new
        if not file_exists:
            writer.writerow(["query", "position", "document_id", "answer", "score"])

        # Write the ranking stats

        for doc_id in ground_truth_docs:
            writer.writerow([query, "-1", _clean_doc_id_link(doc_id), "", ""])

    logger.debug("Appended score to csv file")


def _append_score_to_csv(
    query: str,
    score: float,
    csv_path: str = HACKATHON_OUTPUT_CSV_PATH,
) -> None:
    """
    Append the score to the CSV file.
    """

    file_exists = os.path.isfile(csv_path)

    # Create directory if it doesn't exist
    csv_dir = os.path.dirname(csv_path)
    if csv_dir and not os.path.exists(csv_dir):
        Path(csv_dir).mkdir(parents=True, exist_ok=True)

    with open(csv_path, mode="a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)

        # Write header if file is new
        if not file_exists:
            writer.writerow(["query", "position", "document_id", "answer", "score"])

        # Write the ranking stats

        writer.writerow([query, "", "", "", score])

    logger.debug("Appended score to csv file")


def _append_search_results_to_csv(
    query: str,
    doc_results: list[str],
    csv_path: str = HACKATHON_OUTPUT_CSV_PATH,
) -> None:
    """
    Append the search results to the CSV file.
    """

    file_exists = os.path.isfile(csv_path)

    # Create directory if it doesn't exist
    csv_dir = os.path.dirname(csv_path)
    if csv_dir and not os.path.exists(csv_dir):
        Path(csv_dir).mkdir(parents=True, exist_ok=True)

    with open(csv_path, mode="a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)

        # Write header if file is new
        if not file_exists:
            writer.writerow(["query", "position", "document_id", "answer", "score"])

        # Write the ranking stats

        for pos, doc in enumerate(doc_results, start=1):
            writer.writerow([query, pos, _clean_doc_id_link(doc), "", ""])

    logger.debug("Appended search results to csv file")


def _append_answer_to_csv(
    query: str,
    answer: str,
    csv_path: str = HACKATHON_OUTPUT_CSV_PATH,
) -> None:
    """
    Append ranking statistics to a CSV file.

    Args:
        ranking_stats: List of tuples containing (query, hit_position, document_id)
        csv_path: Path to the CSV file to append to
    """
    file_exists = os.path.isfile(csv_path)

    # Create directory if it doesn't exist
    csv_dir = os.path.dirname(csv_path)
    if csv_dir and not os.path.exists(csv_dir):
        Path(csv_dir).mkdir(parents=True, exist_ok=True)

    with open(csv_path, mode="a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)

        # Write header if file is new
        if not file_exists:
            writer.writerow(["query", "position", "document_id", "answer", "score"])

        # Write the ranking stats

        writer.writerow([query, "", "", answer, ""])

    logger.debug("Appended answer to csv file")


class Answer:
    def __init__(
        self,
        prompt_builder: AnswerPromptBuilder,
        answer_style_config: AnswerStyleConfig,
        llm: LLM,
        fast_llm: LLM,
        force_use_tool: ForceUseTool,
        persona: Persona | None,
        rerank_settings: RerankingDetails | None,
        chat_session_id: UUID,
        current_agent_message_id: int,
        db_session: Session,
        # newly passed in files to include as part of this question
        # TODO THIS NEEDS TO BE HANDLED
        latest_query_files: list[InMemoryChatFile] | None = None,
        tools: list[Tool] | None = None,
        # NOTE: for native tool-calling, this is only supported by OpenAI atm,
        #       but we only support them anyways
        # if set to True, then never use the LLMs provided tool-calling functonality
        skip_explicit_tool_calling: bool = False,
        skip_gen_ai_answer_generation: bool = False,
        is_connected: Callable[[], bool] | None = None,
        use_agentic_search: bool = False,
    ) -> None:
        self.is_connected: Callable[[], bool] | None = is_connected
        self._processed_stream: list[AnswerPacket] | None = None
        self._is_cancelled = False

        search_tools = [tool for tool in (tools or []) if isinstance(tool, SearchTool)]
        search_tool: SearchTool | None = None

        if len(search_tools) > 1:
            # TODO: handle multiple search tools
            raise ValueError("Multiple search tools found")
        elif len(search_tools) == 1:
            search_tool = search_tools[0]

        using_tool_calling_llm = (
            explicit_tool_calling_supported(
                llm.config.model_provider, llm.config.model_name
            )
            and not skip_explicit_tool_calling
        )

        using_cloud_reranking = (
            rerank_settings is not None
            and rerank_settings.rerank_provider_type is not None
        )
        allow_agent_reranking = using_cloud_reranking or fast_gpu_status_request(
            indexing=False
        )

        self.graph_inputs = GraphInputs(
            persona=persona,
            rerank_settings=rerank_settings,
            prompt_builder=prompt_builder,
            files=latest_query_files,
            structured_response_format=answer_style_config.structured_response_format,
        )
        self.graph_tooling = GraphTooling(
            primary_llm=llm,
            fast_llm=fast_llm,
            search_tool=search_tool,
            tools=tools or [],
            force_use_tool=force_use_tool,
            using_tool_calling_llm=using_tool_calling_llm,
        )
        self.graph_persistence = GraphPersistence(
            db_session=db_session,
            chat_session_id=chat_session_id,
            message_id=current_agent_message_id,
        )
        self.search_behavior_config = GraphSearchConfig(
            use_agentic_search=use_agentic_search,
            skip_gen_ai_answer_generation=skip_gen_ai_answer_generation,
            allow_refinement=AGENT_ALLOW_REFINEMENT,
            allow_agent_reranking=allow_agent_reranking,
            perform_initial_search_decomposition=INITIAL_SEARCH_DECOMPOSITION_ENABLED,
            kg_config_settings=get_kg_config_settings(),
        )
        self.graph_config = GraphConfig(
            inputs=self.graph_inputs,
            tooling=self.graph_tooling,
            persistence=self.graph_persistence,
            behavior=self.search_behavior_config,
        )

    @property
    def processed_streamed_output(self) -> AnswerStream:

        _HACKATHON_TEST_EXECUTION = False

        if self._processed_stream is not None:
            yield from self._processed_stream
            return

        if self.graph_config.behavior.use_agentic_search and (
            self.graph_config.inputs.persona
            and self.graph_config.behavior.kg_config_settings.KG_ENABLED
            and self.graph_config.inputs.persona.name.startswith("KG Beta")
        ):
            run_langgraph = run_kb_graph
        elif self.graph_config.behavior.use_agentic_search:
            run_langgraph = run_agent_search_graph
        elif (
            self.graph_config.inputs.persona
            and USE_DIV_CON_AGENT
            and self.graph_config.inputs.persona.description.startswith(
                "DivCon Beta Agent"
            )
        ):
            run_langgraph = run_dc_graph

        elif (
            self.graph_config.inputs.persona
            and self.graph_config.inputs.persona.description.startswith(
                "Hackathon Test"
            )
        ):
            _HACKATHON_TEST_EXECUTION = True
            run_langgraph = run_hackathon_graph

        else:
            run_langgraph = run_basic_graph

        if _HACKATHON_TEST_EXECUTION:

            input_data = str(self.graph_config.inputs.prompt_builder.raw_user_query)

            if input_data.startswith("["):
                input_type = "json"
                input_list = json.loads(input_data)
            else:
                input_type = "list"
                input_list = input_data.split(";")

            num_examples_with_ground_truth = 0
            total_score = 0.0

            question = ""
            for question_num, question_data in enumerate(input_list):

                ground_truth_docs = None
                if input_type == "json":
                    question = question_data["question"]
                    ground_truth = question_data.get("ground_truth")
                    if ground_truth:
                        ground_truth_docs = [x.get("doc_link") for x in ground_truth]
                        logger.info(f"Question {question_num}: {question}")
                        _append_ground_truth_to_csv(question, ground_truth_docs)
                    else:
                        continue
                else:
                    question = question_data

                self.graph_config.inputs.prompt_builder.raw_user_query = question
                self.graph_config.inputs.prompt_builder.user_message_and_token_cnt = (
                    HumanMessage(
                        content=question, additional_kwargs={}, response_metadata={}
                    ),
                    2,
                )
                self.graph_config.tooling.force_use_tool.force_use = True

                stream = run_langgraph(
                    self.graph_config,
                )
                processed_stream = []
                for packet in stream:
                    if self.is_cancelled():
                        packet = StreamStopInfo(stop_reason=StreamStopReason.CANCELLED)
                        yield packet
                        break
                    processed_stream.append(packet)
                    yield packet

                llm_answer_segments: list[str] = []
                doc_results: list[str] | None = None
                for answer_piece in processed_stream:
                    if isinstance(answer_piece, OnyxAnswerPiece):
                        llm_answer_segments.append(answer_piece.answer_piece or "")
                    elif isinstance(answer_piece, ToolCallFinalResult):
                        doc_results = [x.get("link") for x in answer_piece.tool_result]

                if doc_results:
                    _append_search_results_to_csv(question, doc_results)

                _append_answer_to_csv(question, "".join(llm_answer_segments))

                if ground_truth_docs and doc_results:
                    num_examples_with_ground_truth += 1
                    doc_score = 0.0
                    for doc_id in ground_truth_docs:
                        doc_score += _get_doc_score(doc_id, doc_results)

                    _append_score_to_csv(question, doc_score)
                    total_score += doc_score

                self._processed_stream = processed_stream

            if num_examples_with_ground_truth > 0:
                comprehensive_score = total_score / num_examples_with_ground_truth
            else:
                comprehensive_score = 0

            _append_empty_line()

            _append_score_to_csv(question, comprehensive_score)

        else:

            stream = run_langgraph(
                self.graph_config,
            )

            processed_stream = []
            for packet in stream:
                if self.is_cancelled():
                    packet = StreamStopInfo(stop_reason=StreamStopReason.CANCELLED)
                    yield packet
                    break
                processed_stream.append(packet)
                yield packet
            self._processed_stream = processed_stream

    @property
    def llm_answer(self) -> str:
        answer = ""
        for packet in self.processed_streamed_output:
            # handle basic answer flow, plus level 0 agent answer flow
            # since level 0 is the first answer the user sees and therefore the
            # child message of the user message in the db (so it is handled
            # like a basic flow answer)
            if (isinstance(packet, OnyxAnswerPiece) and packet.answer_piece) or (
                isinstance(packet, AgentAnswerPiece)
                and packet.answer_piece
                and packet.answer_type == "agent_level_answer"
                and packet.level == 0
            ):
                answer += packet.answer_piece

        return answer

    def llm_answer_by_level(self) -> dict[int, str]:
        answer_by_level: dict[int, str] = defaultdict(str)
        for packet in self.processed_streamed_output:
            if (
                isinstance(packet, AgentAnswerPiece)
                and packet.answer_piece
                and packet.answer_type == "agent_level_answer"
            ):
                assert packet.level is not None
                answer_by_level[packet.level] += packet.answer_piece
            elif isinstance(packet, OnyxAnswerPiece) and packet.answer_piece:
                answer_by_level[BASIC_KEY[0]] += packet.answer_piece
        return answer_by_level

    @property
    def citations(self) -> list[CitationInfo]:
        citations: list[CitationInfo] = []
        for packet in self.processed_streamed_output:
            if isinstance(packet, CitationInfo) and packet.level is None:
                citations.append(packet)

        return citations

    def citations_by_subquestion(self) -> dict[SubQuestionKey, list[CitationInfo]]:
        citations_by_subquestion: dict[SubQuestionKey, list[CitationInfo]] = (
            defaultdict(list)
        )
        basic_subq_key = SubQuestionKey(level=BASIC_KEY[0], question_num=BASIC_KEY[1])
        for packet in self.processed_streamed_output:
            if isinstance(packet, CitationInfo):
                if packet.level_question_num is not None and packet.level is not None:
                    citations_by_subquestion[
                        SubQuestionKey(
                            level=packet.level, question_num=packet.level_question_num
                        )
                    ].append(packet)
                elif packet.level is None:
                    citations_by_subquestion[basic_subq_key].append(packet)
        return citations_by_subquestion

    def is_cancelled(self) -> bool:
        if self._is_cancelled:
            return True

        if self.is_connected is not None:
            if not self.is_connected():
                logger.debug("Answer stream has been cancelled")
            self._is_cancelled = not self.is_connected()

        return self._is_cancelled
