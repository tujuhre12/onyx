#!/usr/bin/env python3
"""
Identify redundant imports in idle Celery workers.
This script analyzes what's loaded in each worker type and identifies imports
that shouldn't be there (like PyTorch in workers that only communicate with model server).
"""

import subprocess


def create_worker_analysis_script():
    """Create script to analyze imports in each worker type"""

    return """
import sys
import os
import gc
import importlib.util
from collections import defaultdict

print("=== CELERY WORKER IMPORT ANALYSIS ===")

current_pid = os.getpid()

# Determine worker type from command line
worker_type = "unknown"
try:
    with open(f"/proc/{current_pid}/cmdline", "rb") as f:
        cmdline = f.read().decode("utf-8", errors="ignore").replace("\\x00", " ")

    if "beat" in cmdline:
        worker_type = "beat"
    elif "primary" in cmdline:
        worker_type = "primary"
    elif "light" in cmdline:
        worker_type = "light"
    elif "heavy" in cmdline:
        worker_type = "heavy"
    elif "monitoring" in cmdline:
        worker_type = "monitoring"
    elif "kg_processing" in cmdline:
        worker_type = "kg_processing"
    elif "docprocessing" in cmdline:
        worker_type = "docprocessing"
    elif "docfetching" in cmdline:
        worker_type = "docfetching"

    print(f"Worker Type: {worker_type}")
    print(f"PID: {current_pid}")
    print(f"Command: {cmdline[:100]}...")

except Exception as e:
    print(f"Could not determine worker type: {e}")

# Get memory info
try:
    with open(f"/proc/{current_pid}/status", "r") as f:
        for line in f:
            if line.startswith("VmRSS:"):
                rss_mb = int(line.split()[1]) / 1024
                print(f"Current RSS: {rss_mb:.1f}MB")
                break
except:
    pass

print(f"\\nLoaded modules: {len(sys.modules)}")

# Categorize all loaded modules
categories = {
    "ML/AI Heavy": [],
    "PyTorch Ecosystem": [],
    "Transformers Ecosystem": [],
    "NumPy/Scientific": [],
    "Tokenizers": [],
    "HTTP/Networking": [],
    "Database": [],
    "Celery/Queue": [],
    "FastAPI/Web": [],
    "AWS/Cloud": [],
    "Onyx Core": [],
    "Onyx Indexing": [],
    "Onyx NLP": [],
    "Onyx Connectors": [],
    "Onyx Background": [],
    "Python Stdlib": [],
    "Other Third Party": []
}

# Define patterns for each category
patterns = {
    "ML/AI Heavy": [
        "torch", "pytorch", "tensorflow", "tf", "sklearn", "scikit",
        "sentence_transformers", "transformers", "huggingface_hub"
    ],
    "PyTorch Ecosystem": [
        "torch", "pytorch", "torchvision", "torchaudio", "torchtext"
    ],
    "Transformers Ecosystem": [
        "transformers", "tokenizers", "huggingface", "datasets", "accelerate"
    ],
    "NumPy/Scientific": [
        "numpy", "scipy", "pandas", "matplotlib", "seaborn", "plotly"
    ],
    "Tokenizers": [
        "tokenizers", "tiktoken", "sentencepiece"
    ],
    "HTTP/Networking": [
        "requests", "httpx", "urllib3", "aiohttp", "httpcore"
    ],
    "Database": [
        "sqlalchemy", "psycopg", "redis", "alembic", "pymongo"
    ],
    "Celery/Queue": [
        "celery", "kombu", "billiard", "amqp"
    ],
    "FastAPI/Web": [
        "fastapi", "starlette", "pydantic", "uvicorn"
    ],
    "AWS/Cloud": [
        "boto3", "botocore", "google", "azure", "aws"
    ],
    "Onyx Core": [
        "onyx.auth", "onyx.configs", "onyx.utils", "onyx.db.engine"
    ],
    "Onyx Indexing": [
        "onyx.indexing", "onyx.document_index"
    ],
    "Onyx NLP": [
        "onyx.natural_language", "onyx.llm"
    ],
    "Onyx Connectors": [
        "onyx.connectors", "onyx.federated_connectors"
    ],
    "Onyx Background": [
        "onyx.background"
    ]
}

# Categorize modules
for module_name in sys.modules.keys():
    categorized = False

    for category, pattern_list in patterns.items():
        if any(pattern in module_name.lower() for pattern in pattern_list):
            categories[category].append(module_name)
            categorized = True
            break

    if not categorized:
        if module_name.startswith("onyx."):
            categories["Onyx Core"].append(module_name)
        elif "." not in module_name and module_name in sys.builtin_module_names:
            categories["Python Stdlib"].append(module_name)
        elif not module_name.startswith("_"):
            categories["Other Third Party"].append(module_name)

# Print analysis
print(f"\\n=== MODULE BREAKDOWN BY CATEGORY ===")
total_suspicious = 0

for category, modules in categories.items():
    if modules:
        print(f"\\n{category} ({len(modules)} modules):")

        # Sort modules for better readability
        sorted_modules = sorted(modules)

        # Show first 10 modules, then count
        for i, module in enumerate(sorted_modules[:10]):
            print(f"  • {module}")

        if len(sorted_modules) > 10:
            print(f"  ... and {len(sorted_modules) - 10} more")

        # Flag suspicious imports for each worker type
        is_suspicious = False

        if worker_type == "light":
            if category in ["ML/AI Heavy", "PyTorch Ecosystem", "Transformers Ecosystem", "Onyx Indexing", "Onyx NLP"]:
                is_suspicious = True
        elif worker_type == "heavy":
            if category in ["ML/AI Heavy", "PyTorch Ecosystem", "Transformers Ecosystem", "Onyx NLP"]:
                is_suspicious = True
        elif worker_type == "monitoring":
            if category in ["ML/AI Heavy", "PyTorch Ecosystem", "Transformers Ecosystem", "Onyx Indexing", "Onyx NLP", "Onyx Connectors"]:
                is_suspicious = True
        elif worker_type == "beat":
            if category in ["ML/AI Heavy", "PyTorch Ecosystem", "Transformers Ecosystem", "Onyx Indexing", "Onyx NLP", "Onyx Connectors"]:
                is_suspicious = True

        if is_suspicious:
            print(f"    ⚠️  SUSPICIOUS: {worker_type} worker shouldn't need {category}")
            total_suspicious += len(modules)

# Specific problematic module analysis
print(f"\\n=== PROBLEMATIC IMPORTS ANALYSIS ===")

problematic_modules = {
    "torch": "PyTorch - Should only be in model server",
    "transformers": "Transformers - Should only be in model server",
    "sentence_transformers": "Sentence Transformers - Should only be in model server",
    "sklearn": "Scikit-learn - Heavy ML library",
    "tensorflow": "TensorFlow - Should only be in model server",
    "numpy": "NumPy - Heavy numerical arrays (may be needed for some workers)",
    "pandas": "Pandas - Heavy dataframe library",
    "tokenizers": "HuggingFace Tokenizers - Heavy tokenization (some workers may need)",
    "huggingface_hub": "HuggingFace Hub - Model downloading (shouldn't be needed)"
}

found_problematic = []
for module_name, description in problematic_modules.items():
    matches = [m for m in sys.modules.keys() if module_name in m.lower()]
    if matches:
        found_problematic.extend(matches)
        print(f"❌ {module_name}: {description}")
        print(f"   Found modules: {matches[:5]}")

if not found_problematic:
    print("✅ No obviously problematic modules found")

# Memory estimation
print(f"\\n=== ESTIMATED MEMORY IMPACT ===")

memory_estimates = {
    "torch": 200,
    "transformers": 100,
    "sentence_transformers": 150,
    "sklearn": 80,
    "numpy": 30,
    "pandas": 50,
    "tokenizers": 40,
    "tensorflow": 250,
}

total_estimated_heavy = 0
for module_name, mb in memory_estimates.items():
    if any(module_name in m.lower() for m in sys.modules.keys()):
        total_estimated_heavy += mb
        print(f"  {module_name}: ~{mb}MB")

if total_estimated_heavy > 0:
    print(f"\\nTotal estimated heavy module memory: ~{total_estimated_heavy}MB")
    print(f"Remaining unexplained memory: ~{rss_mb - total_estimated_heavy:.1f}MB")
else:
    print("\\n✅ No heavy modules contributing significant memory")

# Import chain analysis for suspicious modules
print(f"\\n=== IMPORT CHAIN ANALYSIS ===")

if found_problematic:
    print("Analyzing how problematic modules got loaded...")

    # Try to find which modules imported the heavy ones
    for problematic in found_problematic[:3]:  # Check first 3
        try:
            module = sys.modules[problematic]
            if hasattr(module, '__file__') and module.__file__:
                print(f"\\n{problematic}:")
                print(f"  File: {module.__file__}")

                # Look for modules that might have imported this
                potential_importers = []
                for mod_name, mod in sys.modules.items():
                    if mod_name.startswith("onyx.") and hasattr(mod, '__dict__'):
                        try:
                            if any(problematic.split('.')[0] in str(v) for v in mod.__dict__.values() if hasattr(v, '__module__')):
                                potential_importers.append(mod_name)
                        except:
                            pass

                if potential_importers:
                    print(f"  Potential importers: {potential_importers[:3]}")

        except Exception as e:
            print(f"  Error analyzing {problematic}: {e}")

# Worker type specific recommendations
print(f"\\n=== RECOMMENDATIONS FOR {worker_type.upper()} WORKER ===")

recommendations = {
    "light": [
        "Should only import basic SQL, HTTP, and coordination modules",
        "Remove any ML/AI, indexing, or NLP imports",
        "Target memory: <200MB"
    ],
    "heavy": [
        "Should only import SQL and pruning-related modules",
        "Remove any ML/AI or NLP imports",
        "Target memory: <200MB"
    ],
    "monitoring": [
        "Should only import monitoring and metrics modules",
        "Remove any ML/AI, indexing, or connector imports",
        "Target memory: <150MB"
    ],
    "beat": [
        "Should only import scheduling and basic coordination",
        "Remove any heavy processing imports",
        "Target memory: <100MB"
    ],
    "primary": [
        "May need some indexing coordination but not full ML stack",
        "Remove direct ML model imports (use HTTP to model server)",
        "Target memory: <300MB"
    ],
    "docprocessing": [
        "May legitimately need some ML imports for processing pipeline",
        "But should use model server for actual inference",
        "Target memory: <400MB"
    ],
    "docfetching": [
        "Should only need connector and HTTP imports",
        "Remove any ML/AI imports",
        "Target memory: <250MB"
    ]
}

if worker_type in recommendations:
    for rec in recommendations[worker_type]:
        print(f"  • {rec}")

print(f"\\nTotal suspicious imports: {total_suspicious}")
print(f"Current memory usage: {rss_mb:.1f}MB")

if total_suspicious > 10:
    print("⚠️  HIGH: Many suspicious imports detected!")
elif total_suspicious > 3:
    print("⚠️  MEDIUM: Some suspicious imports detected")
else:
    print("✅ LOW: Few suspicious imports")
"""


