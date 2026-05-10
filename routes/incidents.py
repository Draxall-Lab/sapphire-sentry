"""
routes/incidents.py

Thin route handlers for Sapphire Sentry stored data:
- snapshot history
- ignore/snooze rules
- rule creation/deletion
"""

from __future__ import annotations

import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]

if str(PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT))

from sentry_core.storage import (
    create_rule_from_pattern,
    create_rule_from_snapshot,
    delete_rule,
    list_rules,
    list_snapshots,
    list_snapshot_groups,
)


def get_snapshots(body=None, settings=None, **kwargs):
    settings = settings or {}
    snapshots = list_snapshots(plugin_settings=settings)

    return {
        "ok": True,
        "snapshots": snapshots,
        "count": len(snapshots),
    }


def get_snapshot_groups(body=None, settings=None, **kwargs):
    settings = settings or {}
    groups = list_snapshot_groups(plugin_settings=settings)

    return {
        "ok": True,
        "snapshot_groups": groups,
        "count": len(groups),
    }


def get_rules(body=None, settings=None, **kwargs):
    settings = settings or {}
    rules = list_rules(plugin_settings=settings)

    return {
        "ok": True,
        "rules": rules,
        "count": len(rules),
    }


def create_rule(body=None, settings=None, **kwargs):
    settings = settings or {}
    body = body or {}

    snapshot_id = body.get("snapshot_id")
    snapshot_payload = body.get("snapshot") or {}
    action = body.get("action")
    snooze_preset = body.get("snooze_preset")
    reason = body.get("reason")

    if not action or (not snapshot_id and not snapshot_payload):
        return {
            "ok": False,
            "error": "Missing snapshot_id/snapshot or action",
        }

    rule = None

    try:
        if snapshot_id:
            rule = create_rule_from_snapshot(
                snapshot_id=snapshot_id,
                action=action,
                plugin_settings=settings,
                snooze_preset=snooze_preset,
                reason=reason,
            )

        if not rule and snapshot_payload:
            rule = create_rule_from_pattern(
                snapshot=snapshot_payload,
                action=action,
                plugin_settings=settings,
                snooze_preset=snooze_preset,
                reason=reason,
            )

    except ValueError as err:
        return {
            "ok": False,
            "error": str(err),
        }

    if not rule:
        return {
            "ok": False,
            "error": "Snapshot not found and no snapshot payload provided",
        }

    return {
        "ok": True,
        "rule": rule,
    }


def remove_rule(body=None, settings=None, **kwargs):
    settings = settings or {}
    body = body or {}

    rule_id = body.get("rule_id")

    if not rule_id:
        return {
            "ok": False,
            "error": "Missing rule_id",
        }

    deleted = delete_rule(rule_id, plugin_settings=settings)

    return {
        "ok": deleted,
        "deleted": deleted,
        "rule_id": rule_id,
    }

def delete_rule_route(rule_id=None, settings=None, **kwargs):
    if not rule_id:
        return {
            "ok": False,
            "error": "Missing rule_id",
        }

    deleted = delete_rule(rule_id, plugin_settings=settings or {})

    return {
        "ok": bool(deleted),
        "rule_id": rule_id,
    }