PERSONA_CATEGORY_GENERATION_PROMPT = """
Based on the assistant's name, description, and instructions, generate {num_categories}
 **unique and diverse** {category_or_categories} that {represent_or_represents} different types of starter messages a user
 might send to initiate a conversation with this chatbot assistant.

**Ensure that the {category_or_categories} {is_or_are} relevant and {covers_or_cover}
topics related to the assistant's capabilities.**

Provide the {category_or_categories} as a JSON array of {string_or_strings} **without any code fences or additional text**.

**Context about the assistant:**
- **Name**: {name}
- **Description**: {description}
- **Instructions**: {instructions}
""".strip().format(
    num_categories="{num_categories}",
    category_or_categories="category" if "{num_categories}" == "1" else "categories",
    represent_or_represents="represents" if "{num_categories}" == "1" else "represent",
    is_or_are="is" if "{num_categories}" == "1" else "are",
    covers_or_cover="covers" if "{num_categories}" == "1" else "cover",
    string_or_strings="string" if "{num_categories}" == "1" else "strings",
    name="{name}",
    description="{description}",
    instructions="{instructions}",
)

PERSONA_STARTER_MESSAGE_CREATION_PROMPT = """
Create a starter message that a **user** might send to initiate a conversation with a chatbot assistant.

{category_prompt}

Your response should only include the actual message that the user would send to the assistant.
This should be natural, engaging, and encourage a helpful response from the assistant.
**Avoid overly specific details; keep the message general and broadly applicable.**

For example:
- Instead of "I've just adopted a 6-month-old Labrador puppy who's pulling on the leash,"
write "I'm having trouble training my new puppy to walk nicely on a leash."
Do not provide any additional text or explanation and be extremely concise

**Context about the assistant:**
- **Name**: {name}
- **Description**: {description}
- **Instructions**: {instructions}
""".strip()


def format_persona_starter_message_prompt(
    name: str, description: str, instructions: str, category: str | None = None
):
    category_prompt = f"**Category**: {category}" if category else ""
    return PERSONA_STARTER_MESSAGE_CREATION_PROMPT.format(
        category_prompt=category_prompt,
        name=name,
        description=description,
        instructions=instructions,
    )


if __name__ == "__main__":
    print(PERSONA_CATEGORY_GENERATION_PROMPT)
    print(PERSONA_STARTER_MESSAGE_CREATION_PROMPT)
