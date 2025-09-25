import importlib
from typing import Any
from typing import Type

from pydantic import BaseModel
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


class ConnectorMapping(BaseModel):
    module_path: str
    class_name: str


# Mapping of DocumentSource to connector details for lazy loading
CONNECTOR_CLASS_MAP = {
    DocumentSource.WEB: ConnectorMapping(
        module_path="onyx.connectors.web.connector",
        class_name="WebConnector",
    ),
    DocumentSource.FILE: ConnectorMapping(
        module_path="onyx.connectors.file.connector",
        class_name="LocalFileConnector",
    ),
    DocumentSource.SLACK: ConnectorMapping(
        module_path="onyx.connectors.slack.connector",
        class_name="SlackConnector",
    ),
    DocumentSource.GITHUB: ConnectorMapping(
        module_path="onyx.connectors.github.connector",
        class_name="GithubConnector",
    ),
    DocumentSource.GMAIL: ConnectorMapping(
        module_path="onyx.connectors.gmail.connector",
        class_name="GmailConnector",
    ),
    DocumentSource.GITLAB: ConnectorMapping(
        module_path="onyx.connectors.gitlab.connector",
        class_name="GitlabConnector",
    ),
    DocumentSource.GITBOOK: ConnectorMapping(
        module_path="onyx.connectors.gitbook.connector",
        class_name="GitbookConnector",
    ),
    DocumentSource.GOOGLE_DRIVE: ConnectorMapping(
        module_path="onyx.connectors.google_drive.connector",
        class_name="GoogleDriveConnector",
    ),
    DocumentSource.BOOKSTACK: ConnectorMapping(
        module_path="onyx.connectors.bookstack.connector",
        class_name="BookstackConnector",
    ),
    DocumentSource.OUTLINE: ConnectorMapping(
        module_path="onyx.connectors.outline.connector",
        class_name="OutlineConnector",
    ),
    DocumentSource.CONFLUENCE: ConnectorMapping(
        module_path="onyx.connectors.confluence.connector",
        class_name="ConfluenceConnector",
    ),
    DocumentSource.JIRA: ConnectorMapping(
        module_path="onyx.connectors.jira.connector",
        class_name="JiraConnector",
    ),
    DocumentSource.PRODUCTBOARD: ConnectorMapping(
        module_path="onyx.connectors.productboard.connector",
        class_name="ProductboardConnector",
    ),
    DocumentSource.SLAB: ConnectorMapping(
        module_path="onyx.connectors.slab.connector",
        class_name="SlabConnector",
    ),
    DocumentSource.NOTION: ConnectorMapping(
        module_path="onyx.connectors.notion.connector",
        class_name="NotionConnector",
    ),
    DocumentSource.ZULIP: ConnectorMapping(
        module_path="onyx.connectors.zulip.connector",
        class_name="ZulipConnector",
    ),
    DocumentSource.GURU: ConnectorMapping(
        module_path="onyx.connectors.guru.connector",
        class_name="GuruConnector",
    ),
    DocumentSource.LINEAR: ConnectorMapping(
        module_path="onyx.connectors.linear.connector",
        class_name="LinearConnector",
    ),
    DocumentSource.HUBSPOT: ConnectorMapping(
        module_path="onyx.connectors.hubspot.connector",
        class_name="HubSpotConnector",
    ),
    DocumentSource.DOCUMENT360: ConnectorMapping(
        module_path="onyx.connectors.document360.connector",
        class_name="Document360Connector",
    ),
    DocumentSource.GONG: ConnectorMapping(
        module_path="onyx.connectors.gong.connector",
        class_name="GongConnector",
    ),
    DocumentSource.GOOGLE_SITES: ConnectorMapping(
        module_path="onyx.connectors.google_site.connector",
        class_name="GoogleSitesConnector",
    ),
    DocumentSource.ZENDESK: ConnectorMapping(
        module_path="onyx.connectors.zendesk.connector",
        class_name="ZendeskConnector",
    ),
    DocumentSource.LOOPIO: ConnectorMapping(
        module_path="onyx.connectors.loopio.connector",
        class_name="LoopioConnector",
    ),
    DocumentSource.DROPBOX: ConnectorMapping(
        module_path="onyx.connectors.dropbox.connector",
        class_name="DropboxConnector",
    ),
    DocumentSource.SHAREPOINT: ConnectorMapping(
        module_path="onyx.connectors.sharepoint.connector",
        class_name="SharepointConnector",
    ),
    DocumentSource.TEAMS: ConnectorMapping(
        module_path="onyx.connectors.teams.connector",
        class_name="TeamsConnector",
    ),
    DocumentSource.SALESFORCE: ConnectorMapping(
        module_path="onyx.connectors.salesforce.connector",
        class_name="SalesforceConnector",
    ),
    DocumentSource.DISCOURSE: ConnectorMapping(
        module_path="onyx.connectors.discourse.connector",
        class_name="DiscourseConnector",
    ),
    DocumentSource.AXERO: ConnectorMapping(
        module_path="onyx.connectors.axero.connector",
        class_name="AxeroConnector",
    ),
    DocumentSource.CLICKUP: ConnectorMapping(
        module_path="onyx.connectors.clickup.connector",
        class_name="ClickupConnector",
    ),
    DocumentSource.MEDIAWIKI: ConnectorMapping(
        module_path="onyx.connectors.mediawiki.wiki",
        class_name="MediaWikiConnector",
    ),
    DocumentSource.WIKIPEDIA: ConnectorMapping(
        module_path="onyx.connectors.wikipedia.connector",
        class_name="WikipediaConnector",
    ),
    DocumentSource.ASANA: ConnectorMapping(
        module_path="onyx.connectors.asana.connector",
        class_name="AsanaConnector",
    ),
    DocumentSource.S3: ConnectorMapping(
        module_path="onyx.connectors.blob.connector",
        class_name="BlobStorageConnector",
    ),
    DocumentSource.R2: ConnectorMapping(
        module_path="onyx.connectors.blob.connector",
        class_name="BlobStorageConnector",
    ),
    DocumentSource.GOOGLE_CLOUD_STORAGE: ConnectorMapping(
        module_path="onyx.connectors.blob.connector",
        class_name="BlobStorageConnector",
    ),
    DocumentSource.OCI_STORAGE: ConnectorMapping(
        module_path="onyx.connectors.blob.connector",
        class_name="BlobStorageConnector",
    ),
    DocumentSource.XENFORO: ConnectorMapping(
        module_path="onyx.connectors.xenforo.connector",
        class_name="XenforoConnector",
    ),
    DocumentSource.DISCORD: ConnectorMapping(
        module_path="onyx.connectors.discord.connector",
        class_name="DiscordConnector",
    ),
    DocumentSource.FRESHDESK: ConnectorMapping(
        module_path="onyx.connectors.freshdesk.connector",
        class_name="FreshdeskConnector",
    ),
    DocumentSource.FIREFLIES: ConnectorMapping(
        module_path="onyx.connectors.fireflies.connector",
        class_name="FirefliesConnector",
    ),
    DocumentSource.EGNYTE: ConnectorMapping(
        module_path="onyx.connectors.egnyte.connector",
        class_name="EgnyteConnector",
    ),
    DocumentSource.AIRTABLE: ConnectorMapping(
        module_path="onyx.connectors.airtable.airtable_connector",
        class_name="AirtableConnector",
    ),
    DocumentSource.HIGHSPOT: ConnectorMapping(
        module_path="onyx.connectors.highspot.connector",
        class_name="HighspotConnector",
    ),
    DocumentSource.IMAP: ConnectorMapping(
        module_path="onyx.connectors.imap.connector",
        class_name="ImapConnector",
    ),
    DocumentSource.BITBUCKET: ConnectorMapping(
        module_path="onyx.connectors.bitbucket.connector",
        class_name="BitbucketConnector",
    ),
    # just for integration tests
    DocumentSource.MOCK_CONNECTOR: ConnectorMapping(
        module_path="onyx.connectors.mock_connector.connector",
        class_name="MockConnector",
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

    mapping = CONNECTOR_CLASS_MAP[source]

    try:
        module = importlib.import_module(mapping.module_path)
        connector_class = getattr(module, mapping.class_name)
        _connector_cache[source] = connector_class
        return connector_class
    except (ImportError, AttributeError) as e:
        raise ConnectorMissingException(
            f"Failed to import {mapping.class_name} from {mapping.module_path}: {e}"
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