def analyze_all_workers():
    """Analyze imports across all worker types"""

    print("REDUNDANT IMPORT ANALYSIS FOR ALL CELERY WORKERS")
    print("=" * 60)
    print("Analyzing what's loaded in each worker type to identify redundant imports")
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
    print()

    # Get list of worker processes first
    process_script = """
import os
processes = []
for pid_str in os.listdir("/proc"):
    if not pid_str.isdigit():
        continue
    try:
        with open(f"/proc/{pid_str}/cmdline", "rb") as f:
            cmdline = f.read().decode("utf-8", errors="ignore")
        if "celery" in cmdline and "worker" in cmdline:
            with open(f"/proc/{pid_str}/status", "r") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        rss_mb = int(line.split()[1]) / 1024
                        break
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

            processes.append({"pid": int(pid_str), "type": worker_type, "rss_mb": rss_mb})
    except:
        continue

processes.sort(key=lambda x: (x["type"], -x["rss_mb"]))
for p in processes:
    print(f"{p['type']},{p['pid']},{p['rss_mb']:.1f}")
"""

    # Get worker processes
    try:
        result = subprocess.run(
            ["docker", "exec", container_name, "python", "-c", process_script],
            capture_output=True,
            text=True,
            timeout=30,
        )

        worker_processes = []
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if line and "," in line:
                    parts = line.split(",")
                    if len(parts) >= 3:
                        worker_processes.append(
                            {
                                "type": parts[0],
                                "pid": parts[1],
                                "rss_mb": float(parts[2]),
                            }
                        )

    except Exception as e:
        print(f"Error getting worker processes: {e}")
        return

    if not worker_processes:
        print("No Celery worker processes found")
        return

    print(f"Found {len(worker_processes)} worker processes:")
    for proc in worker_processes:
        print(f"  {proc['type']:<15} PID {proc['pid']:<6} {proc['rss_mb']:.1f}MB")

    print("\n" + "=" * 60)

    # Analyze each unique worker type
    analyzed_types = set()
    analysis_script = create_worker_analysis_script()

    for proc in worker_processes:
        worker_type = proc["type"]
        if worker_type in analyzed_types or worker_type == "unknown":
            continue

        analyzed_types.add(worker_type)

        print(f"\n{'='*20} ANALYZING {worker_type.upper()} WORKER {'='*20}")

        try:
            # Use nsenter to run analysis in the specific worker process namespace
            result = subprocess.run(
                [
                    "docker",
                    "exec",
                    container_name,
                    "nsenter",
                    "-t",
                    proc["pid"],
                    "-p",
                    "-m",
                    "python",
                    "-c",
                    analysis_script,
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )

            if result.returncode == 0:
                print(result.stdout)
            else:
                # Fallback: run analysis in container but note the limitation
                print(f"Direct process analysis failed, using container-wide analysis:")
                print(
                    f"(Note: This may not reflect the exact state of PID {proc['pid']})"
                )

                result = subprocess.run(
                    ["docker", "exec", container_name, "python", "-c", analysis_script],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )

                if result.returncode == 0:
                    print(result.stdout)
                else:
                    print(f"Analysis failed: {result.stderr}")

        except subprocess.TimeoutExpired:
            print(f"Analysis timed out for {worker_type}")
        except Exception as e:
            print(f"Error analyzing {worker_type}: {e}")

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY AND NEXT STEPS")
    print(f"{'='*60}")
    print("This analysis identified redundant imports in each worker type.")
    print("Key findings to look for:")
    print("  • PyTorch/ML libraries in non-ML workers (light, heavy, monitoring)")
    print("  • Heavy scientific libraries (numpy, pandas) where not needed")
    print("  • Transformers/tokenizers in workers that should use HTTP to model server")
    print("  • Large Onyx modules imported across all workers")
    print()
    print("Next steps:")
    print("  1. Fix import hierarchy to prevent heavy imports")
    print("  2. Use lazy loading for worker-specific modules")
    print("  3. Move ML inference to model server (HTTP calls only)")
    print("  4. Implement import isolation between worker types")


def main():
    analyze_all_workers()


if __name__ == "__main__":
    main()
