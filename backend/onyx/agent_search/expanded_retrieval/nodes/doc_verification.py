import json

from langchain_core.messages import HumanMessage

from onyx.agent_search.expanded_retrieval.states import DocVerificationInput
from onyx.agent_search.expanded_retrieval.states import DocVerificationUpdate
from onyx.agent_search.shared_graph_utils.models import BinaryDecision
from onyx.agent_search.shared_graph_utils.prompts import VERIFIER_PROMPT


def doc_verification(state: DocVerificationInput) -> DocVerificationUpdate:
    """
    Check whether the document is relevant for the original user question

    Args:
        state (DocVerificationInput): The current state

    Updates:
        verified_documents: list[InferenceSection]
    """

    state["search_request"].query
    question = state["question"]
    doc_to_verify = state["doc_to_verify"]
    document_content = doc_to_verify.combined_content

    msg = [
        HumanMessage(
            content=VERIFIER_PROMPT.format(
                question=question, document_content=document_content
            )
        )
    ]

    fast_llm = state["fast_llm"]
    response = json.loads(
        str(fast_llm.invoke(msg, structured_response_format=BinaryDecision).content)
    )

    # response_string = response.content.get("decision", "no").lower()
    # Convert string response to proper dictionary format
    # decision_dict = {"decision": response.content.lower()}

    verified_documents = []
    if response["decision"] == "yes":
        verified_documents.append(doc_to_verify)

    return DocVerificationUpdate(
        verified_documents=verified_documents,
    )
