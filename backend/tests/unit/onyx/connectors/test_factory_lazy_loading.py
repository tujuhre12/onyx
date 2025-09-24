"""
Unit tests for lazy loading connector factory to validate:
1. All connector mappings are correct
2. Module paths and class names are valid
3. Error handling works properly
4. Caching functions correctly
"""

import importlib
from unittest.mock import MagicMock
from unittest.mock import patch

import pytest

from onyx.configs.constants import DocumentSource
from onyx.connectors.factory import _connector_cache
from onyx.connectors.factory import _load_connector_class
from onyx.connectors.factory import CONNECTOR_CLASS_MAP
from onyx.connectors.factory import ConnectorMissingException
from onyx.connectors.factory import identify_connector_class
from onyx.connectors.factory import instantiate_connector
from onyx.connectors.interfaces import BaseConnector
from onyx.connectors.models import InputType


class TestConnectorMappingValidation:
    """Test that all connector mappings are valid."""

    def test_all_connector_mappings_exist(self):
        """Test that all mapped modules and classes actually exist."""
        errors = []

        for source, (module_path, class_name) in CONNECTOR_CLASS_MAP.items():
            try:
                # Try to import the module
                module = importlib.import_module(module_path)

                # Try to get the class
                connector_class = getattr(module, class_name)

                # Verify it's a subclass of BaseConnector
                if not issubclass(connector_class, BaseConnector):
                    errors.append(
                        f"{source.value}: {class_name} is not a BaseConnector subclass"
                    )

            except ImportError as e:
                errors.append(f"{source.value}: Failed to import {module_path} - {e}")
            except AttributeError as e:
                errors.append(
                    f"{source.value}: Class {class_name} not found in {module_path} - {e}"
                )

        if errors:
            pytest.fail("Connector mapping validation failed:\n" + "\n".join(errors))

    def test_no_duplicate_mappings(self):
        """Test that each DocumentSource only appears once in the mapping."""
        sources = list(CONNECTOR_CLASS_MAP.keys())
        unique_sources = set(sources)

        assert len(sources) == len(
            unique_sources
        ), "Duplicate DocumentSource entries found"

    def test_blob_storage_connectors_correct(self):
        """Test that all blob storage sources map to the same connector."""
        blob_sources = [
            DocumentSource.S3,
            DocumentSource.R2,
            DocumentSource.GOOGLE_CLOUD_STORAGE,
            DocumentSource.OCI_STORAGE,
        ]

        expected_mapping = ("onyx.connectors.blob.connector", "BlobStorageConnector")

        for source in blob_sources:
            assert (
                CONNECTOR_CLASS_MAP[source] == expected_mapping
            ), f"{source.value} should map to BlobStorageConnector"


class TestConnectorClassLoading:
    """Test the lazy loading mechanism."""

    def setup_method(self):
        """Clear cache before each test."""
        _connector_cache.clear()

    def test_load_connector_class_success(self):
        """Test successful connector class loading."""
        # Use a simple connector that should always exist
        connector_class = _load_connector_class(DocumentSource.WEB)

        assert connector_class is not None
        assert issubclass(connector_class, BaseConnector)
        assert connector_class.__name__ == "WebConnector"

    def test_load_connector_class_caching(self):
        """Test that connector classes are cached after first load."""
        assert len(_connector_cache) == 0

        # Load connector first time
        connector_class1 = _load_connector_class(DocumentSource.WEB)
        assert len(_connector_cache) == 1
        assert DocumentSource.WEB in _connector_cache

        # Load same connector second time - should use cache
        connector_class2 = _load_connector_class(DocumentSource.WEB)
        assert connector_class1 is connector_class2  # Same object reference
        assert len(_connector_cache) == 1  # Cache size unchanged

    def test_load_connector_class_invalid_source(self):
        """Test loading connector for non-existent source."""

        class FakeSource:
            value = "FAKE_SOURCE"

        with pytest.raises(ConnectorMissingException) as exc_info:
            _load_connector_class(FakeSource())

        assert "Connector not found for source" in str(exc_info.value)

    @patch("importlib.import_module")
    def test_load_connector_class_import_error(self, mock_import):
        """Test handling of import errors."""
        mock_import.side_effect = ImportError("Module not found")

        with pytest.raises(ConnectorMissingException) as exc_info:
            _load_connector_class(DocumentSource.WEB)

        assert (
            "Failed to import WebConnector from onyx.connectors.web.connector"
            in str(exc_info.value)
        )

    @patch("importlib.import_module")
    def test_load_connector_class_attribute_error(self, mock_import):
        """Test handling of missing class in module."""
        mock_module = MagicMock()
        mock_import.return_value = mock_module

        # Simulate missing class attribute
        del mock_module.WebConnector
        mock_module.__getattr__ = MagicMock(
            side_effect=AttributeError("Class not found")
        )

        with pytest.raises(ConnectorMissingException) as exc_info:
            _load_connector_class(DocumentSource.WEB)

        assert (
            "Failed to import WebConnector from onyx.connectors.web.connector"
            in str(exc_info.value)
        )


