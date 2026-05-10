from __future__ import annotations

import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]

if str(PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT))

from sentry_core.sentry_engine import run_scan
from sentry_core.storage import (
    add_scan_result,
    filter_suppressed_snapshots,
    load_state,
)


def run_scan_route(body=None, settings=None, **kwargs):
    body = body or {}
    settings = settings or {}

    max_lines = body.get("max_lines")

    try:
        max_lines = int(max_lines) if max_lines else 5000
    except (TypeError, ValueError):
        max_lines = 5000

    result = run_scan(
        max_lines=max_lines,
        plugin_settings=settings,
    )

    visible, suppressed = filter_suppressed_snapshots(
        result.get("snapshots", []),
        plugin_settings=settings,
    )

    result["snapshots"] = visible
    result["suppressed_snapshots"] = suppressed

    result.setdefault("summary", {})
    result["summary"]["visible_snapshots"] = len(visible)
    result["summary"]["suppressed_snapshots"] = len(suppressed)

    add_scan_result(result, plugin_settings=settings)

    state = load_state(plugin_settings=settings)
    result["summary"]["stored_snapshots"] = len(state.get("snapshots", []))
    result["summary"]["stored_rules"] = len(state.get("rules", []))

    return result