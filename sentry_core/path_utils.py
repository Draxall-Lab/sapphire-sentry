from pathlib import Path


def get_sapphire_root(plugin_settings=None) -> Path:
    """
    Resolve Sapphire root directory.

    Priority:
    1. plugin setting override
    2. walk up from current directory to find Sapphire root
    3. fallback to current working directory
    """

    # 1. Plugin override
    if plugin_settings:
        custom = plugin_settings.get("sapphire_root")
        if custom:
            try:
                return Path(custom).expanduser().resolve()
            except Exception:
                pass

    # 2. Walk up from cwd
    current = Path.cwd().resolve()
    for parent in [current] + list(current.parents):
        # adjust this marker if needed
        if (parent / "plugins").exists():
            return parent

    # 3. Fallback
    return current