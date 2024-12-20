from langchain_core.messages import HumanMessage

from onyx.agent_search.main.states import InitialAnswerBASEUpdate
from onyx.agent_search.main.states import MainState
from onyx.agent_search.shared_graph_utils.prompts import INITIAL_RAG_BASE_PROMPT
from onyx.agent_search.shared_graph_utils.utils import format_docs


def generate_initial_base_answer(state: MainState) -> InitialAnswerBASEUpdate:
    print("---GENERATE INITIAL BASE ANSWER---")

    question = state["search_request"].query
    original_question_docs = state["all_original_question_documents"]

    msg = [
        HumanMessage(
            content=INITIAL_RAG_BASE_PROMPT.format(
                question=question,
                context=format_docs(original_question_docs),
            )
        )
    ]

    # Grader
    model = state["fast_llm"]
    response = model.invoke(msg)
    answer = response.pretty_repr()

    print()
    print(f"---INITIAL BASE ANSWER START---  {answer}  ---INITIAL BASE ANSWER  END---")
    return InitialAnswerBASEUpdate(initial_base_answer=answer)
