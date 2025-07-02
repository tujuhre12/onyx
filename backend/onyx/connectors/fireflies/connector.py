import os
from collections.abc import Iterator
from datetime import datetime
from datetime import timezone
from typing import cast
from typing import List

import openai
import requests
from pydantic import BaseModel

from onyx.configs.app_configs import INDEX_BATCH_SIZE
from onyx.configs.constants import DocumentSource
from onyx.connectors.interfaces import GenerateDocumentsOutput
from onyx.connectors.interfaces import LoadConnector
from onyx.connectors.interfaces import PollConnector
from onyx.connectors.interfaces import SecondsSinceUnixEpoch
from onyx.connectors.models import BasicExpertInfo
from onyx.connectors.models import ConnectorMissingCredentialError
from onyx.connectors.models import Document
from onyx.connectors.models import ImageSection
from onyx.connectors.models import TextSection
from onyx.utils.logger import setup_logger

logger = setup_logger()

_FIREFLIES_ID_PREFIX = "FIREFLIES_"

_FIREFLIES_API_URL = "https://api.fireflies.ai/graphql"

_FIREFLIES_TRANSCRIPT_QUERY_SIZE = 50  # Max page size is 50

_FIREFLIES_API_QUERY = """
    query Transcripts($fromDate: DateTime, $toDate: DateTime, $limit: Int!, $skip: Int!) {
        transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit, skip: $skip) {
            id
            title
            organizer_email
            participants
            date
            transcript_url
            sentences {
                text
                speaker_name
                start_time
            }
        }
    }
"""

ONE_MINUTE = 60


class DocumentClassificationResult(BaseModel):
    categories: list[str]
    entities: list[str]


def _extract_categories_and_entities(
    sections: list[TextSection | ImageSection],
) -> dict[str, list[str]]:
    """Extract categories and entities from document sections with retry logic."""
    import time
    import random

    prompt = """
                Analyze this document, classify it with categories, and extract important entities.

                CATEGORIES:
                Create up to 5 simple categories that best capture what this document is about. Consider categories within:
                - Document type (e.g., Manual, Report, Email, Transcript, etc.)
                - Content domain (e.g., Technical, Financial, HR, Marketing, etc.)
                - Purpose (e.g., Training, Reference, Announcement, Analysis, etc.)
                - Industry/Topic area (e.g., Software Development, Sales, Legal, etc.)

                Be creative and specific. Use clear, descriptive terms that someone searching for this document might use.
                Categories should be up to 2 words each.

                ENTITIES:
                Extract up to 5 important proper nouns, such as:
                - Company names (e.g., Microsoft, Google, Acme Corp)
                - Product names (e.g., Office 365, Salesforce, iPhone)
                - People's names (e.g. John, Jane, Ahmed, Wenjie, etc.)
                - Department names (e.g., Engineering, Marketing, HR)
                - Project names (e.g., Project Alpha, Migration 2024)
                - Technology names (e.g., PostgreSQL, React, AWS)
                - Location names (e.g., New York Office, Building A)
            """

    # Retry configuration
    max_retries = 3
    base_delay = 1.0  # seconds
    backoff_factor = 2.0

    for attempt in range(max_retries + 1):
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OPENAI_API_KEY not set, skipping metadata extraction")
                return {"categories": [], "entities": []}

            client = openai.OpenAI(api_key=api_key)

            # Combine all section text
            document_text = "\n\n".join(
                [
                    section.text
                    for section in sections
                    if isinstance(section, TextSection) and section.text.strip()
                ]
            )

            # Skip if no text content
            if not document_text.strip():
                logger.debug("No text content found, skipping metadata extraction")
                return {"categories": [], "entities": []}

            # Truncate very long documents to avoid token limits
            max_chars = 50000  # Roughly 12k tokens
            if len(document_text) > max_chars:
                document_text = document_text[:max_chars] + "..."
                logger.debug(f"Truncated document text to {max_chars} characters")

            response = client.responses.parse(
                model="o3",
                input=[
                    {
                        "role": "system",
                        "content": "Extract categories and entities from the document.",
                    },
                    {
                        "role": "user",
                        "content": prompt + "\n\nDOCUMENT: " + document_text,
                    },
                ],
                text_format=DocumentClassificationResult,
            )

            classification_result = response.output_parsed

            result = {
                "categories": classification_result.categories,
                "entities": classification_result.entities,
            }

            logger.debug(f"Successfully extracted metadata: {result}")
            return result

        except Exception as e:
            attempt_num = attempt + 1
            is_last_attempt = attempt == max_retries

            # Log the error
            if is_last_attempt:
                logger.error(
                    f"Failed to extract categories and entities after {max_retries + 1} attempts: {e}"
                )
            else:
                logger.warning(
                    f"Attempt {attempt_num} failed to extract metadata: {e}. Retrying..."
                )

            # If this is the last attempt, return empty results
            if is_last_attempt:
                return {"categories": [], "entities": []}

            # Calculate delay with exponential backoff and jitter
            delay = base_delay * (backoff_factor**attempt)
            jitter = random.uniform(0.1, 0.3)  # Add 10-30% jitter
            total_delay = delay + jitter

            logger.debug(
                f"Waiting {total_delay:.2f} seconds before retry {attempt_num + 1}"
            )
            time.sleep(total_delay)

    # Should never reach here, but just in case
    return {"categories": [], "entities": []}


