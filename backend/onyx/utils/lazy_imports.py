"""Lazy import utilities for optional dependencies that should only be loaded when needed."""

import importlib
from typing import Any
from typing import Optional
from typing import Type


class LazyImport:
    """
    A lazy import wrapper that defers importing until first access.

    This helps reduce memory usage by avoiding eager imports of heavy libraries
    that may not be used in all execution paths.

    Example:
        # Instead of:
        import vertexai

        # Use:
        vertexai = LazyImport("vertexai")

        # The import only happens when first accessed:
        vertexai.init(project=project_id, credentials=credentials)
    """

    def __init__(self, module_name: str, attribute: Optional[str] = None):
        self._module_name = module_name
        self._attribute = attribute
        self._cached_module = None

    def _import_module(self) -> Any:
        """Import the module and cache it."""
        if self._cached_module is None:
            try:
                module = importlib.import_module(self._module_name)
                if self._attribute:
                    self._cached_module = getattr(module, self._attribute)
                else:
                    self._cached_module = module
            except ImportError as e:
                raise ImportError(
                    f"Failed to import {self._module_name}"
                    + (f".{self._attribute}" if self._attribute else "")
                    + ". This is likely because the required Vertex AI libraries are not installed. "
                    "Install them with: pip install google-cloud-aiplatform"
                ) from e
        return self._cached_module

    def __getattr__(self, name: str) -> Any:
        """Get attribute from the imported module."""
        module = self._import_module()
        return getattr(module, name)

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        """Allow calling the imported object directly."""
        module = self._import_module()
        return module(*args, **kwargs)


class LazyClass(LazyImport):
    """Lazy import wrapper specifically for classes."""

    def __init__(self, module_name: str, class_name: str):
        super().__init__(module_name, class_name)
        self._class_name = class_name

    def __instancecheck__(self, instance: Any) -> bool:
        """Support isinstance() checks."""
        try:
            cls = self._import_module()
            return isinstance(instance, cls)
        except ImportError:
            return False

    def __subclasscheck__(self, subclass: Type) -> bool:
        """Support issubclass() checks."""
        try:
            cls = self._import_module()
            return issubclass(subclass, cls)
        except ImportError:
            return False


def lazy_import(module_name: str, attribute: Optional[str] = None) -> LazyImport:
    """
    Create a lazy import for a module or module attribute.

    Args:
        module_name: The module to import (e.g., "vertexai")
        attribute: Optional attribute to extract from the module (e.g., "TextEmbeddingModel")

    Returns:
        LazyImport object that will import on first access
    """
    return LazyImport(module_name, attribute)


def lazy_class(module_name: str, class_name: str) -> LazyClass:
    """
    Create a lazy import for a class that supports isinstance/issubclass checks.

    Args:
        module_name: The module containing the class
        class_name: The name of the class

    Returns:
        LazyClass object that will import on first access
    """
    return LazyClass(module_name, class_name)


# Vertex AI lazy imports (google-cloud-aiplatform package)
# These are the heavy imports that need lazy loading for memory optimization
vertexai = lazy_import("vertexai")
vertexai_language_models = lazy_import("vertexai.language_models")

# Google OAuth2 service account (only used with Vertex AI)
google_oauth2_service_account = lazy_import("google.oauth2.service_account")
