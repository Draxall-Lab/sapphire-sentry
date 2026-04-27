// Sapphire Sentry - app/index.js

let appContainer = null;
let lastSnapshots = [];
let currentGroupMode = "frequency";
let lastHistoryGroups = [];
let openHistoryGroups = new Set();

export function render(container) {
  appContainer = container;

  container.innerHTML = `
    <div class="sentry-app">
      <style>
        .sentry-app {
          padding: 18px;
          max-width: 1100px;
          margin: 0 auto;
        }

        .sentry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 18px;
        }

        .sentry-title h1 {
          margin: 0;
          font-size: 1.6rem;
        }

        .sentry-title p {
          margin: 4px 0 0;
          color: var(--text-muted, #888);
        }

        .sentry-controls {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .sentry-select-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sentry-control-label {
          color: var(--text-muted, #888);
          font-size: 0.9rem;
        }

        .sentry-btn,
        .sentry-select {
          border: 1px solid var(--border, #333);
          border-radius: 8px;
          padding: 8px 12px;
          background: var(--button-bg, #222);
          color: var(--text, #eee);
          cursor: pointer;
        }

        .sentry-btn.primary {
          background: var(--accent, #2d7dff);
          color: white;
          border-color: transparent;
        }

        .sentry-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sentry-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .sentry-stat {
          border: 1px solid var(--border, #333);
          border-radius: 12px;
          padding: 12px;
          background: var(--surface, rgba(255,255,255,0.04));
        }

        .sentry-stat-value {
          font-size: 1.4rem;
          font-weight: 700;
        }

        .sentry-stat-label {
          color: var(--text-muted, #888);
          font-size: 0.85rem;
        }

        .sentry-section-title {
          margin: 18px 0 10px;
          font-size: 1.1rem;
        }

        .sentry-group-title {
          margin: 18px 0 10px;
          font-size: 1rem;
          color: var(--text, #eee);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sentry-group-count {
          color: var(--text-muted, #888);
          font-size: 0.85rem;
          font-weight: 400;
        }

        .sentry-card-list {
          display: grid;
          gap: 12px;
        }

        .sentry-group {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
        }

        .sentry-card {
          border: 1px solid var(--border, #333);
          border-radius: 14px;
          padding: 14px;
          background: var(--surface, rgba(255,255,255,0.04));
        }

        .sentry-card-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .sentry-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Snapshot group container */
        .sentry-history-group {
          border: 1px solid var(--border, #333);
          border-radius: 14px;
          background: var(--surface, rgba(255,255,255,0.03));
          margin-bottom: 12px;
          overflow: hidden;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        /* Hover effect */
          .sentry-history-group:hover {
          border-color: var(--accent, #2d7dff);
        }

        /* Header button */
        .sentry-history-header {
          width: 100%;
          border: 0;
          background: transparent;
          color: var(--text, #eee);
          padding: 12px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          text-align: left;
          font-size: 0.95rem;
        }

        /* Subtle hover */
        .sentry-history-header:hover {
          background: rgba(255,255,255,0.04);
        }

        /* Left side (title + arrow) */
        .sentry-history-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        /* Right side meta */
        .sentry-history-meta {
          color: var(--text-muted, #888);
          font-size: 0.8rem;
        }

        /* Expand/collapse icon */
        .sentry-history-title::before {
          content: "▶";
          font-size: 0.7rem;
          opacity: 0.7;
          transition: transform 0.2s ease;
        }

        /* When open */
        .sentry-history-group.open .sentry-history-title::before {
          transform: rotate(90deg);
        }

        /* Body */
        .sentry-history-body {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-top: 1px solid var(--border, #333);
          background: rgba(255,255,255,0.02);
        }

        .sentry-history-body[hidden] {
          display: none;
        }

        /* Optional: make history cards slightly quieter */
        .sentry-history-body .sentry-card {
          opacity: 0.9;
        }

        .sentry-tag {
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 0.78rem;
          border: 1px solid var(--border, #333);
          color: var(--text-muted, #aaa);
        }

        .sentry-tag.warning {
          color: #ffd166;
        }

        .sentry-tag.error {
          color: #ff6b6b;
        }

        .sentry-tag.critical {
          color: #ff4d4d;
        }

        .sentry-tag.source-sapphire {
          background: rgba(45, 125, 255, 0.12);
          border-color: rgba(45, 125, 255, 0.25);
          color: #7fb0ff;
        }

        .sentry-tag.source-kokoro {
          background: rgba(255, 107, 107, 0.12);
          border-color: rgba(255, 107, 107, 0.25);
          color: #ff9a9a;
        }

        .sentry-tag.source-story {
          background: rgba(150, 120, 255, 0.12);
          border-color: rgba(150, 120, 255, 0.25);
          color: #b9aaff;
        }

        .sentry-tag.source-startup {
          background: rgba(80, 200, 120, 0.12);
          border-color: rgba(80, 200, 120, 0.25);
          color: #8be0a5;
        }

        .sentry-count {
          font-weight: 700;
          color: var(--accent, #2d7dff);
        }

        .sentry-pattern {
          font-size: 0.98rem;
          line-height: 1.4;
          margin: 8px 0 12px;
        }

        .sentry-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sentry-empty,
        .sentry-status {
          color: var(--text-muted, #888);
          padding: 12px 0;
        }
      </style>

      <div class="sentry-header">
        <div class="sentry-title">
          <h1>🛡️ Sapphire Sentry</h1>
          <p>Incident snapshots and noise filtering for Sapphire logs.</p>
        </div>

        <div class="sentry-controls">
          <button id="sentry-scan-btn" class="sentry-btn primary">Run Scan</button>

          <div class="sentry-select-wrap">
            <label class="sentry-control-label" for="sentry-group-mode">View by</label>
            <select id="sentry-group-mode" class="sentry-select">
              <option value="frequency">Frequency</option>
              <option value="category">Category</option>
              <option value="source">Source</option>
            </select>
         </div>
        </div>
      </div>

      <div id="sentry-status" class="sentry-status">Ready.</div>

      <div class="sentry-summary">
        <div class="sentry-stat">
          <div id="sentry-stat-sources" class="sentry-stat-value">-</div>
          <div class="sentry-stat-label">Sources scanned</div>
        </div>
        <div class="sentry-stat">
          <div id="sentry-stat-visible" class="sentry-stat-value">-</div>
          <div class="sentry-stat-label">Visible incidents</div>
        </div>
        <div class="sentry-stat">
          <div id="sentry-stat-suppressed" class="sentry-stat-value">-</div>
          <div class="sentry-stat-label">Suppressed</div>
        </div>
        <div class="sentry-stat">
          <div id="sentry-stat-rules" class="sentry-stat-value">-</div>
          <div class="sentry-stat-label">Stored rules</div>
        </div>
      </div>

      <h2 class="sentry-section-title">Active Incidents</h2>
      <div id="sentry-results" class="sentry-card-list">
        <div class="sentry-empty">Run a scan to see incident snapshots.</div>
      </div>
      <h2 class="sentry-section-title">Snapshot History</h2>
      <div id="sentry-history" class="sentry-card-list">
        <div class="sentry-empty">Loading history...</div>
      </div>

      <h2 class="sentry-section-title">Suppressed Rules</h2>
      <div id="sentry-rules" class="sentry-card-list">
        <div class="sentry-empty">Loading rules...</div>
      </div>
    </div>
  `;

  appContainer
    .querySelector("#sentry-scan-btn")
    .addEventListener("click", runScan);

  appContainer
    .querySelector("#sentry-group-mode")
    .addEventListener("change", (event) => {
      currentGroupMode = event.target.value;
      renderSnapshots(lastSnapshots);
      renderHistory(lastHistoryGroups);
    });

  loadSnapshotHistory();
  loadRules();
}

