export function sortByFrequency(snapshots) {
  return [...snapshots].sort((a, b) => {
    const countDiff = (b.count ?? 0) - (a.count ?? 0);

    if (countDiff !== 0) {
      return countDiff;
    }

    const sourceA = a.source || "";
    const sourceB = b.source || "";

    if (sourceA !== sourceB) {
      return sourceA.localeCompare(sourceB);
    }

    return (a.normalised_pattern || "").localeCompare(b.normalised_pattern || "");
  });
}

export function sortHistoryItems(items, currentGroupMode) {
  const safeItems = Array.isArray(items) ? items : [];

  if (currentGroupMode === "category") {
    return [...safeItems].sort((a, b) =>
      (a.category || "").localeCompare(b.category || "") ||
      (b.count ?? 0) - (a.count ?? 0)
    );
  }

  if (currentGroupMode === "source") {
    return [...safeItems].sort((a, b) =>
      (a.source || "").localeCompare(b.source || "") ||
      (b.count ?? 0) - (a.count ?? 0)
    );
  }

  return sortByFrequency(safeItems);
}

export function groupSnapshots(snapshots, key) {
  return snapshots.reduce((groups, snap) => {
    const value = snap[key] || "unknown";

    if (!groups[value]) {
      groups[value] = [];
    }

    groups[value].push(snap);
    return groups;
  }, {});
}

export function totalCount(snapshots) {
  return snapshots.reduce((total, snap) => total + (snap.count ?? 0), 0);
}

export function formatGroupTitle(value) {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

