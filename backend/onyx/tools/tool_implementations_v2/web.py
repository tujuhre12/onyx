import json
from typing import List

from agents import function_tool
from agents import RunContextWrapper

from onyx.agents.agent_search.dr.sub_agents.web_search.providers import (
    get_default_provider,
)
from onyx.chat.turn.models import MyContext


def short_tag(link: str, i: int) -> str:
    # Stable, readable; index keeps it deterministic across a batch
    return f"S{i+1}"


@function_tool
def web_search(run_context: RunContextWrapper[MyContext], query: str) -> str:
    """Search the web for information. This tool provides urls and short snippets,
    but does not fetch the full content of the urls."""
    search_provider = get_default_provider()
    run_context.run_dependencies.emitter.emit(kind="web-search", data={"query": query})
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
    return json.dumps({"results": results})


@function_tool
def web_fetch(run_context: RunContextWrapper[MyContext], urls: List[str]) -> str:
    """Fetch the full contents of a list of URLs."""
    search_provider = get_default_provider()
    run_context.run_dependencies.emitter.emit(kind="web-fetch", data={"urls": urls})
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