export function cleanup() {
  openHistoryGroups = new Set();
  appContainer = null;
  lastSnapshots = [];
  currentGroupMode = "frequency";
}

async function runScan() {
  const statusEl = appContainer.querySelector("#sentry-status");
  const resultsEl = appContainer.querySelector("#sentry-results");
  const scanBtn = appContainer.querySelector("#sentry-scan-btn");

  statusEl.textContent = "Scanning...";
  resultsEl.innerHTML = "";
  scanBtn.disabled = true;

  try {
    const csrfToken = document.querySelector("meta[name='csrf-token']")?.content;

    const res = await fetch("/api/plugin/sapphire-sentry/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
      },
      body: JSON.stringify({})
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();

    lastSnapshots = Array.isArray(data.snapshots) ? data.snapshots : [];

    renderSummary(data.summary || {});
    renderSnapshots(lastSnapshots);

    statusEl.textContent = `Scan complete: ${data.scan_id || "unknown scan"}`;
  } catch (err) {
    statusEl.textContent = "Error running scan.";
    console.error(err);
  } finally {
    scanBtn.disabled = false;
  }

  await loadSnapshotHistory();
  await loadRules();
}

function renderSummary(summary) {
  appContainer.querySelector("#sentry-stat-sources").textContent =
    summary.sources_scanned ?? 0;

  appContainer.querySelector("#sentry-stat-visible").textContent =
    summary.visible_snapshots ?? 0;

  appContainer.querySelector("#sentry-stat-suppressed").textContent =
    summary.suppressed_snapshots ?? 0;

  appContainer.querySelector("#sentry-stat-rules").textContent =
    summary.stored_rules ?? 0;
}


