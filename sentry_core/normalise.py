"""
normalise.py

Utilities for turning noisy log lines into stable pattern text.

Goal:
- remove timestamps, paths, IDs, counters, and other volatile fragments
- keep enough readable text to group similar incidents together
"""

from __future__ import annotations

import re


_TIMESTAMP_PATTERNS = [
    # 2026-04-25 14:32:10,123 or 2026-04-25T14:32:10Z
    re.compile(r"\b\d{4}-\d{2}-\d{2}[ t]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:z|[+-]\d{2}:?\d{2})?\b", re.I),

    # [2026-04-25 14:32:10]
    re.compile(r"^\s*\[\d{4}-\d{2}-\d{2}[^\]]+\]\s*"),

    # 14:32:10
    re.compile(r"\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b"),
]

_LOG_PREFIX_PATTERNS = [
    # [WARNING] message
    re.compile(r"^\s*\[(debug|info|warning|warn|error|critical)\]\s*", re.I),

    # WARNING: message / ERROR - message
    re.compile(r"^\s*(debug|info|warning|warn|error|critical)\s*[:\-|]\s*", re.I),

    # logger.name - WARNING - message
    re.compile(r"^\s*[\w.\-]+\s*[:\-|]\s*(debug|info|warning|warn|error|critical)\s*[:\-|]\s*", re.I),
]

_VOLATILE_PATTERNS = [
    # Windows paths
    re.compile(r"\b[a-z]:\\[^\s]+", re.I),

    # Unix-ish absolute paths
    re.compile(r"(?<!\w)/(?:[\w.\-]+/)+[\w.\-]+"),

    # URLs
    re.compile(r"https?://[^\s]+", re.I),

    # UUIDs
    re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I),

    # Hex addresses / hashes
    re.compile(r"\b0x[0-9a-f]+\b", re.I),
    re.compile(r"\b[0-9a-f]{16,}\b", re.I),

    # Long numeric IDs
    re.compile(r"\b\d{5,}\b"),

    # Retry/counter style fragments
    re.compile(r"\bretry\s+\d+\b", re.I),
    re.compile(r"\battempt\s+\d+\b", re.I),
    re.compile(r"\b\d+\s*(ms|s|sec|secs|seconds|kb|mb|gb|bytes)\b", re.I),
]

_PYTHON_WARNING_PREFIX = re.compile(
    r"^\s*.*?\.py:\d+:\s*(?P<warn_type>\w*Warning):\s*",
    re.I,
)

_STRUCTURED_LOG_PREFIX = re.compile(
    r"^\s*[-\s]*[\w.]+(?:\.[\w.]+)*\s*[-:]\s*(debug|info|warning|warn|error|critical)\s*[-:]\s*",
    re.I,
)

def normalise_line(line: str) -> str:
    """
    Convert a raw log line into stable pattern text.

    This is intentionally conservative. It should group obviously similar
    incidents without destroying the meaning of the message.
    """
    if not line:
        return ""

    text = str(line).strip().lower()

    # Strip Python warning path prefixes, while preserving warning type.
    # Example:
    # E:\...\rnn.py:990: UserWarning: dropout option...
    # -> userwarning dropout option...
    text = _PYTHON_WARNING_PREFIX.sub(r"\g<warn_type> ", text)

    for pattern in _TIMESTAMP_PATTERNS:
        text = pattern.sub(" ", text)

    text = _STRUCTURED_LOG_PREFIX.sub(" ", text)

    for pattern in _LOG_PREFIX_PATTERNS:
        text = pattern.sub(" ", text)

    for pattern in _VOLATILE_PATTERNS:
        text = pattern.sub(" ", text)

    # Remove common bracket noise while keeping useful message words.
    text = re.sub(r"[\[\]{}()<>\"'`]", " ", text)

    # Replace separators with spaces.
    text = re.sub(r"[|,:;=]+", " ", text)

    # Collapse repeated punctuation/noise.
    text = re.sub(r"[-_]{2,}", " ", text)

    # Collapse remaining standalone numbers.
    text = re.sub(r"\b\d+\b", " ", text)

    # Remove leftover repeated log-level words/prefixes.
    text = re.sub(r"^(?:[-\s]*(?:debug|info|warning|warn|error|critical)[-\s]*)+", " ", text, flags=re.I)

    # Normalise whitespace.
    text = re.sub(r"\s+", " ", text).strip()

    return text


def make_pattern_key(source: str, category: str, normalised_text: str) -> str:
    """
    Build the stable grouping key used by snapshots and rules.
    """
    source_part = (source or "unknown").strip().lower()
    category_part = (category or "unknown").strip().lower()
    text_part = (normalised_text or "").strip().lower()

    return f"{category_part}:{source_part}:{text_part}"


def extract_keywords(normalised_text: str, max_words: int = 8) -> list[str]:
    """
    Extract simple keywords for rule suggestions such as contains_all.

    This is deliberately basic for v0.1.
    """
    stop_words = {
        "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
        "has", "have", "in", "is", "it", "of", "on", "or", "the", "to",
        "was", "were", "with",
    }

    words = [
        word
        for word in re.findall(r"\b[a-z][a-z0-9_-]{2,}\b", normalised_text.lower())
        if word not in stop_words
    ]

    seen = set()
    unique = []

    for word in words:
        if word not in seen:
            unique.append(word)
            seen.add(word)

        if len(unique) >= max_words:
            break

    return unique