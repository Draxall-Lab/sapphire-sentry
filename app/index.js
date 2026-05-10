// Sapphire Sentry - app/index.js
import {
  escapeHtml,
  formatGroupTitle,
  groupSnapshots,
  sortByFrequency,
  sortHistoryItems,
  totalCount,
} from "./utils.js";

import {
  runScanRequest,
  loadSnapshotGroupsRequest,
  loadRulesRequest,
  createIgnoreRuleRequest,
  deleteRuleRequest,
  createSnoozeRuleRequest,
  getPluginsRequest,
} from "./api.js";

import {
  renderSummary,
  renderSnapshots,
  createSnapshotCard
} from "./render.js";

import { 
  wireEvents,
  is429Error,
  startRateLimitCooldown
} from "./events.js";

import { versionAtLeast } from "./utils.js";

import { handoffToLogDoctor } from "./logDoctorHandoff.js";

import {
  setInstalledVersion,
  setLatestVersion,
  isUpdateAvailable,
  pluginVersionLabel
} from "./version.js";

let pendingRefreshTimer = null;

let logDoctorAvailability = {
  available: false,
  reason: "Checking Log Doctor..."
};

const LOG_DOCTOR_MIN_VERSION = "0.5.0";

async function initVersionAwareness() {
  try {
    const meta = await loadPluginMeta();
    setInstalledVersion(meta?.version || null);
  } catch (err) {}

  try {
    const update = await checkPluginUpdate();
    setLatestVersion(update?.remote_version || null);
  } catch (err) {}

  updateHeaderStatus();
}

function updateHeaderStatus() {
  const statusEl = appContainer.querySelector("#sentry-subtitle");
  if (!statusEl) return;

  let html = `Incident snapshots and noise filtering for Sapphire logs.`;

  if (isUpdateAvailable()) {
    html += ` • <span class="sentry-update">v${getLatestVersion()} Update Available</span>`;
  }

  statusEl.innerHTML = html;
}

async function checkLogDoctorAvailability() {
  try {
    const data = await getPluginsRequest();
    const plugins = Array.isArray(data.plugins) ? data.plugins : [];

    const logDoctor = plugins.find((plugin) =>
      plugin.name === "log-doctor" ||
      plugin.display_name === "Log Doctor"
    );

    if (!logDoctor) {
      return {
        available: false,
        reason: "Install Log Doctor to analyse incidents."
      };
    }

    if (!logDoctor.enabled) {
      return {
        available: false,
        reason: "Enable Log Doctor to analyse incidents."
      };
    }

    const version = logDoctor.version || "";

    if (!versionAtLeast(version, LOG_DOCTOR_MIN_VERSION)) {
      return {
        available: false,
        reason: `Log Doctor v${LOG_DOCTOR_MIN_VERSION}+ required (current: ${version})`
      };
    }

    return {
      available: true,
      reason: "Open in Log Doctor"
    };

  } catch (err) {
    console.error("[SENTRY] Log Doctor check failed", err);

    return {
      available: false,
      reason: "Unable to check Log Doctor"
    };
  }
}