function renderSnapshots(snapshots) {
  const resultsEl = appContainer.querySelector("#sentry-results");

  if (!snapshots.length) {
    resultsEl.innerHTML = `<div class="sentry-empty">No active incidents found.</div>`;
    return;
  }

  resultsEl.innerHTML = "";

  if (currentGroupMode === "category") {
    renderGroupedSnapshots(resultsEl, snapshots, "category");
    return;
  }

  if (currentGroupMode === "source") {
    renderGroupedSnapshots(resultsEl, snapshots, "source");
    return;
  }

  renderFlatSnapshots(resultsEl, snapshots);
}

function renderFlatSnapshots(container, snapshots) {
  const sorted = sortByFrequency(snapshots);

  for (const snap of sorted) {
    container.appendChild(createSnapshotCard(snap));
  }
}

function renderGroupedSnapshots(container, snapshots, key) {
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
      groupEl.appendChild(createSnapshotCard(snap));
    }

    container.appendChild(heading);
    container.appendChild(groupEl);
  }
}

function createSnapshotCard(snap) {
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
      <button class="sentry-btn sentry-ignore-btn" type="button" data-snapshot-id="${escapeHtml(snap.id || "")}">
        Ignore
      </button>
      <button class="sentry-btn" disabled>Snooze</button>
    </div>
  `;

  
   
const ignoreBtn = card.querySelector(".sentry-ignore-btn");

if (ignoreBtn) {
  ignoreBtn.addEventListener("click", () => {
    ignoreSnapshot(snap);
  });
}

  return card;
}

async function ignoreSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  const statusEl = appContainer.querySelector("#sentry-status");

  try {
    statusEl.textContent = "Creating ignore rule...";

    const csrfToken = document.querySelector("meta[name='csrf-token']")?.content;

    const res = await fetch("/api/plugin/sapphire-sentry/rules/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
      },
      body: JSON.stringify({
        snapshot_id: snapshot.id || null,
        snapshot: {
          id: snapshot.id || null,
          source: snapshot.source,
          category: snapshot.category,
          pattern_key: snapshot.pattern_key,
          normalised_pattern: snapshot.normalised_pattern
        },
        action: "ignore",
        reason: "Ignored from Sentry UI"
      })
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Failed to create rule");
    }

    statusEl.textContent = "Ignore rule created.";

    await runScan();
    await loadRules();
    await loadSnapshotHistory();
  } catch (err) {
    statusEl.textContent = "Failed to create ignore rule.";
    console.error(err);
  }
}

function sortByFrequency(snapshots) {
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

function sortHistoryItems(items) {
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

function groupSnapshots(snapshots, key) {
  return snapshots.reduce((groups, snap) => {
    const value = snap[key] || "unknown";

    if (!groups[value]) {
      groups[value] = [];
    }

    groups[value].push(snap);
    return groups;
  }, {});
}

function totalCount(snapshots) {
  return snapshots.reduce((total, snap) => total + (snap.count ?? 0), 0);
}

function formatGroupTitle(value) {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadSnapshotHistory() {
  const el = appContainer.querySelector("#sentry-history");

  try {
    const res = await fetch("/api/plugin/sapphire-sentry/snapshot-groups");

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();

    lastHistoryGroups = data.snapshot_groups || [];
    renderHistory(lastHistoryGroups);
  } catch (err) {
    el.innerHTML = `<div class="sentry-empty">Failed to load history</div>`;
    console.error(err);
  }
}

async function loadRules() {
  const el = appContainer.querySelector("#sentry-rules");

  try {
    const res = await fetch("/api/plugin/sapphire-sentry/rules");
    const data = await res.json();

    renderRules(data.rules || []);
  } catch (err) {
    el.innerHTML = `<div class="sentry-empty">Failed to load rules</div>`;
    console.error(err);
  }
}

function renderHistory(groups) {
  const el = appContainer.querySelector("#sentry-history");

  if (!groups.length) {
    el.innerHTML = `<div class="sentry-empty">No history yet</div>`;
    return;
  }

  el.innerHTML = "";

  for (const group of groups) {
    const wrapper = document.createElement("div");
    wrapper.className = "sentry-history-group";

    const header = document.createElement("button");
    header.className = "sentry-history-header";
    header.type = "button";

    const scanId = group.scan_id || "unknown";
    const itemCount = group.item_count ?? 0;
    const totalCount = group.total_count ?? 0;

    header.innerHTML = `
      <span class="sentry-history-title">Snapshot ${escapeHtml(scanId)}</span>
      <span class="sentry-history-meta">
        ${itemCount} item${itemCount === 1 ? "" : "s"} · x${totalCount}
      </span>
    `;

    const isOpen = openHistoryGroups.has(scanId);
    
    const body = document.createElement("div");
    body.className = "sentry-history-body";
    
    body.hidden = !isOpen;
    wrapper.classList.toggle("open", isOpen);

    const sortedItems = sortHistoryItems(group.items || []);

    for (const snap of sortedItems) {
      body.appendChild(createSnapshotCard(snap));
    }

    header.addEventListener("click", () => {
    const willOpen = body.hidden;

    body.hidden = !willOpen;
    wrapper.classList.toggle("open", willOpen);

    if (willOpen) {
      openHistoryGroups.add(scanId);
    } else {
      openHistoryGroups.delete(scanId);
    }
});

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    el.appendChild(wrapper);
  }
}

function renderRules(rules) {
  const el = appContainer.querySelector("#sentry-rules");

  if (!rules.length) {
    el.innerHTML = `<div class="sentry-empty">No rules yet</div>`;
    return;
  }

el.innerHTML = rules.map(r => `
  <div class="sentry-card">
    ${r.category}:${r.source} — ${r.normalised_pattern}
    
    <div>
      ${r.action === "ignore" ? "Ignored" : "Snoozed"}
    </div>

    <button 
      class="sentry-btn ss-rule-restore" 
      type="button"
      data-rule-id="${r.id}"
   >
     Restore
   </button>
  </div>
`).join("");

  el.querySelectorAll(".ss-rule-restore").forEach(btn => {
    btn.addEventListener("click", async () => {
      const ruleId = btn.dataset.ruleId;
      console.log("[SENTRY] Restore clicked:", ruleId);

      if (!ruleId) return;

      btn.disabled = true;
      btn.textContent = "Restoring...";

      try {
        await restoreRule(ruleId);
      } catch (err) {
        console.error("[SENTRY] Restore button handler failed", err);
        btn.disabled = false;
        btn.textContent = "Restore";
     }
    });
  });
}

async function restoreRule(ruleId) {
  const statusEl = appContainer.querySelector("#sentry-status");

  try {
    statusEl.textContent = "Restoring rule...";

    const csrfToken = document.querySelector("meta[name='csrf-token']")?.content;

    const res = await fetch(`/api/plugin/sapphire-sentry/rules/${ruleId}`, {
      method: "DELETE",
      headers: {
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
      }
    });

    console.log("[SENTRY] Restore response:", res.status);

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();
    console.log("[SENTRY] Restore data:", data);

    if (!data.ok) {
      throw new Error(data.error || "Rule was not restored");
    }

    statusEl.textContent = "Rule restored.";

    await runScan();
    await loadRules();
    await loadSnapshotHistory();
  } catch (err) {
    statusEl.textContent = "Failed to restore rule.";
    console.error("[SENTRY] Failed to restore rule", err);
    throw err;
  }
}