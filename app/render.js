import {
  escapeHtml,
  formatGroupTitle,
  groupSnapshots,
  sortByFrequency,
  totalCount
} from "./utils.js";

export function renderSummary(appContainer, summary) {
  appContainer.querySelector("#sentry-stat-sources").textContent =
    summary.sources_scanned ?? 0;

  appContainer.querySelector("#sentry-stat-visible").textContent =
    summary.visible_snapshots ?? 0;

  appContainer.querySelector("#sentry-stat-suppressed").textContent =
    summary.suppressed_snapshots ?? 0;

  appContainer.querySelector("#sentry-stat-rules").textContent =
    summary.stored_rules ?? 0;
}

export function renderSnapshots(appContainer, snapshots, currentGroupMode, onIgnoreSnapshot) {
  const resultsEl = appContainer.querySelector("#sentry-results");

  if (!snapshots.length) {
    resultsEl.innerHTML = `<div class="sentry-empty">No active incidents found.</div>`;
    return;
  }

  resultsEl.innerHTML = "";

  if (currentGroupMode === "category") {
    renderGroupedSnapshots(resultsEl, snapshots, "category", onIgnoreSnapshot);
    return;
  }

  if (currentGroupMode === "source") {
    renderGroupedSnapshots(resultsEl, snapshots, "source", onIgnoreSnapshot);
    return;
  }

  renderFlatSnapshots(resultsEl, snapshots, onIgnoreSnapshot);
}

export function renderFlatSnapshots(container, snapshots, onIgnoreSnapshot) {
  const sorted = sortByFrequency(snapshots);

  for (const snap of sorted) {
    container.appendChild(createSnapshotCard(snap, onIgnoreSnapshot));
  }
}

export function renderGroupedSnapshots(container, snapshots, key, onIgnoreSnapshot){
  const groups = groupSnapshots(snapshots, key);

  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
    const aTotal = totalCount(groups[a]);
    const bTotal = totalCount(groups[b]);

    if (bTotal !== aTotal) {
      return bTotal - aTotal;
    }

    return a.localeCompare(b);
  });

  for (const groupName of sortedGroupNames) {
    const groupItems = sortByFrequency(groups[groupName]);

    const heading = document.createElement("h3");
    heading.className = "sentry-group-title";
    heading.innerHTML = `
      ${escapeHtml(formatGroupTitle(groupName))}
      <span class="sentry-group-count">
        ${groupItems.length} pattern${groupItems.length === 1 ? "" : "s"},
        x${totalCount(groupItems)} total
      </span>
    `;

    const groupEl = document.createElement("div");
    groupEl.className = "sentry-group";

    for (const snap of groupItems) {
      groupEl.appendChild(createSnapshotCard(snap, onIgnoreSnapshot));
    }

    container.appendChild(heading);
    container.appendChild(groupEl);
  }
}

export function createSnapshotCard(snap, onIgnoreSnapshot) {
  const card = document.createElement("div");
  card.className = "sentry-card";

  const category = snap.category || "unknown";
  const source = snap.source || "unknown";
  const count = snap.count ?? 1;
  const sourceClass = `source-${(source || "unknown").toLowerCase()}`;

  card.innerHTML = `
    <div class="sentry-card-top">
      <div class="sentry-tags">
        <span class="sentry-tag ${escapeHtml(category)}">${escapeHtml(category.toUpperCase())}</span>
        <span class="sentry-tag ${sourceClass}">
          ${escapeHtml(source)}
        </span>
      </div>
      <div class="sentry-count">x${escapeHtml(String(count))}</div>
    </div>

    <div class="sentry-pattern">
      ${escapeHtml(snap.normalised_pattern || "No pattern available")}
    </div>

    <div class="sentry-actions">
      <button class="sentry-btn" disabled>Analyse</button>
      <button 
        class="sentry-btn sentry-ignore-btn" 
        type="button"
        data-ignore="1"
        data-pattern-key="${snap.pattern_key || ""}"
      >
        Ignore
      </button>
      
      <button 
        class="sentry-btn sentry-snooze-btn"
        data-sentry-action="snooze-menu"
        data-pattern-key="${snap.pattern_key}"
      >
        Snooze
      </button>
    </div>
  `;

  return card;
}