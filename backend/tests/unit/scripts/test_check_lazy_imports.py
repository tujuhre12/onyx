"""
Tests for the check_lazy_imports.py script.

Tests cover registry parsing, violation detection, TYPE_CHECKING handling,
and edge cases for the lazy import enforcement system.
"""

import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

# Import the functions we want to test

sys.path.append(str(Path(__file__).parent.parent.parent.parent / "scripts"))

from backend.scripts.check_lazy_imports import (
    get_lazy_modules,
    find_direct_imports,
    main,
)


def test_get_lazy_modules_valid_registry():
    """Test parsing a valid registry file."""
    registry_content = """
from typing import TYPE_CHECKING

from onyx.lazy_handling.lazy_module import LazyModule

if TYPE_CHECKING:
    import vertexai

lazy_vertexai: "vertexai" = LazyModule("vertexai")
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(registry_content)
        registry_path = Path(f.name)

    try:
        result = get_lazy_modules(registry_path)
        expected = {"lazy_vertexai": "vertexai", "lazy_transformers": "transformers"}
        assert result == expected
    finally:
        registry_path.unlink()


def test_get_lazy_modules_empty_registry():
    """Test parsing an empty registry file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write("# Empty registry file\n")
        registry_path = Path(f.name)

    try:
        result = get_lazy_modules(registry_path)
        assert result == {}
    finally:
        registry_path.unlink()


def test_get_lazy_modules_nonexistent_file():
    """Test handling of nonexistent registry file."""
    nonexistent_path = Path("/nonexistent/path/registry.py")
    result = get_lazy_modules(nonexistent_path)
    assert result == {}


def test_find_direct_imports_basic_violations():
    """Test detection of basic import violations."""
    test_content = """
import vertexai
from vertexai import generative_models
import transformers
from transformers import AutoTokenizer
import os  # This should not be flagged
from typing import Dict
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(test_content)
        test_path = Path(f.name)

    try:
        protected_modules = {"vertexai", "transformers"}
        violations = find_direct_imports(test_path, protected_modules)

        # Should find 4 violations (lines 2, 3, 4, 5)
        assert len(violations) == 4

        # Check specific violations
        violation_lines = [line_num for line_num, _ in violations]
        assert 2 in violation_lines  # import vertexai
        assert 3 in violation_lines  # from vertexai import generative_models
        assert 4 in violation_lines  # import transformers
        assert 5 in violation_lines  # from transformers import AutoTokenizer

        # Lines 6 and 7 should not be flagged
        assert 6 not in violation_lines  # import os
        assert 7 not in violation_lines  # from typing import Dict

    finally:
        test_path.unlink()


def test_find_direct_imports_type_checking_allowed():
    """Test that imports in TYPE_CHECKING blocks are allowed."""
    test_content = """from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import vertexai
    from transformers import AutoTokenizer

# Regular imports should be flagged
import vertexai
from transformers import BertModel
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(test_content)
        test_path = Path(f.name)

    try:
        protected_modules = {"vertexai", "transformers"}
        violations = find_direct_imports(test_path, protected_modules)

        # Should only find violations outside TYPE_CHECKING block (lines 8, 9)
        assert len(violations) == 2

        violation_lines = [line_num for line_num, _ in violations]
        assert 8 in violation_lines  # import vertexai (outside TYPE_CHECKING)
        assert (
            9 in violation_lines
        )  # from transformers import BertModel (outside TYPE_CHECKING)

        # Lines 4 and 5 should not be flagged (inside TYPE_CHECKING)
        assert 4 not in violation_lines
        assert 5 not in violation_lines

    finally:
        test_path.unlink()


def test_find_direct_imports_complex_patterns():
    """Test detection of various import patterns."""
    test_content = """
import vertexai.generative_models  # Should be flagged
from some_package import vertexai  # Should be flagged
import vertexai_utils  # Should not be flagged (different module)
from vertexai_wrapper import something  # Should not be flagged
import myvertexai  # Should not be flagged
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(test_content)
        test_path = Path(f.name)

    try:
        protected_modules = {"vertexai"}
        violations = find_direct_imports(test_path, protected_modules)

        # Should find 2 violations (lines 2, 3)
        assert len(violations) == 2

        violation_lines = [line_num for line_num, _ in violations]
        assert 2 in violation_lines  # import vertexai.generative_models
        assert 3 in violation_lines  # from some_package import vertexai

        # Lines 4, 5, 6 should not be flagged
        assert 4 not in violation_lines
        assert 5 not in violation_lines
        assert 6 not in violation_lines

    finally:
        test_path.unlink()


def test_find_direct_imports_comments_ignored():
    """Test that commented imports are ignored."""
    test_content = """
# import vertexai  # This should be ignored
import os
# from vertexai import something  # This should be ignored
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(test_content)
        test_path = Path(f.name)

    try:
        protected_modules = {"vertexai"}
        violations = find_direct_imports(test_path, protected_modules)

        # Should find no violations
        assert len(violations) == 0

    finally:
        test_path.unlink()


