import os

KG_OWN_EMAIL_DOMAINS = os.environ.get(
    "KG_OWN_EMAIL_DOMAINS", ["onyx.app", "danswer.ai"]
)
KG_IGNORE_EMAIL_DOMAINS = os.environ.get(
    "KG_IGNORE_EMAIL_DOMAINS", ["calendar.google.com", "assistant.gong.io"]
)
KG_OWN_COMPANY = os.environ.get("KG_OWN_COMPANY", "Onyx")
