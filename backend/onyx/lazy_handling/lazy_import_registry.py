from typing import TYPE_CHECKING

from onyx.lazy_handling.lazy_module import LazyModule

if TYPE_CHECKING:
    import vertexai  # type: ignore[import-untyped]

lazy_vertexai: "vertexai" = LazyModule("vertexai")  # noqa: F821
