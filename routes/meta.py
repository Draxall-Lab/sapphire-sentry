from __future__ import annotations

import json
from pathlib import Path


def get_meta(body=None, settings=None, **kwargs):
    plugin_root = Path(__file__).resolve().parents[1]
    plugin_json = plugin_root / "plugin.json"

    try:
        data = json.loads(plugin_json.read_text(encoding="utf-8"))
    except Exception:
        data = {}

    return {
        "ok": True,
        "name": data.get("name", "sapphire-sentry"),
        "version": data.get("version"),
        "display_name": data.get("display_name", "Sapphire Sentry"),
    }