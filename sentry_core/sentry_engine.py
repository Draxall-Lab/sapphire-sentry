"""
sentry_engine.py

Responsible for:
- locating log files
- reading recent lines
- invoking detector per source
- returning structured scan result
"""

from __future__ import annotations

from pathlib import Path
from datetime import datetime

from .path_utils import get_sapphire_root
from .detector import detect_snapshots


# --- Config ---

LOG_SOURCES = {
    "sapphire": ["sapphire.log", "sapphire.txt"],
    "kokoro": ["kokoro.log", "kokoro.txt"],
    "startup": ["startup_errors.log"],
    "story": ["story_engine.log"],
}

DEFAULT_MAX_LINES = 5000


# --- Helpers ---

def find_log_file(root: Path, candidates: list[str]) -> Path | None:
    """
    Try to locate a log file from a list of possible filenames.
    Searches common locations.
    """
    search_paths = [
        root,
        root / "logs",
        root / "user",
        root / "user" / "logs",
    ]

    for base in search_paths:
        for name in candidates:
            candidate = base / name
            if candidate.exists():
                return candidate

    return None


def read_last_lines(path: Path, max_lines: int) -> list[str]:
    """
    Read last N lines from a file safely.
    """
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            return lines[-max_lines:]
    except Exception:
        return []


def generate_scan_id() -> str:
    return datetime.utcnow().strftime("scan-%Y%m%d-%H%M%S")


# --- Core scan ---

def run_scan(max_lines: int = DEFAULT_MAX_LINES, plugin_settings: dict | None = None) -> dict:
    """
    Execute a Sentry scan across all known log sources.
    """

    root = get_sapphire_root(plugin_settings)

    scan_id = generate_scan_id()
    all_snapshots = []
    sources_scanned = 0

    for source, filenames in LOG_SOURCES.items():
        log_path = find_log_file(root, filenames)

        if not log_path:
            continue

        lines = read_last_lines(log_path, max_lines)

        if not lines:
            continue

        snapshots = detect_snapshots(lines, source=source)

        all_snapshots.extend(snapshots)
        sources_scanned += 1

    result = {
        "ok": True,
        "scan_id": scan_id,
        "timestamp": datetime.utcnow().isoformat(),
        "snapshots": all_snapshots,
        "summary": {
            "sources_scanned": sources_scanned,
            "snapshots_found": len(all_snapshots),
        },
    }

    return result