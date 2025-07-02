# Prompts that aren't part of a particular configurable feature

LANGUAGE_REPHRASE_PROMPT = """
Translate query to {target_language}.
If the query at the end is already in {target_language}, simply repeat the ORIGINAL query back to me, EXACTLY as is with no edits.
If the query below is not in {target_language}, translate it into {target_language}.

Query:
{query}
""".strip()

SIMPLE_QUERY_EXPANSION_PROMPT = """
Generate {num_expansions} alternative phrasings of the following query in the same language.
The goal is to express the same intent in different ways that might retrieve different relevant documents.

Guidelines:
- Keep the same meaning and intent as the original query
- Use different vocabulary and sentence structures
- Make each expansion distinct from the others
- Focus on different aspects or angles of the query
- Use synonyms, different verb forms, or alternative phrasings

Original query:
{query}

Respond with EXACTLY {num_expansions} alternative queries, one per line. Do not include any explanations or numbering.

Alternative queries:
""".strip()

SLACK_LANGUAGE_REPHRASE_PROMPT = """
As an AI assistant employed by an organization, \
your role is to transform user messages into concise \
inquiries suitable for a Large Language Model (LLM) that \
retrieves pertinent materials within a Retrieval-Augmented \
Generation (RAG) framework. Ensure to reply in the identical \
language as the original request. When faced with multiple \
questions within a single query, distill them into a singular, \
unified question, disregarding any direct mentions.

Query:
{query}
""".strip()


# Use the following for easy viewing of prompts
if __name__ == "__main__":
    print(LANGUAGE_REPHRASE_PROMPT)
    print(SIMPLE_QUERY_EXPANSION_PROMPT)
