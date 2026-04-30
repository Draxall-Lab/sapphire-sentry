"""
storage.py

Persistent state handling for Sapphire Sentry.

Stores:
- settings
- scan history
- snapshots
- ignore/snooze rules

State file target:
user/plugin_state/sapphire-sentry.json
"""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .path_utils import get_sapphire_root


PLUGIN_NAME = "sapphire-sentry"
STATE_VERSION = 1

DEFAULT_MAX_SNAPSHOTS = 100

SNOOZE_PRESETS = {
    "1h": timedelta(hours=1),
    "4h": timedelta(hours=4),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}

DEFAULT_STATE = {
    "version": STATE_VERSION,
    "settings": {
        "max_snapshots": DEFAULT_MAX_SNAPSHOTS,
        "max_lines_per_scan": 5000,
        "context_before_lines": 50,
        "context_after_lines": 20,
    },
    "scans": [],
    "snapshots": [],
    "rules": [],
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        # Supports ISO strings produced by datetime.isoformat()
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def get_state_path(plugin_settings: dict | None = None) -> Path:
    root = get_sapphire_root(plugin_settings)
    return root / "user" / "plugin_state" / f"{PLUGIN_NAME}.json"


def ensure_state_dir(plugin_settings: dict | None = None) -> None:
    get_state_path(plugin_settings).parent.mkdir(parents=True, exist_ok=True)


def default_state() -> dict[str, Any]:
    return deepcopy(DEFAULT_STATE)


def load_state(plugin_settings: dict | None = None) -> dict[str, Any]:
    path = get_state_path(plugin_settings)

    if not path.exists():
        return default_state()

    try:
        with path.open("r", encoding="utf-8") as f:
            state = json.load(f)
    except Exception:
        return default_state()

    return migrate_state(state)


def save_state(state: dict[str, Any], plugin_settings: dict | None = None) -> dict[str, Any]:
    ensure_state_dir(plugin_settings)

    state = migrate_state(state)
    path = get_state_path(plugin_settings)

    with path.open("w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)

    return state


def migrate_state(state: dict[str, Any]) -> dict[str, Any]:
    """
    Light defensive migration/repair.

    Keeps v0.1 tolerant while the schema settles.
    """
    repaired = default_state()

    if not isinstance(state, dict):
        return repaired

    repaired["version"] = state.get("version", STATE_VERSION)

    if isinstance(state.get("settings"), dict):
        repaired["settings"].update(state["settings"])

    if isinstance(state.get("scans"), list):
        repaired["scans"] = state["scans"]

    if isinstance(state.get("snapshots"), list):
        repaired["snapshots"] = state["snapshots"]

    if isinstance(state.get("rules"), list):
        repaired["rules"] = state["rules"]

    return repaired


def make_id(prefix: str, existing: list[dict[str, Any]]) -> str:
    """
    Simple sequential ID generator based on current list length.

    Good enough for v0.1 local JSON state.
    """
    return f"{prefix}-{len(existing) + 1:06d}"


def prune_snapshots(state: dict[str, Any]) -> dict[str, Any]:
    max_snapshots = int(
        state.get("settings", {}).get("max_snapshots", DEFAULT_MAX_SNAPSHOTS)
    )

    snapshots = state.get("snapshots", [])

    if len(snapshots) <= max_snapshots:
        return state

    # Prefer pruning resolved/analysed first, then oldest.
    status_priority = {
        "resolved": 0,
        "analysed": 1,
        "seen": 2,
        "new": 3,
        "snoozed": 4,
        "ignored": 5,
    }

    snapshots_sorted = sorted(
        snapshots,
        key=lambda s: (
            status_priority.get(s.get("status", "new"), 3),
            s.get("created_at", ""),
        ),
        reverse=True,
    )

    state["snapshots"] = snapshots_sorted[:max_snapshots]
    return state


def add_scan_result(
    scan_result: dict[str, Any],
    plugin_settings: dict | None = None,
) -> dict[str, Any]:
    """
    Store scan metadata and snapshots from a scan result.
    """
    state = load_state(plugin_settings)

    scan_id = scan_result.get("scan_id") or make_id("scan", state["scans"])
    created_at = scan_result.get("timestamp") or utc_now_iso()

    scan_record = {
        "id": scan_id,
        "created_at": created_at,
        "status": "completed" if scan_result.get("ok", True) else "failed",
        "summary": scan_result.get("summary", {}),
    }

    state["scans"].insert(0, scan_record)

    for snap in scan_result.get("snapshots", []):
        pattern_key = snap.get("pattern_key")

        snapshot_record = {
            "id": make_id("snap", state["snapshots"]),
            "scan_id": scan_id,
            "created_at": created_at,
            "status": "new",
            "severity": infer_severity(snap),
            **snap,
            "analysis": {
                "analysed_at": None,
                "chat_name": None,
                "notes": None,
            },
        }

        state["snapshots"].insert(0, snapshot_record)

    prune_snapshots(state)
    return save_state(state, plugin_settings)


def infer_severity(snapshot: dict[str, Any]) -> str:
    category = (snapshot.get("category") or "").lower()
    count = int(snapshot.get("count") or 0)

    if category in {"critical"}:
        return "critical"

    if category == "error":
        return "high" if count > 1 else "medium"

    if category == "warning":
        return "medium" if count >= 10 else "low"

    return "low"


from datetime import datetime, timezone

def list_snapshots(
    status: str | None = None,
    plugin_settings: dict | None = None,
) -> list[dict[str, Any]]:
    state = load_state(plugin_settings)
    snapshots = state.get("snapshots", [])
    rules = state.get("rules", [])

    if status:
        return [s for s in snapshots if s.get("status") == status]

    now = datetime.now(timezone.utc)

    active_snapshots = []

    for snap in snapshots:
        suppressed = False

        for rule in rules:
            if not rule.get("enabled"):
                continue

            if rule.get("pattern_key") != snap.get("pattern_key"):
                continue

            action = rule.get("action")

            if action == "ignore":
                suppressed = True
                break

            if action == "snooze":
                expires_at = rule.get("expires_at")

                if expires_at:
                    try:
                        expiry = datetime.fromisoformat(expires_at)
                    except Exception:
                        continue

                    if expiry > now:
                        suppressed = True
                        break

        if not suppressed:
            active_snapshots.append(snap)

    return active_snapshots

def list_snapshot_groups(
    status: str | None = None,
    plugin_settings: dict | None = None,
) -> list[dict[str, Any]]:
    state = load_state(plugin_settings)
    snapshots = state.get("snapshots", [])

    if status:
        snapshots = [s for s in snapshots if s.get("status") == status]

    groups = {}

    for snap in snapshots:
        scan_id = snap.get("scan_id") or "unknown-scan"

        if scan_id not in groups:
            groups[scan_id] = {
                "scan_id": scan_id,
                "created_at": snap.get("created_at"),
                "item_count": 0,
                "total_count": 0,
                "items": [],
            }

        groups[scan_id]["items"].append(snap)
        groups[scan_id]["item_count"] += 1
        groups[scan_id]["total_count"] += int(snap.get("count") or 0)

        created_at = snap.get("created_at")
        if created_at and (
            not groups[scan_id].get("created_at")
            or created_at > groups[scan_id]["created_at"]
        ):
            groups[scan_id]["created_at"] = created_at

    return sorted(
        groups.values(),
        key=lambda g: g.get("created_at") or "",
        reverse=True,
    )

def get_snapshot(
    snapshot_id: str,
    plugin_settings: dict | None = None,
) -> dict[str, Any] | None:
    state = load_state(plugin_settings)

    for snapshot in state.get("snapshots", []):
        if snapshot.get("id") == snapshot_id:
            return snapshot

    return None


def update_snapshot_status(
    snapshot_id: str,
    status: str,
    plugin_settings: dict | None = None,
) -> dict[str, Any] | None:
    state = load_state(plugin_settings)

    for snapshot in state.get("snapshots", []):
        if snapshot.get("id") == snapshot_id:
            snapshot["status"] = status
            snapshot["updated_at"] = utc_now_iso()
            save_state(state, plugin_settings)
            return snapshot

    return None


def create_rule_from_snapshot(
    snapshot_id: str,
    action: str,
    plugin_settings: dict | None = None,
    snooze_preset: str | None = None,
    reason: str | None = None,
) -> dict[str, Any] | None:
    """
    Create an ignore or snooze rule from an existing snapshot.
    """
    state = load_state(plugin_settings)

    snapshot = None
    for item in state.get("snapshots", []):
        if item.get("id") == snapshot_id:
            snapshot = item
            break

    if not snapshot:
        return None

    action = action.lower().strip()

    if action not in {"ignore", "snooze"}:
        raise ValueError("action must be 'ignore' or 'snooze'")

    expires_at = None

    if action == "snooze":
        if snooze_preset not in SNOOZE_PRESETS:
            raise ValueError(f"Unknown snooze preset: {snooze_preset}")

        expires_at = (utc_now() + SNOOZE_PRESETS[snooze_preset]).isoformat()

    rule = {
        "id": make_id("rule", state["rules"]),
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "enabled": True,
        "action": action,
        "source": snapshot.get("source"),
        "category": snapshot.get("category"),
        "pattern_key": snapshot.get("pattern_key"),
        "normalised_pattern": snapshot.get("normalised_pattern"),
        "contains_all": [],
        "contains_any": [],
        "excludes": [],
        "expires_at": expires_at,
        "snooze_preset": snooze_preset if action == "snooze" else None,
        "reason": reason or "",
        "created_from_snapshot_id": snapshot_id,
    }

    state["rules"].insert(0, rule)

    if action == "ignore":
        snapshot["status"] = "ignored"
    elif action == "snooze":
        snapshot["status"] = "snoozed"

    snapshot["updated_at"] = utc_now_iso()

    save_state(state, plugin_settings)
    return rule


def rule_is_active(rule: dict[str, Any], now: datetime | None = None) -> bool:
    if not rule.get("enabled", True):
        return False

    action = (rule.get("action") or "").lower()

    if action == "ignore":
        return True

    if action == "snooze":
        expires_at = parse_iso_datetime(rule.get("expires_at"))

        if not expires_at:
            return False

        now = now or utc_now()

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        return expires_at > now

    return False


def snapshot_matches_rule(snapshot: dict[str, Any], rule: dict[str, Any]) -> bool:
    if snapshot.get("source") != rule.get("source"):
        return False

    if snapshot.get("category") != rule.get("category"):
        return False

    if rule.get("pattern_key") and snapshot.get("pattern_key") == rule.get("pattern_key"):
        return True

    text = (snapshot.get("normalised_pattern") or "").lower()

    contains_all = [x.lower() for x in rule.get("contains_all", []) if x]
    contains_any = [x.lower() for x in rule.get("contains_any", []) if x]
    excludes = [x.lower() for x in rule.get("excludes", []) if x]

    if any(term in text for term in excludes):
        return False

    if contains_all and not all(term in text for term in contains_all):
        return False

    if contains_any and not any(term in text for term in contains_any):
        return False

    return bool(contains_all or contains_any)

def create_rule_from_pattern(
    snapshot: dict,
    action: str,
    plugin_settings: dict | None = None,
    snooze_preset: str | None = None,
    reason: str | None = None,
):
    state = load_state(plugin_settings)

    action = action.lower().strip()

    if action not in {"ignore", "snooze"}:
        raise ValueError("action must be 'ignore' or 'snooze'")

    expires_at = None

    if action == "snooze":
        if snooze_preset not in SNOOZE_PRESETS:
            raise ValueError(f"Unknown snooze preset: {snooze_preset}")

        expires_at = (utc_now() + SNOOZE_PRESETS[snooze_preset]).isoformat()

    rule = {
        "id": make_id("rule", state.get("rules", [])),
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "enabled": True,
        "action": action,
        "source": snapshot.get("source"),
        "category": snapshot.get("category"),
        "pattern_key": snapshot.get("pattern_key"),
        "normalised_pattern": snapshot.get("normalised_pattern"),
        "contains_all": [],
        "contains_any": [],
        "excludes": [],
        "expires_at": expires_at,
        "snooze_preset": snooze_preset if action == "snooze" else None,
        "reason": reason or "",
        "created_from_snapshot_id": snapshot.get("id"),
    }

    state.setdefault("rules", []).insert(0, rule)
    save_state(state, plugin_settings)

    return rule

def filter_suppressed_snapshots(
    snapshots: list[dict[str, Any]],
    plugin_settings: dict | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Split snapshots into visible and suppressed based on active rules.

    Returns:
        (visible_snapshots, suppressed_snapshots)
    """
    state = load_state(plugin_settings)
    active_rules = [r for r in state.get("rules", []) if rule_is_active(r)]

    visible = []
    suppressed = []

    for snapshot in snapshots:
        matched_rule = next(
            (rule for rule in active_rules if snapshot_matches_rule(snapshot, rule)),
            None,
        )

        if matched_rule:
            suppressed.append({
                **snapshot,
                "suppressed_by_rule_id": matched_rule.get("id"),
                "suppressed_action": matched_rule.get("action"),
            })
        else:
            visible.append(snapshot)

    return visible, suppressed


def delete_rule(
    rule_id: str,
    plugin_settings: dict | None = None,
) -> bool:
    state = load_state(plugin_settings)

    before = len(state.get("rules", []))
    state["rules"] = [
        rule for rule in state.get("rules", [])
        if rule.get("id") != rule_id
    ]

    changed = len(state["rules"]) != before

    if changed:
        save_state(state, plugin_settings)

    return changed


def list_rules(
    action: str | None = None,
    include_inactive: bool = True,
    plugin_settings: dict | None = None,
) -> list[dict[str, Any]]:
    state = load_state(plugin_settings)
    rules = state.get("rules", [])

    if action:
        action = action.lower()
        rules = [r for r in rules if r.get("action") == action]

    if not include_inactive:
        rules = [r for r in rules if rule_is_active(r)]

    return rules