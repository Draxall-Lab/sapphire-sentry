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

from datetime import datetime, timezone
from sentry_core.storage import load_state, save_state


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

    Stores all detected snapshots in history, but only returns snapshots
    that are not currently ignored or snoozed.
    """

    root = get_sapphire_root(plugin_settings)

    scan_id = generate_scan_id()
    scan_timestamp = datetime.now(timezone.utc).isoformat()

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

        for snap in snapshots:
            snap["scan_id"] = scan_id
            snap["created_at"] = scan_timestamp
            snap["updated_at"] = scan_timestamp
            snap.setdefault("status", "active")

        all_snapshots.extend(snapshots)
        sources_scanned += 1

    state = load_state(plugin_settings)

    existing_snapshots = state.get("snapshots", [])
    rules = state.get("rules", [])

    now = datetime.now(timezone.utc)

    active_rules = []
    changed_rules = False

    for rule in rules:
        if not rule.get("enabled"):
            active_rules.append(rule)
            continue

        action = rule.get("action")

        if action == "snooze":
            expires_at = rule.get("expires_at")

            if not expires_at:
                changed_rules = True
                continue

            try:
                expiry = datetime.fromisoformat(expires_at)
            except Exception:
                changed_rules = True
                continue

            if expiry <= now:
                changed_rules = True
                continue

        active_rules.append(rule)

    def is_suppressed(snapshot: dict) -> bool:
        for rule in active_rules:
            if not rule.get("enabled"):
                continue

            action = rule.get("action")

            if action not in {"ignore", "snooze"}:
                continue

            if rule.get("pattern_key") != snapshot.get("pattern_key"):
                continue

            if rule.get("source") and rule.get("source") != snapshot.get("source"):
                continue

            if rule.get("category") and rule.get("category") != snapshot.get("category"):
                continue

            return True

        return False

    visible_snapshots = [
        snap for snap in all_snapshots
        if not is_suppressed(snap)
    ]

    state["snapshots"] = existing_snapshots + all_snapshots
    state["rules"] = active_rules

    save_state(state, plugin_settings)

    return {
        "ok": True,
        "scan_id": scan_id,
        "timestamp": scan_timestamp,
        "snapshots": visible_snapshots,
        "summary": {
            "sources_scanned": sources_scanned,
            "snapshots_found": len(all_snapshots),
            "snapshots_visible": len(visible_snapshots),
            "snapshots_suppressed": len(all_snapshots) - len(visible_snapshots),
            "expired_snoozes_removed": changed_rules,
        },
    }