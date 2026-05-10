"""
detector.py

Responsible for:
- classifying log lines
- grouping them into incident patterns
- attaching continuation/context lines
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime

from .normalise import normalise_line, make_pattern_key

INCIDENT_CATEGORIES = {"error", "warning", "critical"}

# --- Classification regex ---

LOG_LEVEL_RE = re.compile(
    r"\b(DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL)\b", re.I
)

PYTHON_WARNING_RE = re.compile(
    r"^\s*.*?\.py:\d+:\s*(\w*Warning):", re.I
)

INDENTED_LINE_RE = re.compile(r"^\s+")

CODE_WARNING_CALL_RE = re.compile(r"\bwarnings?\s*\.?\s*warn\b", re.I)


# --- Helpers ---

def classify_line(line: str) -> str | None:
    """
    Determine category of a log line.

    Returns:
        "error", "warning", "info", "debug", or None
    """
    if not line:
        return None
    
    if CODE_WARNING_CALL_RE.search(line):
        return None

    # Python warnings (Kokoro case)
    if PYTHON_WARNING_RE.search(line):
        return "warning"

    # Standard log levels
    match = LOG_LEVEL_RE.search(line)
    if match:
        level = match.group(1).lower()

        if level == "warn":
            level = "warning"

        return level

    return None


# --- Core grouping logic ---

def detect_snapshots(lines: list[str], source: str = "unknown") -> list[dict]:
    """
    Convert raw log lines into grouped snapshot structures.
    """

    groups = {}
    current_snapshot = None

    for idx, line in enumerate(lines):
        category = classify_line(line)

        if category and category not in INCIDENT_CATEGORIES:
            current_snapshot = None
            continue

        # --- New incident ---
        if category:
            normalised = normalise_line(line)
            pattern_key = make_pattern_key(source, category, normalised)

            if pattern_key not in groups:
                groups[pattern_key] = {
                    "pattern_key": pattern_key,
                    "source": source,
                    "category": category,
                    "normalised_pattern": normalised,
                    "trigger_line": line.strip(),
                    "count": 0,
                    "first_seen": idx,
                    "last_seen": idx,
                    "context_after": [],
                }

            snapshot = groups[pattern_key]

            snapshot["count"] += 1
            snapshot["last_seen"] = idx

            current_snapshot = snapshot

        # --- Continuation line ---
        elif current_snapshot and INDENTED_LINE_RE.match(line):
            current_snapshot["context_after"].append(line.rstrip())

        # --- Unclassified, non-indented line ---
        else:
            current_snapshot = None

    return list(groups.values())