function scheduleRefreshAfterRateLimit() {
  clearTimeout(pendingRefreshTimer);

  const statusEl = appContainer.querySelector("#sentry-status");

  pendingRefreshTimer = setTimeout(async () => {
    try {
      if (statusEl) {
        statusEl.textContent = "Refreshing after cooldown...";
      }

      await runScan();

      if (statusEl) {
        statusEl.textContent = "Refreshed.";
      }
    } catch (err) {
      console.error("[SENTRY] Delayed refresh failed", err);

      if (statusEl) {
        statusEl.textContent = "Refresh failed after cooldown. Please refresh manually.";
      }
    }
  }, 60500); // RATE_LIMIT_COOLDOWN_MS + small buffer
}

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

        .sentry-update {
          color: var(--ld-accent-tertiary, #f59e0b);
          font-weight: 600;
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

        #sentry-history {
          margin-top: 1.5rem;
          opacity: 0.95;
        }
        
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
          margin-top: 0.5rem;
        }

        .sentry-empty,
        .sentry-status {
          color: var(--text-muted, #888);
          padding: 12px 0;
        }

        .sentry-status-help {
          margin-top: 0.75rem;
          color: #a8b3cf; /* softer than main text */
          opacity: 0.85;
          font-size: 0.85rem;
        }

        .sentry-status-help .help-intro {
           margin-bottom: 0.35rem;
        }

        .sentry-status-help ul {
          margin: 0;
          padding-left: 1.2rem;
        }

        .sentry-status-help li {
          margin: 0.2rem 0;
        }

        .sentry-status-help li::marker {
          color: var(--ld-accent-secondary); /* your blue accent */
        }

        .sentry-rule-card {
          opacity: 0.85;
          border-style: dashed;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sentry-rule-meta {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
          font-size: 0.9em;
          opacity: 0.85;
}

        .sentry-tag.rule-status {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.15);
          color: #aaa;
          font-style: italic;
        }

        .sentry-restore-btn {
          border-color: var(--accent, #2d7dff);
          color: var(--accent, #2d7dff);
        }

        .sentry-restore-btn:hover {
          background: rgba(45, 125, 255, 0.15);
        }
      </style>

      <div class="sentry-header">
        <div class="sentry-title">
          <h1>🛡️ Sapphire Sentry</h1>
          <p id="sentry-subtitle">Incident snapshots and noise filtering for Sapphire logs.</p>

          <div class="sentry-status-help">
            <p class="help-intro">Actions may briefly pause if used quickly:</p>
            <ul>
              <li><strong>“Please wait…”</strong> = processing</li>
              <li><strong>“Rate limited…”</strong> = cooling down</li>
            </ul>
          </div>
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
      
      <h2 class="sentry-section-title">Snoozed Rules</h2>
      <div id="sentry-snoozed-rules" class="sentry-card-list">
        <div class="sentry-empty">No snoozed rules.</div>
      </div>
      
      <h2 class="sentry-section-title">Suppressed Rules</h2>
      <div id="sentry-rules" class="sentry-card-list">
        <div class="sentry-empty">Loading rules...</div>
      </div>

      <h2 class="sentry-section-title">Snapshot History</h2>
      <div id="sentry-history" class="sentry-card-list">
        <div class="sentry-empty">Loading history...</div>
      </div>
    </div>
  `;

  function findSnapshotByPatternKey(patternKey) {
  const active = (lastSnapshots || []).find((s) => {
    const rawKey = s.pattern_key || s.patternKey;
    const compositeKey = `${s.category}:${s.source}:${s.normalised_pattern || s.normalisedPattern}`;

    return rawKey === patternKey || compositeKey === patternKey;
  });

  if (active) return active;

  for (const group of lastHistoryGroups || []) {
    const snapshots =
      group.snapshots ||
      group.items ||
      group.incidents ||
      group.entries ||
      [];

    const match = snapshots.find((s) => {
      const rawKey = s.pattern_key || s.patternKey;
      const compositeKey = `${s.category}:${s.source}:${s.normalised_pattern || s.normalisedPattern}`;

      return rawKey === patternKey || compositeKey === patternKey;
    });

    if (match) return match;
  }

  return null;
}

 wireEvents({
  appContainer,
  runScan,
  setGroupMode: (mode) => {
    currentGroupMode = mode;
  },
  rerenderSnapshots: () => {
    renderSnapshots(appContainer, lastSnapshots, currentGroupMode, ignoreSnapshot);
  },
  rerenderHistory: () => {
    renderHistory(lastHistoryGroups, logDoctorAvailability);
  },
  onIgnore: async (patternKey) => {
    const snap = lastSnapshots.find(s => s.pattern_key === patternKey);
    if (!snap) return;

    await ignoreSnapshot(snap);
  },
  onSnooze: async (patternKey, snoozePreset) => {
    const snap = lastSnapshots.find(s => s.pattern_key === patternKey);
    if (!snap) return;

    await snoozeSnapshot(snap, snoozePreset);
  },
  onAnalyse: (patternKey) => {
    const snap = findSnapshotByPatternKey(patternKey);

    if (!snap) {
    
      return;
    }

  handoffToLogDoctor(snap);
},
  onRestore: async (ruleId) => {
    await restoreRule(ruleId);
  },
});

  loadSnapshotHistory();
  loadRules();

  checkLogDoctorAvailability().then((availability) => {
  logDoctorAvailability = availability;

  renderSnapshots(
    appContainer,
    lastSnapshots,
    currentGroupMode,
    ignoreSnapshot,
    logDoctorAvailability
  );

  renderHistory(lastHistoryGroups, logDoctorAvailability);
});
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
    const data = await runScanRequest(csrfToken);

    lastSnapshots = Array.isArray(data.snapshots) ? data.snapshots : [];

    renderSummary(appContainer, data.summary || {});
    renderSnapshots(appContainer, lastSnapshots, currentGroupMode, ignoreSnapshot, logDoctorAvailability);

    statusEl.textContent = `Scan complete: ${data.scan_id || "unknown scan"}`;

try {
  await loadSnapshotHistory();
  await loadRules();
} catch (err) {
  if (is429Error(err)) {
    statusEl.textContent =
      "Rate limited while refreshing history/rules. Sentry will reload shortly.";

    startRateLimitCooldown();
    scheduleRefreshAfterRateLimit();
    return;
  }

  throw err;
}
  } catch (err) {
    statusEl.textContent = "Error running scan.";
    console.error(err);
  } finally {
    scanBtn.disabled = false;
  }


}

async function snoozeSnapshot(snapshot, snoozePreset) {
  if (!snapshot) {
    return;
  }

  const statusEl = appContainer.querySelector("#sentry-status");

  try {
    statusEl.textContent = `Snoozing for ${snoozePreset}...`;

    const csrfToken = document.querySelector("meta[name='csrf-token']")?.content;

    const data = await createSnoozeRuleRequest(snapshot, snoozePreset, csrfToken);

    if (!data.ok) {
      throw new Error(data.error || "Failed to create snooze rule");
    }

    statusEl.textContent = "Snooze rule created.";

    await runScan();
  } catch (err) {
    if (err.status === 429) {
      statusEl.textContent = "Rate limit hit. Cooling down for a few seconds.";
    } else {
      statusEl.textContent = "Failed to create snooze rule.";
    }

    console.error("[SENTRY] Failed to create snooze rule", err);
    throw err;
  }
}

async function ignoreSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  const statusEl = appContainer.querySelector("#sentry-status");

  try {
    statusEl.textContent = "Creating ignore rule...";

    const csrfToken = document.querySelector("meta[name='csrf-token']")?.content;

    const data = await createIgnoreRuleRequest(snapshot, csrfToken);

    if (!data.ok) {
      throw new Error(data.error || "Failed to create rule");
  }

    statusEl.textContent = "Ignore rule created.";

    await runScan();
  } catch (err) {
    if (err.status === 429) {
      statusEl.textContent = "Rate limit hit. Cooling down for a few seconds.";
    } else {
      statusEl.textContent = "Failed to create ignore rule.";
    }
     console.error("[SENTRY] Failed to create ignore rule", err);

    throw err;
  }
}

async function loadSnapshotHistory() {
  const el = appContainer.querySelector("#sentry-history");

  try {
    const data = await loadSnapshotGroupsRequest();

    lastHistoryGroups = data.snapshot_groups || [];
    renderHistory(lastHistoryGroups, logDoctorAvailability);
  } catch (err) {
    if (is429Error(err)) {
      throw err;
    }

    el.innerHTML = `<div class="sentry-empty">Failed to load history</div>`;
    console.error(err);
  }
}

async function loadRules() {
  const el = appContainer.querySelector("#sentry-rules");

  try {
    const data = await loadRulesRequest();
    renderRules(data.rules || []);
  } catch (err) {
    if (is429Error(err)) {
      throw err;
    }

    el.innerHTML = `<div class="sentry-empty">Failed to load rules</div>`;
    console.error(err);
  }
}

function renderHistory(groups, logDocotorAvailability) {
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

    const sortedItems = sortHistoryItems(group.items || [], currentGroupMode);

    for (const snap of sortedItems) {
      body.appendChild(createSnapshotCard(snap, null, logDoctorAvailability));
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
  const snoozedEl = appContainer.querySelector("#sentry-snoozed-rules");
  const suppressedEl = appContainer.querySelector("#sentry-rules");

  const snoozedRules = rules
    .filter(r => r.action === "snooze")
    .sort((a, b) => new Date(a.expires_at || 0) - new Date(b.expires_at || 0));

  const suppressedRules = rules
    .filter(r => r.action !== "snooze")
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  renderRuleList(snoozedEl, snoozedRules, "No snoozed rules.");
  renderRuleList(suppressedEl, suppressedRules, "No suppressed rules.");
}

function formatSentryDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderRuleList(el, rules, emptyMessage) {
  if (!el) return;

  if (!rules.length) {
    el.innerHTML = `<div class="sentry-empty">${emptyMessage}</div>`;
    return;
  }

  el.innerHTML = rules.map(r => `
    <div class="sentry-card sentry-rule-card ${r.action === "snooze" ? "sentry-snooze-card" : "sentry-suppressed-card"}">
      
      <div class="sentry-card-top">
        <div class="sentry-tags">
          <span class="sentry-tag ${r.category}">
            ${r.category.toUpperCase()}
          </span>
          <span class="sentry-tag source-${r.source}">
            ${r.source}
          </span>
          <span class="sentry-tag rule-status">
            ${r.action === "snooze" ? "Snoozed" : "Ignored"}
          </span>
        </div>
      </div>

      <div class="sentry-pattern">
        ${r.normalised_pattern}
      </div>

      ${r.action === "snooze" && r.expires_at ? `
        <div class="sentry-rule-meta">
          Snoozed until ${formatSentryDate(r.expires_at)}
        </div>
      ` : ""}

      <div class="sentry-actions">
        <button 
          class="sentry-btn sentry-restore-btn"
          data-restore-rule-id="${r.id}"
        >
          Restore
        </button>
      </div>

    </div>
  `).join("");
}

async function restoreRule(ruleId) {
  const statusEl = appContainer.querySelector("#sentry-status");

  async function refreshAfterRestore(message) {
    statusEl.textContent = `${message} Refreshing...`;

    try {
      await runScan();
      statusEl.textContent = message;
    } catch (err) {
      if (is429Error(err)) {
        statusEl.textContent =
          `${message} Rate limited while refreshing. Sentry will reload shortly.`;

        startRateLimitCooldown();
        scheduleRefreshAfterRateLimit();
        return;
      }

      throw err;
    }
  }

  try {
    statusEl.textContent = "Restoring rule...";

    const csrfToken = document.querySelector("meta[name='csrf-token']")?.content;
    const data = await deleteRuleRequest(ruleId, csrfToken);

    if (!data.ok) {
      const msg = data.error || "Rule was not restored";

      // Rule already gone = restore effectively succeeded.
      if (
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("not restored")
      ) {
        await refreshAfterRestore("Rule already restored.");
        return;
      }

      throw new Error(msg);
    }

    await refreshAfterRestore("Rule restored.");
  } catch (err) {
    if (is429Error(err)) {
      statusEl.textContent = "Rate limit hit. Cooling down for a few seconds.";
    } else {
      statusEl.textContent = "Failed to restore rule.";
    }

    throw err;
  }
}