#!/usr/bin/env python3
"""
Test if our memory fix worked by simulating the import in the container.
"""

import subprocess


def test_memory_fix():
    """Test the memory fix by running the import simulation again"""

    test_script = """
import sys
import gc

def get_memory_mb():
    try:
        import psutil
        return psutil.Process().memory_info().rss / 1024 / 1024
    except:
        return 0

print("=== TESTING MEMORY FIX ===")

# Test importing primary worker after our changes
initial_memory = get_memory_mb()
initial_modules = len(sys.modules)

print(f"Initial state:")
print(f"  Memory: {initial_memory:.1f}MB")
print(f"  Modules: {initial_modules}")

try:
    print("\\nImporting fixed primary worker...")
    import onyx.background.celery.apps.primary

    after_memory = get_memory_mb()
    after_modules = len(sys.modules)

    memory_increase = after_memory - initial_memory
    module_increase = after_modules - initial_modules

    print(f"\\nAfter importing primary worker:")
    print(f"  Memory: {initial_memory:.1f}MB -> {after_memory:.1f}MB (+{memory_increase:.1f}MB)")
    print(f"  Modules: {initial_modules} -> {after_modules} (+{module_increase})")

    # Check for heavy modules
    heavy_patterns = ["torch", "transformers", "sentence_transformers", "sklearn", "numpy", "tokenizers", "huggingface"]
    heavy_modules = []

    for module_name in sys.modules:
        if any(pattern in module_name.lower() for pattern in heavy_patterns):
            heavy_modules.append(module_name)

    if heavy_modules:
        print(f"\\n❌ STILL PROBLEMATIC: {len(heavy_modules)} heavy modules found:")
        for mod in sorted(heavy_modules)[:15]:
            print(f"  • {mod}")
        if len(heavy_modules) > 15:
            print(f"  ... and {len(heavy_modules) - 15} more")
    else:
        print(f"\\n✅ SUCCESS: No heavy ML modules detected!")

    # Specific checks
    checks = {
        "torch": "PyTorch",
        "sklearn": "Scikit-learn",
        "transformers": "Transformers",
        "sentence_transformers": "Sentence Transformers",
        "numpy": "NumPy",
        "tokenizers": "Tokenizers"
    }

    print(f"\\nSpecific module checks:")
    for check, name in checks.items():
        count = len([m for m in sys.modules if check in m.lower()])
        if count > 0:
            print(f"  ❌ {name}: {count} modules")
        else:
            print(f"  ✅ {name}: Not detected")

    print(f"\\n=== RESULTS ===")
    if memory_increase < 100:
        print(f"✅ EXCELLENT: Memory increase under 100MB (+{memory_increase:.1f}MB)")
    elif memory_increase < 300:
        print(f"✅ GOOD: Memory increase under 300MB (+{memory_increase:.1f}MB)")
    elif memory_increase < 500:
        print(f"⚠️  MODERATE: Memory increase {memory_increase:.1f}MB (still room for improvement)")
    else:
        print(f"❌ STILL HIGH: Memory increase {memory_increase:.1f}MB (fix incomplete)")

    if len(heavy_modules) == 0:
        print("✅ CLEAN: No heavy ML modules imported")
    else:
        print(f"❌ DIRTY: {len(heavy_modules)} heavy modules still imported")

except Exception as e:
    print(f"\\nError during import: {e}")
    import traceback
    traceback.print_exc()
"""

    # Get container
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True
        )
        containers = [
            name.strip() for name in result.stdout.strip().split("\n") if name.strip()
        ]

        background_containers = [c for c in containers if "background" in c.lower()]
        if not background_containers:
            print("No background container found")
            return

        container_name = background_containers[0]
    except Exception as e:
        print(f"Error finding containers: {e}")
        return

    print("TESTING MEMORY FIX")
    print("=" * 50)
    print(f"Container: {container_name}")
    print("Testing if removing heavy imports from autodiscover_tasks worked...")
    print()

    try:
        result = subprocess.run(
            ["docker", "exec", container_name, "python", "-c", test_script],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode == 0:
            print(result.stdout)
        else:
            print("Test failed:")
            print(f"STDERR: {result.stderr}")
            if result.stdout:
                print(f"STDOUT: {result.stdout}")

    except subprocess.TimeoutExpired:
        print("Test timed out")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_memory_fix()
