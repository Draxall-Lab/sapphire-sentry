from __future__ import annotations

import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]

if str(PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT))

from sentry_core.sentry_engine import run_scan, DEFAULT_MAX_LINES

AVAILABLE_FUNCTIONS = ["sentry_scan"]

TOOLS = [
    {
        "type": "function",
        "is_local": True,
        "function": {
            "name": "sentry_scan",
            "description": "Run a Sapphire Sentry incident scan and store a snapshot group.",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_lines": {
                        "type": "integer",
                        "description": "Maximum number of log lines to scan.",
                        "default": DEFAULT_MAX_LINES
                    }
                }
            }
        }
    }
]


def execute(function_name, arguments, config, plugin_settings=None):
    if function_name != "sentry_scan":
        return "Unknown function.", False

    arguments = arguments or {}

    max_lines = int(arguments.get("max_lines", DEFAULT_MAX_LINES))

    result = run_scan(
        max_lines=max_lines,
        plugin_settings=plugin_settings,
    )

    scan_id = result.get("scan_id", "unknown")
    incidents = len(result.get("snapshots", []))

    return (
    f"Sapphire Sentry scan complete. "
    f"Snapshot group {scan_id} stored. "
    f"Review incidents in the Sapphire Sentry UI.",
    True,
)