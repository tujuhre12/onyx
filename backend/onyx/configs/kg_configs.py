import os

KG_OWN_EMAIL_DOMAINS: str | list[str] = os.environ.get(
    "KG_OWN_EMAIL_DOMAINS", []
)  # must be list

KG_IGNORE_EMAIL_DOMAINS: str | list[str] = os.environ.get(
    "KG_IGNORE_EMAIL_DOMAINS", []
)  # must be list

KG_OWN_COMPANY: str = os.environ.get("KG_OWN_COMPANY", "")