class TestIdentifyConnectorClass:
    """Test the identify_connector_class function."""

    def setup_method(self):
        """Clear cache before each test."""
        _connector_cache.clear()

    def test_identify_connector_basic(self):
        """Test basic connector identification."""
        connector_class = identify_connector_class(
            DocumentSource.GITHUB, InputType.SLIM_RETRIEVAL
        )

        assert connector_class is not None
        assert issubclass(connector_class, BaseConnector)
        assert connector_class.__name__ == "GithubConnector"

    def test_identify_connector_slack_special_case(self):
        """Test Slack connector special handling."""
        # Test POLL input type
        slack_poll = identify_connector_class(DocumentSource.SLACK, InputType.POLL)
        assert slack_poll.__name__ == "SlackConnector"

        # Test SLIM_RETRIEVAL input type
        slack_slim = identify_connector_class(
            DocumentSource.SLACK, InputType.SLIM_RETRIEVAL
        )
        assert slack_slim.__name__ == "SlackConnector"

        # Should be the same class
        assert slack_poll is slack_slim

    def test_identify_connector_without_input_type(self):
        """Test connector identification without specifying input type."""
        connector_class = identify_connector_class(DocumentSource.GITHUB)

        assert connector_class is not None
        assert connector_class.__name__ == "GithubConnector"


class TestConnectorMappingIntegrity:
    """Test integrity of the connector mapping data."""

    def test_all_document_sources_mapped(self):
        """Test that all DocumentSource values have mappings (where expected)."""
        # Get all DocumentSource enum values
        all_sources = set(DocumentSource)
        mapped_sources = set(CONNECTOR_CLASS_MAP.keys())

        # Some sources might legitimately not have connectors (like INGESTION_API)
        expected_unmapped = {
            DocumentSource.INGESTION_API,  # This is handled differently
            # Add other legitimately unmapped sources here if they exist
        }

        unmapped_sources = all_sources - mapped_sources - expected_unmapped

        if unmapped_sources:
            pytest.fail(
                f"DocumentSource values without connector mappings: "
                f"{[s.value for s in unmapped_sources]}"
            )

    def test_mapping_format_consistency(self):
        """Test that all mappings follow the expected format."""
        for source, mapping in CONNECTOR_CLASS_MAP.items():
            assert isinstance(mapping, tuple), f"{source.value} mapping is not a tuple"
            assert (
                len(mapping) == 2
            ), f"{source.value} mapping doesn't have exactly 2 elements"

            module_path, class_name = mapping
            assert isinstance(
                module_path, str
            ), f"{source.value} module_path is not a string"
            assert isinstance(
                class_name, str
            ), f"{source.value} class_name is not a string"
            assert module_path.startswith(
                "onyx.connectors."
            ), f"{source.value} module_path doesn't start with onyx.connectors."
            assert class_name.endswith(
                "Connector"
            ), f"{source.value} class_name doesn't end with Connector"


class TestInstantiateConnectorIntegration:
    """Test that the lazy loading works with the main instantiate_connector function."""

    def setup_method(self):
        """Clear cache before each test."""
        _connector_cache.clear()

    def test_instantiate_connector_loads_class_lazily(self):
        """Test that instantiate_connector triggers lazy loading."""
        # Mock the database session and credential
        mock_session = MagicMock()
        mock_credential = MagicMock()
        mock_credential.id = 123
        mock_credential.credential_json = {"test": "data"}

        # This should trigger lazy loading but will fail on actual instantiation
        # due to missing real configuration - that's expected
        with pytest.raises(Exception):  # We expect some kind of error due to mock data
            instantiate_connector(
                mock_session,
                DocumentSource.WEB,  # Simple connector
                InputType.SLIM_RETRIEVAL,
                {},  # Empty config
                mock_credential,
            )

        # But the class should have been loaded into cache
        assert DocumentSource.WEB in _connector_cache
        assert _connector_cache[DocumentSource.WEB].__name__ == "WebConnector"


class TestFactoryValidationScript:
    """Test that provides a validation script for CI/CD."""

    def test_validate_all_mappings_cli(self):
        """Comprehensive validation that can be run in CI."""
        print("\n=== CONNECTOR FACTORY VALIDATION ===")

        total_connectors = len(CONNECTOR_CLASS_MAP)
        successful_loads = 0
        errors = []

        for source, (module_path, class_name) in CONNECTOR_CLASS_MAP.items():
            try:
                _load_connector_class(source)
                print(f"✓ {source.value}: {class_name}")
                successful_loads += 1
            except Exception as e:
                error_msg = f"✗ {source.value}: {e}"
                print(error_msg)
                errors.append(error_msg)

        print("\n=== SUMMARY ===")
        print(f"Total connectors: {total_connectors}")
        print(f"Successfully loaded: {successful_loads}")
        print(f"Failed to load: {len(errors)}")

        if errors:
            print("\n=== ERRORS ===")
            for error in errors:
                print(error)
            pytest.fail(f"Connector validation failed: {len(errors)} errors")

        print("✅ All connector mappings are valid!")


if __name__ == "__main__":
    # Allow running this file directly for validation
    import sys

    sys.path.insert(0, "/Users/edwinluo/onyx/backend")

    # Run the validation
    test = TestFactoryValidationScript()
    test.test_validate_all_mappings_cli()
