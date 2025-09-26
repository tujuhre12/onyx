import json
from typing import List

from agents import function_tool
from agents import RunContextWrapper

from onyx.agents.agent_search.dr.sub_agents.web_search.providers import (
    get_default_provider,
)
from onyx.chat.turn.models import MyContext
from onyx.configs.constants import DocumentSource
from onyx.server.query_and_chat.streaming_models import Packet
from onyx.server.query_and_chat.streaming_models import SavedSearchDoc
from onyx.server.query_and_chat.streaming_models import SearchToolDelta
from onyx.server.query_and_chat.streaming_models import SearchToolStart


def short_tag(link: str, i: int) -> str:
    # Stable, readable; index keeps it deterministic across a batch
    return f"S{i+1}"


@function_tool
def web_search(run_context: RunContextWrapper[MyContext], query: str) -> str:
    """
    Perform a live search on the public internet.

    Use this tool when you need fresh or external information not found
    in the conversation. It returns a ranked list of web pages with titles,
    snippets, and URLs.

    Args:
        query: The natural-language search query.
    """
    search_provider = get_default_provider()
    run_context.context.run_dependencies.emitter.emit(
        Packet(
            ind=run_context.context.current_run_step + 1,
            obj=SearchToolStart(
                type="internal_search_tool_start", is_internet_search=True
            ),
        )
    )
    run_context.context.run_dependencies.emitter.emit(
        Packet(
            ind=run_context.context.current_run_step + 1,
            obj=SearchToolDelta(
                type="internal_search_tool_delta", queries=[query], documents=None
            ),
        )
    )
    hits = search_provider.search(query)
    results = []
    for i, r in enumerate(hits):
        results.append(
            {
                "tag": short_tag(r.link, i),  # <-- add a tag
                "title": r.title,
                "link": r.link,
                "snippet": r.snippet,
                "author": r.author,
                "published_date": (
                    r.published_date.isoformat() if r.published_date else None
                ),
            }
        )
    run_context.context.current_run_step += 2
    return json.dumps({"results": results})


@function_tool
def web_fetch(run_context: RunContextWrapper[MyContext], urls: List[str]) -> str:
    """
    Fetch and extract the text content from a specific web page.

    Use this tool after identifying relevant URLs (for example from
    `web_search`) to read the full content. It returns the cleaned page
    text and metadata.

    Args:
        urls: The full URLs of the pages to retrieve.
    """
    search_provider = get_default_provider()
    saved_search_docs = [
        SavedSearchDoc(
            document_id=url,
            chunk_ind=0,
            semantic_identifier=url,
            link=url,
            blurb=url,
            source_type=DocumentSource.WEB,
            boost=1,
            hidden=False,
            metadata={},
            score=0.0,
            is_relevant=None,
            relevance_explanation=None,
            match_highlights=[],
            updated_at=None,
            primary_owners=None,
            secondary_owners=None,
            is_internet=True,
        )
        for url in urls
    ]
    run_context.context.run_dependencies.emitter.emit(
        Packet(
            ind=run_context.context.current_run_step + 1,
            obj=SearchToolDelta(
                type="internal_search_tool_delta",
                is_internet_search=True,
                documents=saved_search_docs,
            ),
        )
    )
    docs = search_provider.contents(urls)
    out = []
    for i, d in enumerate(docs):
        out.append(
            {
                "tag": short_tag(d.link, i),  # <-- add a tag
                "title": d.title,
                "link": d.link,
                "full_content": d.full_content,
                "published_date": (
                    d.published_date.isoformat() if d.published_date else None
                ),
            }
        )
    return json.dumps({"results": out})