def test_find_direct_imports_no_violations():
    """Test file with no violations."""
    test_content = """
import os
from typing import Dict, List
from pathlib import Path
from onyx.lazy_handling.lazy_import_registry import lazy_vertexai

def some_function():
    return lazy_vertexai.some_method()
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(test_content)
        test_path = Path(f.name)

    try:
        protected_modules = {"vertexai", "transformers"}
        violations = find_direct_imports(test_path, protected_modules)

        # Should find no violations
        assert len(violations) == 0

    finally:
        test_path.unlink()


def test_find_direct_imports_file_read_error():
    """Test handling of file read errors."""
    # Create a file path that will cause read errors
    nonexistent_path = Path("/nonexistent/path/test.py")

    protected_modules = {"vertexai"}
    violations = find_direct_imports(nonexistent_path, protected_modules)

    # Should return empty list on error
    assert violations == []


def test_main_function_no_violations(tmp_path):
    """Test main function with no violations."""
    # Create a temporary backend directory structure
    backend_dir = tmp_path / "backend"
    backend_dir.mkdir()

    # Create lazy_handling directory
    lazy_handling_dir = backend_dir / "onyx" / "lazy_handling"
    lazy_handling_dir.mkdir(parents=True)

    # Create registry file
    registry_file = lazy_handling_dir / "lazy_import_registry.py"
    registry_file.write_text(
        """
lazy_vertexai: "vertexai" = LazyModule("vertexai")
"""
    )

    # Create a Python file with no violations (avoid "test" in name)
    test_file = backend_dir / "clean_module.py"
    test_file.write_text(
        """
import os
from onyx.lazy_handling.lazy_import_registry import lazy_vertexai
"""
    )

    # Mock __file__ to point to our temporary structure
    script_path = backend_dir / "scripts" / "check_lazy_imports.py"
    script_path.parent.mkdir(parents=True)

    with patch("check_lazy_imports.__file__", str(script_path)):
        result = main()

    assert result == 0  # Success


def test_main_function_with_violations(tmp_path):
    """Test main function with violations."""
    # Create a temporary backend directory structure
    backend_dir = tmp_path / "backend"
    backend_dir.mkdir()

    # Create lazy_handling directory
    lazy_handling_dir = backend_dir / "onyx" / "lazy_handling"
    lazy_handling_dir.mkdir(parents=True)

    # Create registry file
    registry_file = lazy_handling_dir / "lazy_import_registry.py"
    registry_file.write_text(
        """
lazy_vertexai: "vertexai" = LazyModule("vertexai")
"""
    )

    # Create a Python file with violations (avoid "test" in name)
    test_file = backend_dir / "violation_module.py"
    test_file.write_text(
        """
import vertexai
from vertexai import generative_models
"""
    )

    # Mock __file__ to point to our temporary structure
    script_path = backend_dir / "scripts" / "check_lazy_imports.py"
    script_path.parent.mkdir(parents=True)

    with patch("check_lazy_imports.__file__", str(script_path)):
        result = main()

    assert result == 1  # Failure due to violations


def test_type_checking_detection_variations():
    """Test various TYPE_CHECKING block formats."""
    test_cases = [
        # Standard format
        """
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import vertexai
""",
        # Alternative format
        """
import typing

if typing.TYPE_CHECKING:
    import vertexai
""",
        # With from import
        """
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from vertexai import generative_models
""",
    ]

    protected_modules = {"vertexai"}

    for test_content in test_cases:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_content)
            test_path = Path(f.name)

        try:
            violations = find_direct_imports(test_path, protected_modules)
            # All TYPE_CHECKING imports should be allowed
            assert len(violations) == 0
        finally:
            test_path.unlink()


def test_mixed_type_checking_and_regular_imports():
    """Test files with both TYPE_CHECKING and regular imports."""
    test_content = """from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import vertexai  # Should be allowed
    from transformers import AutoTokenizer  # Should be allowed

import os  # Regular import, should be ignored

# Exit TYPE_CHECKING block
import vertexai  # Should be flagged
from transformers import BertModel  # Should be flagged

def some_function():
    pass
"""

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(test_content)
        test_path = Path(f.name)

    try:
        protected_modules = {"vertexai", "transformers"}
        violations = find_direct_imports(test_path, protected_modules)

        # Should find 2 violations (lines 10, 11)
        assert len(violations) == 2

        violation_lines = [line_num for line_num, _ in violations]
        assert 10 in violation_lines  # import vertexai (outside TYPE_CHECKING)
        assert (
            11 in violation_lines
        )  # from transformers import BertModel (outside TYPE_CHECKING)

    finally:
        test_path.unlink()


if __name__ == "__main__":
    pytest.main([__file__])