def _create_doc_from_transcript(transcript: dict) -> Document | None:
    sections: List[TextSection] = []
    current_speaker_name = None
    current_link = ""
    current_text = ""

    if transcript["sentences"] is None:
        return None

    for sentence in transcript["sentences"]:
        if sentence["speaker_name"] != current_speaker_name:
            if current_speaker_name is not None:
                sections.append(
                    TextSection(
                        link=current_link,
                        text=current_text.strip(),
                    )
                )
            current_speaker_name = sentence.get("speaker_name") or "Unknown Speaker"
            current_link = f"{transcript['transcript_url']}?t={sentence['start_time']}"
            current_text = f"{current_speaker_name}: "

        cleaned_text = sentence["text"].replace("\xa0", " ")
        current_text += f"{cleaned_text} "

    # Sometimes these links (links with a timestamp) do not work, it is a bug with Fireflies.
    sections.append(
        TextSection(
            link=current_link,
            text=current_text.strip(),
        )
    )

    fireflies_id = _FIREFLIES_ID_PREFIX + transcript["id"]

    meeting_title = transcript["title"] or "No Title"

    meeting_date_unix = transcript["date"]
    meeting_date = datetime.fromtimestamp(meeting_date_unix / 1000, tz=timezone.utc)

    meeting_organizer_email = transcript["organizer_email"]
    organizer_email_user_info = [BasicExpertInfo(email=meeting_organizer_email)]

    meeting_participants_email_list = []
    for participant in transcript.get("participants", []):
        if participant != meeting_organizer_email and participant:
            meeting_participants_email_list.append(BasicExpertInfo(email=participant))

    # Extract categories and entities from transcript and store in metadata
    categories_and_entities = _extract_categories_and_entities(sections)
    metadata = {
        "categories": categories_and_entities.get("categories", []),
        "entities": categories_and_entities.get("entities", []),
    }

    return Document(
        id=fireflies_id,
        sections=cast(list[TextSection | ImageSection], sections),
        source=DocumentSource.FIREFLIES,
        semantic_identifier=meeting_title,
        metadata=metadata,
        doc_updated_at=meeting_date,
        primary_owners=organizer_email_user_info,
        secondary_owners=meeting_participants_email_list,
    )


# If not all transcripts are being indexed, try using a more-recently-generated
# API key.
class FirefliesConnector(PollConnector, LoadConnector):
    def __init__(self, batch_size: int = INDEX_BATCH_SIZE) -> None:
        self.batch_size = batch_size

    def load_credentials(self, credentials: dict[str, str]) -> None:
        api_key = credentials.get("fireflies_api_key")

        if not isinstance(api_key, str):
            raise ConnectorMissingCredentialError(
                "The Fireflies API key must be a string"
            )

        self.api_key = api_key

        return None

    def _fetch_transcripts(
        self, start_datetime: str | None = None, end_datetime: str | None = None
    ) -> Iterator[List[dict]]:
        if self.api_key is None:
            raise ConnectorMissingCredentialError("Missing API key")

        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + self.api_key,
        }

        skip = 0
        variables: dict[str, int | str] = {
            "limit": _FIREFLIES_TRANSCRIPT_QUERY_SIZE,
        }

        if start_datetime:
            variables["fromDate"] = start_datetime
        if end_datetime:
            variables["toDate"] = end_datetime

        while True:
            variables["skip"] = skip
            response = requests.post(
                _FIREFLIES_API_URL,
                headers=headers,
                json={"query": _FIREFLIES_API_QUERY, "variables": variables},
            )

            response.raise_for_status()

            if response.status_code == 204:
                break

            recieved_transcripts = response.json()
            parsed_transcripts = recieved_transcripts.get("data", {}).get(
                "transcripts", []
            )

            yield parsed_transcripts

            if len(parsed_transcripts) < _FIREFLIES_TRANSCRIPT_QUERY_SIZE:
                break

            skip += _FIREFLIES_TRANSCRIPT_QUERY_SIZE

    def _process_transcripts(
        self, start: str | None = None, end: str | None = None
    ) -> GenerateDocumentsOutput:
        doc_batch: List[Document] = []

        for transcript_batch in self._fetch_transcripts(start, end):
            for transcript in transcript_batch:
                if doc := _create_doc_from_transcript(transcript):
                    doc_batch.append(doc)

                if len(doc_batch) >= self.batch_size:
                    yield doc_batch
                    doc_batch = []

        if doc_batch:
            yield doc_batch

    def load_from_state(self) -> GenerateDocumentsOutput:
        return self._process_transcripts()

    def poll_source(
        self, start: SecondsSinceUnixEpoch, end: SecondsSinceUnixEpoch
    ) -> GenerateDocumentsOutput:
        # add some leeway to account for any timezone funkiness and/or bad handling
        # of start time on the Fireflies side
        start = max(0, start - ONE_MINUTE)
        start_datetime = datetime.fromtimestamp(start, tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%S.000Z"
        )
        end_datetime = datetime.fromtimestamp(end, tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%S.000Z"
        )

        yield from self._process_transcripts(start_datetime, end_datetime)
