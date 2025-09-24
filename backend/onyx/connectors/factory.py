import importlib
from typing import Any
from typing import Type

from sqlalchemy.orm import Session

from onyx.configs.app_configs import INTEGRATION_TESTS_MODE
from onyx.configs.constants import DocumentSource
from onyx.configs.llm_configs import get_image_extraction_and_analysis_enabled
from onyx.connectors.credentials_provider import OnyxDBCredentialsProvider
from onyx.connectors.exceptions import ConnectorValidationError
from onyx.connectors.interfaces import BaseConnector
from onyx.connectors.interfaces import CheckpointedConnector
from onyx.connectors.interfaces import CredentialsConnector
from onyx.connectors.interfaces import EventConnector
from onyx.connectors.interfaces import LoadConnector
from onyx.connectors.interfaces import PollConnector
from onyx.connectors.models import InputType
from onyx.db.connector import fetch_connector_by_id
from onyx.db.credentials import backend_update_credential_json
from onyx.db.credentials import fetch_credential_by_id
from onyx.db.enums import AccessType
from onyx.db.models import Credential
from shared_configs.contextvars import get_current_tenant_id


class ConnectorMissingException(Exception):
    pass


# Mapping of DocumentSource to (module_path, class_name) for lazy loading
CONNECTOR_CLASS_MAP = {
    DocumentSource.WEB: ("onyx.connectors.web.connector", "WebConnector"),
    DocumentSource.FILE: ("onyx.connectors.file.connector", "LocalFileConnector"),
    DocumentSource.SLACK: ("onyx.connectors.slack.connector", "SlackConnector"),
    DocumentSource.GITHUB: ("onyx.connectors.github.connector", "GithubConnector"),
    DocumentSource.GMAIL: ("onyx.connectors.gmail.connector", "GmailConnector"),
    DocumentSource.GITLAB: ("onyx.connectors.gitlab.connector", "GitlabConnector"),
    DocumentSource.GITBOOK: ("onyx.connectors.gitbook.connector", "GitbookConnector"),
    DocumentSource.GOOGLE_DRIVE: (
        "onyx.connectors.google_drive.connector",
        "GoogleDriveConnector",
    ),
    DocumentSource.BOOKSTACK: (
        "onyx.connectors.bookstack.connector",
        "BookstackConnector",
    ),
    DocumentSource.OUTLINE: ("onyx.connectors.outline.connector", "OutlineConnector"),
    DocumentSource.CONFLUENCE: (
        "onyx.connectors.confluence.connector",
        "ConfluenceConnector",
    ),
    DocumentSource.JIRA: ("onyx.connectors.jira.connector", "JiraConnector"),
    DocumentSource.PRODUCTBOARD: (
        "onyx.connectors.productboard.connector",
        "ProductboardConnector",
    ),
    DocumentSource.SLAB: ("onyx.connectors.slab.connector", "SlabConnector"),
    DocumentSource.NOTION: ("onyx.connectors.notion.connector", "NotionConnector"),
    DocumentSource.ZULIP: ("onyx.connectors.zulip.connector", "ZulipConnector"),
    DocumentSource.GURU: ("onyx.connectors.guru.connector", "GuruConnector"),
    DocumentSource.LINEAR: ("onyx.connectors.linear.connector", "LinearConnector"),
    DocumentSource.HUBSPOT: ("onyx.connectors.hubspot.connector", "HubSpotConnector"),
    DocumentSource.DOCUMENT360: (
        "onyx.connectors.document360.connector",
        "Document360Connector",
    ),
    DocumentSource.GONG: ("onyx.connectors.gong.connector", "GongConnector"),
    DocumentSource.GOOGLE_SITES: (
        "onyx.connectors.google_site.connector",
        "GoogleSitesConnector",
    ),
    DocumentSource.ZENDESK: ("onyx.connectors.zendesk.connector", "ZendeskConnector"),
    DocumentSource.LOOPIO: ("onyx.connectors.loopio.connector", "LoopioConnector"),
    DocumentSource.DROPBOX: ("onyx.connectors.dropbox.connector", "DropboxConnector"),
    DocumentSource.SHAREPOINT: (
        "onyx.connectors.sharepoint.connector",
        "SharepointConnector",
    ),
    DocumentSource.TEAMS: ("onyx.connectors.teams.connector", "TeamsConnector"),
    DocumentSource.SALESFORCE: (
        "onyx.connectors.salesforce.connector",
        "SalesforceConnector",
    ),
    DocumentSource.DISCOURSE: (
        "onyx.connectors.discourse.connector",
        "DiscourseConnector",
    ),
    DocumentSource.AXERO: ("onyx.connectors.axero.connector", "AxeroConnector"),
    DocumentSource.CLICKUP: ("onyx.connectors.clickup.connector", "ClickupConnector"),
    DocumentSource.MEDIAWIKI: ("onyx.connectors.mediawiki.wiki", "MediaWikiConnector"),
    DocumentSource.WIKIPEDIA: (
        "onyx.connectors.wikipedia.connector",
        "WikipediaConnector",
    ),
    DocumentSource.ASANA: ("onyx.connectors.asana.connector", "AsanaConnector"),
    DocumentSource.S3: ("onyx.connectors.blob.connector", "BlobStorageConnector"),
    DocumentSource.R2: ("onyx.connectors.blob.connector", "BlobStorageConnector"),
    DocumentSource.GOOGLE_CLOUD_STORAGE: (
        "onyx.connectors.blob.connector",
        "BlobStorageConnector",
    ),
    DocumentSource.OCI_STORAGE: (
        "onyx.connectors.blob.connector",
        "BlobStorageConnector",
    ),
    DocumentSource.XENFORO: ("onyx.connectors.xenforo.connector", "XenforoConnector"),
    DocumentSource.DISCORD: ("onyx.connectors.discord.connector", "DiscordConnector"),
    DocumentSource.FRESHDESK: (
        "onyx.connectors.freshdesk.connector",
        "FreshdeskConnector",
    ),
    DocumentSource.FIREFLIES: (
        "onyx.connectors.fireflies.connector",
        "FirefliesConnector",
    ),
    DocumentSource.EGNYTE: ("onyx.connectors.egnyte.connector", "EgnyteConnector"),
    DocumentSource.AIRTABLE: (
        "onyx.connectors.airtable.airtable_connector",
        "AirtableConnector",
    ),
    DocumentSource.HIGHSPOT: (
        "onyx.connectors.highspot.connector",
        "HighspotConnector",
    ),
    DocumentSource.IMAP: ("onyx.connectors.imap.connector", "ImapConnector"),
    DocumentSource.BITBUCKET: (
        "onyx.connectors.bitbucket.connector",
        "BitbucketConnector",
    ),
    # just for integration tests
    DocumentSource.MOCK_CONNECTOR: (
        "onyx.connectors.mock_connector.connector",
        "MockConnector",
    ),
}

