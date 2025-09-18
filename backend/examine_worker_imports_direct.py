#!/usr/bin/env python3
"""
Directly examine what's imported in running Celery workers by injecting
analysis code into the actual processes.
"""

import subprocess


def create_simple_analysis_script():
    """Create a script that runs inside the actual container and analyzes all workers"""

    return """
import os
import sys
import json

print("=== DIRECT WORKER IMPORT ANALYSIS ===")

# Find all Celery worker processes
workers = []
for pid_str in os.listdir("/proc"):
    if not pid_str.isdigit():
        continue

    try:
        pid = int(pid_str)

        # Read command line
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            cmdline = f.read().decode("utf-8", errors="ignore").replace("\\x00", " ")

        if "celery" in cmdline and "worker" in cmdline:
            # Get worker type
            worker_type = "unknown"
            if "primary" in cmdline:
                worker_type = "primary"
            elif "light" in cmdline:
                worker_type = "light"
            elif "heavy" in cmdline:
                worker_type = "heavy"
            elif "docprocessing" in cmdline:
                worker_type = "docprocessing"
            elif "docfetching" in cmdline:
                worker_type = "docfetching"
            elif "monitoring" in cmdline:
                worker_type = "monitoring"
            elif "kg_processing" in cmdline:
                worker_type = "kg_processing"
            elif "beat" in cmdline:
                worker_type = "beat"

            # Get memory info
            try:
                with open(f"/proc/{pid}/status", "r") as f:
                    for line in f:
                        if line.startswith("VmRSS:"):
                            rss_kb = int(line.split()[1])
                            rss_mb = rss_kb / 1024
                            break
            except:
                rss_mb = 0

            workers.append({
                "pid": pid,
                "type": worker_type,
                "rss_mb": rss_mb,
                "cmdline": cmdline[:100]
            })

    except:
        continue

# Sort workers by memory usage
workers.sort(key=lambda x: x["rss_mb"], reverse=True)

print(f"Found {len(workers)} Celery workers:")
for w in workers:
    print(f"  {w['type']:<15} PID {w['pid']:<6} {w['rss_mb']:>8.1f}MB")

print()

# Now analyze what we CAN see from the current process perspective
# This gives us insight into what gets imported when Celery starts up

current_pid = os.getpid()
print(f"Current analysis process PID: {current_pid}")
print(f"Current process modules loaded: {len(sys.modules)}")

# Import the same things that workers would import to see memory impact
print("\\n=== SIMULATING WORKER IMPORTS ===")

# Try importing each worker's main modules to see what gets loaded
worker_imports = {
    "primary": [
        "onyx.background.celery.apps.primary",
    ],
    "light": [
        "onyx.background.celery.apps.light",
    ],
    "heavy": [
        "onyx.background.celery.apps.heavy",
    ],
    "docprocessing": [
        "onyx.background.celery.apps.docprocessing",
    ],
    "docfetching": [
        "onyx.background.celery.apps.docfetching",
    ],
    "monitoring": [
        "onyx.background.celery.apps.monitoring",
    ],
    "kg_processing": [
        "onyx.background.celery.apps.kg_processing",
    ]
}

def get_memory_mb():
    import psutil
    return psutil.Process().memory_info().rss / 1024 / 1024

initial_memory = get_memory_mb()
print(f"Initial memory: {initial_memory:.1f}MB")
print(f"Initial modules: {len(sys.modules)}")

for worker_type, import_list in worker_imports.items():
    print(f"\\n--- Simulating {worker_type.upper()} imports ---")

    before_memory = get_memory_mb()
    before_modules = len(sys.modules)

    for module_name in import_list:
        try:
            print(f"Importing {module_name}...")

            # Import and see what happens
            exec(f"import {module_name}")

            after_memory = get_memory_mb()
            after_modules = len(sys.modules)

            memory_increase = after_memory - before_memory
            module_increase = after_modules - before_modules

            print(f"  Memory: {before_memory:.1f}MB -> {after_memory:.1f}MB (+{memory_increase:.1f}MB)")
            print(f"  Modules: {before_modules} -> {after_modules} (+{module_increase})")

            # Check what heavy modules got imported
            heavy_patterns = [
                "torch", "transformers", "sentence_transformers", "sklearn",
                "numpy", "pandas", "tensorflow", "tokenizers", "huggingface"
            ]

            new_modules = list(sys.modules.keys())[before_modules:]
            heavy_modules = []

            for mod in new_modules:
                if any(pattern in mod.lower() for pattern in heavy_patterns):
                    heavy_modules.append(mod)

            if heavy_modules:
                print(f"  ❌ Heavy modules loaded: {heavy_modules[:5]}")
            else:
                print(f"  ✅ No heavy modules detected")

            # Show key new modules
            interesting_modules = [mod for mod in new_modules
                                 if not mod.startswith("_") and
                                    not mod.startswith("encodings") and
                                    len(mod) > 3][:10]

            if interesting_modules:
                print(f"  Key new modules: {interesting_modules}")

            before_memory = after_memory
            before_modules = after_modules

        except Exception as e:
            print(f"  Error importing {module_name}: {e}")

# Final analysis
print(f"\\n=== FINAL ANALYSIS ===")
final_memory = get_memory_mb()
final_modules = len(sys.modules)

print(f"Total memory increase: {initial_memory:.1f}MB -> {final_memory:.1f}MB (+{final_memory - initial_memory:.1f}MB)")
print(f"Total modules loaded: {final_modules - len(sys.modules)} new modules")

# Look for all heavy modules now loaded
all_heavy = []
heavy_patterns = [
    "torch", "transformers", "sentence_transformers", "sklearn",
    "numpy", "pandas", "tensorflow", "tokenizers", "huggingface"
]

for mod_name in sys.modules:
    if any(pattern in mod_name.lower() for pattern in heavy_patterns):
        all_heavy.append(mod_name)

if all_heavy:
    print(f"\\n❌ PROBLEMATIC: Heavy modules loaded after importing worker apps:")
    for mod in sorted(all_heavy)[:20]:
        print(f"  • {mod}")

    if len(all_heavy) > 20:
        print(f"  ... and {len(all_heavy) - 20} more")

    print(f"\\nThis explains the high memory usage!")
    print(f"These modules should NOT be imported by Celery workers.")
    print(f"Workers should communicate with model server via HTTP.")

else:
    print(f"\\n✅ Good: No heavy ML modules detected")

# Check for specific problematic imports
print(f"\\n=== SPECIFIC PROBLEMATIC CHECKS ===")
problematic_checks = {
    "torch": "PyTorch tensors and models",
    "transformers": "HuggingFace transformers",
    "sentence_transformers": "Sentence transformer models",
    "sklearn": "Scikit-learn ML algorithms",
    "numpy": "Large numerical arrays",
    "tokenizers": "Heavy tokenization libraries"
}

for check, description in problematic_checks.items():
    matches = [m for m in sys.modules if check in m.lower()]
    if matches:
        print(f"❌ {check}: {description} - Found {len(matches)} modules")
    else:
        print(f"✅ {check}: Not detected")

print(f"\\n=== ROOT CAUSE ANALYSIS ===")
print("If heavy modules are loaded, the issue is likely:")
print("1. Import hierarchy - worker apps import modules that import heavy dependencies")
print("2. Eager imports - heavy modules imported at startup, not when needed")
print("3. Shared dependencies - common modules pulling in heavy requirements")
print("4. Missing lazy loading - everything imported immediately")

print(f"\\n=== IMMEDIATE FIXES ===")
print("1. Add lazy imports to worker app files")
print("2. Move heavy imports inside functions (not at module level)")
print("3. Use HTTP calls to model server instead of direct model imports")
print("4. Split requirements into worker-specific files")
print("5. Implement import guards to prevent heavy imports in light workers")
"""


def main():
    print("DIRECT WORKER IMPORT EXAMINATION")
    print("=" * 50)
    print("Examining actual worker processes and simulating their imports")
    print()

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

    print(f"Analyzing container: {container_name}")
    print("-" * 30)

    analysis_script = create_simple_analysis_script()

    try:
        result = subprocess.run(
            ["docker", "exec", container_name, "python", "-c", analysis_script],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode == 0:
            print(result.stdout)
        else:
            print("Analysis failed:")
            print(f"STDERR: {result.stderr}")
            if result.stdout:
                print(f"STDOUT: {result.stdout}")

    except subprocess.TimeoutExpired:
        print("Analysis timed out")
    except Exception as e:
        print(f"Error: {e}")

    print("\n" + "=" * 60)
    print("KEY INSIGHTS")
    print("=" * 60)
    print("This analysis shows what gets imported when each worker app loads.")
    print("If heavy ML modules appear, that's the root cause of 700MB+ workers.")
    print("The fix is to implement lazy loading and remove direct ML imports.")


if __name__ == "__main__":
    main()
