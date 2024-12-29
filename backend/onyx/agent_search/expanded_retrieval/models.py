from operator import add
from typing import Annotated

from pydantic import BaseModel

from onyx.agent_search.shared_graph_utils.models import AgentChunkStats
from onyx.agent_search.shared_graph_utils.models import RetrievalFitStats
from onyx.context.search.models import InferenceSection

### Models ###


class QueryResult(BaseModel):
    query: str
    search_results: list[InferenceSection]
    stats: RetrievalFitStats | None


class ExpandedRetrievalResult(BaseModel):
    expanded_queries_results: list[QueryResult]
    all_documents: list[InferenceSection]
    sub_question_retrieval_stats: Annotated[list[AgentChunkStats], add]