# Cache for already imported connector classes
_connector_cache: dict[DocumentSource, Type[BaseConnector]] = {}


def _load_connector_class(source: DocumentSource) -> Type[BaseConnector]:
    """Dynamically load and cache a connector class."""
    if source in _connector_cache:
        return _connector_cache[source]

    if source not in CONNECTOR_CLASS_MAP:
        raise ConnectorMissingException(f"Connector not found for source={source}")

    module_path, class_name = CONNECTOR_CLASS_MAP[source]

    try:
        module = importlib.import_module(module_path)
        connector_class = getattr(module, class_name)
        _connector_cache[source] = connector_class
        return connector_class
    except (ImportError, AttributeError) as e:
        raise ConnectorMissingException(
            f"Failed to import {class_name} from {module_path}: {e}"
        )


def identify_connector_class(
    source: DocumentSource,
    input_type: InputType | None = None,
) -> Type[BaseConnector]:
    # Handle special cases where input_type matters (like Slack)
    if source == DocumentSource.SLACK:
        # Slack supports both POLL and SLIM_RETRIEVAL with the same connector
        if input_type in [InputType.POLL, InputType.SLIM_RETRIEVAL]:
            connector = _load_connector_class(source)
        elif input_type is None:
            # Default to most exhaustive update
            connector = _load_connector_class(source)  # Will work for LOAD_STATE too
        else:
            connector = _load_connector_class(source)
    else:
        # Standard case - single connector per source
        connector = _load_connector_class(source)

    # Validate connector supports the requested input_type
    if any(
        [
            (
                input_type == InputType.LOAD_STATE
                and not issubclass(connector, LoadConnector)
            ),
            (
                input_type == InputType.POLL
                # either poll or checkpoint works for this, in the future
                # all connectors should be checkpoint connectors
                and (
                    not issubclass(connector, PollConnector)
                    and not issubclass(connector, CheckpointedConnector)
                )
            ),
            (
                input_type == InputType.EVENT
                and not issubclass(connector, EventConnector)
            ),
        ]
    ):
        raise ConnectorMissingException(
            f"Connector for source={source} does not accept input_type={input_type}"
        )
    return connector


def instantiate_connector(
    db_session: Session,
    source: DocumentSource,
    input_type: InputType,
    connector_specific_config: dict[str, Any],
    credential: Credential,
) -> BaseConnector:
    connector_class = identify_connector_class(source, input_type)

    connector = connector_class(**connector_specific_config)

    if isinstance(connector, CredentialsConnector):
        provider = OnyxDBCredentialsProvider(
            get_current_tenant_id(), str(source), credential.id
        )
        connector.set_credentials_provider(provider)
    else:
        new_credentials = connector.load_credentials(credential.credential_json)

        if new_credentials is not None:
            backend_update_credential_json(credential, new_credentials, db_session)

    connector.set_allow_images(get_image_extraction_and_analysis_enabled())

    return connector


def validate_ccpair_for_user(
    connector_id: int,
    credential_id: int,
    access_type: AccessType,
    db_session: Session,
    enforce_creation: bool = True,
) -> bool:
    if INTEGRATION_TESTS_MODE:
        return True

    # Validate the connector settings
    connector = fetch_connector_by_id(connector_id, db_session)
    credential = fetch_credential_by_id(
        credential_id,
        db_session,
    )

    if not connector:
        raise ValueError("Connector not found")

    if (
        connector.source == DocumentSource.INGESTION_API
        or connector.source == DocumentSource.MOCK_CONNECTOR
    ):
        return True

    if not credential:
        raise ValueError("Credential not found")

    try:
        runnable_connector = instantiate_connector(
            db_session=db_session,
            source=connector.source,
            input_type=connector.input_type,
            connector_specific_config=connector.connector_specific_config,
            credential=credential,
        )
    except ConnectorValidationError as e:
        raise e
    except Exception as e:
        if enforce_creation:
            raise ConnectorValidationError(str(e))
        else:
            return False

    runnable_connector.validate_connector_settings()
    if access_type == AccessType.SYNC:
        runnable_connector.validate_perm_sync()
    return True
