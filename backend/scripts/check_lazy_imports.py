"""
Pre-commit hook to ensure modules in lazy_import_registry.py are only imported lazily.

This script prevents direct imports of modules that should be lazily loaded,
helping maintain memory optimization and preventing import-time dependencies.
"""

import logging
import re
import sys
from pathlib import Path
from typing import Dict
from typing import List
from typing import Set

# Configure the logger
logging.basicConfig(
    level=logging.INFO,  # Set the log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",  # Log format
    handlers=[logging.StreamHandler()],  # Output logs to console
)

logger = logging.getLogger(__name__)


def get_lazy_modules(registry_path: Path) -> Dict[str, str]:
    """
    Extract lazy module mappings from the registry file.

    Returns:
        Dict mapping lazy variable names to actual module names
        e.g., {"lazy_vertexai": "vertexai"}
    """
    lazy_modules = {}

    try:
        content = registry_path.read_text(encoding="utf-8")

        # Pattern to match: lazy_varname: "modulename" = LazyModule("modulename")
        pattern = (
            r'(lazy_\w+):\s*["\']([^"\']+)["\']\s*=\s*LazyModule\(["\']([^"\']+)["\']\)'
        )

        for match in re.finditer(pattern, content):
            lazy_var, type_hint, module_name = match.groups()
            lazy_modules[lazy_var] = module_name

    except FileNotFoundError:
        print(f"Error: Could not find lazy import registry at {registry_path}")
        return {}
    except Exception as e:
        print(f"Error reading registry file: {e}")
        return {}

    return lazy_modules


def find_direct_imports(file_path: Path, protected_modules: Set[str]) -> List[tuple]:
    """
    Find direct imports of protected modules in a given file.

    Args:
        file_path: Path to Python file to check
        protected_modules: Set of module names that should only be imported lazily

    Returns:
        List of (line_number, line_content) tuples for violations
    """
    violations = []

    try:
        content = file_path.read_text(encoding="utf-8")
        lines = content.split("\n")

        in_type_checking = False
        type_checking_indent = None

        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()

            # Track TYPE_CHECKING blocks to allow imports there
            if "TYPE_CHECKING" in stripped and "if" in stripped:
                in_type_checking = True
                # Capture the indentation level to know when we exit the block
                type_checking_indent = len(line) - len(line.lstrip())
                continue

            # Exit TYPE_CHECKING block when we see code at same or less indentation
            if in_type_checking and stripped and not stripped.startswith("#"):
                current_indent = len(line) - len(line.lstrip())
                if current_indent <= type_checking_indent:
                    in_type_checking = False

            # Skip comments and empty lines
            if not stripped or stripped.startswith("#"):
                continue

            # Allow imports in TYPE_CHECKING blocks
            if in_type_checking:
                continue

            # Check for direct imports of protected modules
            for module in protected_modules:
                # Pattern 1: import module
                if re.match(rf"^import\s+{re.escape(module)}(\s|$|\.)", stripped):
                    violations.append((line_num, line))

                # Pattern 2: from module import ...
                elif re.match(rf"^from\s+{re.escape(module)}(\s|\.|$)", stripped):
                    violations.append((line_num, line))

                # Pattern 3: from ... import module (less common but possible)
                elif re.search(
                    rf"^from\s+[\w.]+\s+import\s+.*\b{re.escape(module)}\b", stripped
                ):
                    violations.append((line_num, line))

    except Exception as e:
        print(f"Error reading {file_path}: {e}")

    return violations


def main() -> int:
    backend_dir = Path(__file__).parent.parent  # Go up from scripts/ to backend/
    registry_path = backend_dir / "onyx" / "lazy_handling" / "lazy_import_registry.py"

    # Get lazy modules from registry
    lazy_modules = get_lazy_modules(registry_path)

    if not lazy_modules:
        logger.info("No lazy modules found in registry or error reading registry")
        return 0

    protected_modules = set(lazy_modules.values())
    logger.info(
        f"Checking for direct imports of lazy modules: {', '.join(protected_modules)}"
    )

    # Find all Python files in backend (excluding the registry itself)
    python_files = []
    for pattern in ["**/*.py"]:
        for file_path in backend_dir.glob(pattern):
            # Skip the registry file itself
            try:
                if file_path.samefile(registry_path):
                    continue
            except (OSError, FileNotFoundError):
                # Handle case where files don't exist or can't be compared
                if file_path == registry_path:
                    continue
            # Skip __pycache__ and other non-source directories
            if any(
                part.startswith(".") or part == "__pycache__"
                for part in file_path.parts
            ):
                continue
            # Skip test files (they can contain test imports)
            # Check if it's in a tests directory or has test in filename
            path_parts = file_path.parts
            if (
                "tests" in path_parts
                or file_path.name.startswith("test_")
                or file_path.name.endswith("_test.py")
            ):
                continue
            python_files.append(file_path)

    violations_found = False

    # Check each Python file
    for file_path in python_files:
        violations = find_direct_imports(file_path, protected_modules)

        if violations:
            violations_found = True
            rel_path = file_path.relative_to(backend_dir)
            logger.info(f"\n❌ Direct import violations found in {rel_path}:")

            for line_num, line in violations:
                logger.info(f"  Line {line_num}: {line.strip()}")

            # Suggest fix
            for module in protected_modules:
                if any(module in line for _, line in violations):
                    lazy_var = next(
                        var for var, mod in lazy_modules.items() if mod == module
                    )
                    logger.info(
                        f"  💡 Use: from onyx.lazy_handling.lazy_import_registry import {lazy_var}"
                    )

    if violations_found:
        logger.info(
            "\n🚫 Found direct imports of lazy modules. Please use the lazy imports from the registry."
        )
        return 1
    else:
        logger.info("✅ All lazy modules are properly imported through the registry!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
