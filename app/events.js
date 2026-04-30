let actionInFlight = false;
let cooldownUntil = 0;
let rateLimitUntil = 0;

const ACTION_COOLDOWN_MS = 1200;
const RATE_LIMIT_COOLDOWN_MS = 60000;

function setCooldown(ms) {
  const until = Date.now() + ms;

  cooldownUntil = until;

  if (ms >= RATE_LIMIT_COOLDOWN_MS) {
    rateLimitUntil = until;
  }
}

function isRateLimited() {
  return Date.now() < rateLimitUntil;
}

export function startRateLimitCooldown() {
  setCooldown(RATE_LIMIT_COOLDOWN_MS);
}

function resetButtonAfterCooldown(btn, label, delay) {
  setTimeout(() => {
    if (!btn.isConnected) return;

    btn.disabled = false;
    btn.textContent = label;
  }, delay);
}

export function is429Error(err) {
  return (
    err?.status === 429 ||
    err?.status === "429" ||
    String(err?.message || "").includes("429") ||
    String(err?.message || "").toLowerCase().includes("rate limit")
  );
}

async function withActionLock(fn) {
  const now = Date.now();

  if (actionInFlight || now < cooldownUntil) {
    return false;
  }

  actionInFlight = true;

  try {
    await fn();
    setCooldown(ACTION_COOLDOWN_MS);
    return true;
  } catch (err) {
    console.warn("[SENTRY] Action failed in lock", {
      err,
      status: err?.status,
      message: err?.message,
      is429: is429Error(err),
    });

    setCooldown(is429Error(err) ? RATE_LIMIT_COOLDOWN_MS : ACTION_COOLDOWN_MS);
    throw err;
  } finally {
    actionInFlight = false;
  }
}

function showBlocked(btn, label) {
  if (!btn || !btn.isConnected) return;

  const blockedByRateLimit = isRateLimited();

  btn.disabled = true;
  btn.textContent = blockedByRateLimit
    ? "Rate limited... please wait"
    : "Please wait...";

  setTimeout(() => {
    if (!btn.isConnected) return;
    btn.disabled = false;
    btn.textContent = label;
  }, blockedByRateLimit ? RATE_LIMIT_COOLDOWN_MS : ACTION_COOLDOWN_MS);
}

function showRateLimited(btn, label) {
  if (!btn || !btn.isConnected) return;

  btn.disabled = true;
  btn.textContent = "Rate limited... please wait";

  setTimeout(() => {
    if (!btn.isConnected) return;

    btn.disabled = false;
    btn.textContent = label;
  }, RATE_LIMIT_COOLDOWN_MS);
}

export function wireEvents({
  appContainer,
  runScan,
  setGroupMode,
  rerenderSnapshots,
  rerenderHistory,
  onIgnore,
  onRestore,
  onSnooze
}) {
  appContainer
    .querySelector("#sentry-scan-btn")
    .addEventListener("click", runScan);

  appContainer
    .querySelector("#sentry-group-mode")
    .addEventListener("change", (event) => {
      setGroupMode(event.target.value);
      rerenderSnapshots();
      rerenderHistory();
    });

  appContainer.addEventListener("click", async (event) => {
    
    const snoozeMenuBtn = event.target.closest("[data-sentry-action='snooze-menu']");

    if (snoozeMenuBtn) {
      const patternKey = snoozeMenuBtn.dataset.patternKey;
      if (!patternKey) return;

      snoozeMenuBtn.outerHTML = `
        <div class="sentry-snooze-options">
        <button class="sentry-btn sentry-snooze-preset" data-snooze-preset="1h" data-pattern-key="${patternKey}">1h</button>
        <button class="sentry-btn sentry-snooze-preset" data-snooze-preset="6h" data-pattern-key="${patternKey}">6h</button>
        <button class="sentry-btn sentry-snooze-preset" data-snooze-preset="24h" data-pattern-key="${patternKey}">24h</button>
        </div>
      `;

    return;
  }

  const snoozePresetBtn = event.target.closest("[data-snooze-preset]");

if (snoozePresetBtn) {
  const patternKey = snoozePresetBtn.dataset.patternKey;
  const snoozePreset = snoozePresetBtn.dataset.snoozePreset;

  let durationSeconds;

  switch (snoozePreset) {
    case "1h":
      durationSeconds = 3600;
      break;
    case "6h":
      durationSeconds = 21600;
      break;
    case "24h":
      durationSeconds = 86400;
      break;
    default:
      return;
  }

  if (!patternKey || !durationSeconds) return;

  try {
    const ran = await withActionLock(async () => {
      snoozePresetBtn.disabled = true;
      snoozePresetBtn.textContent = "Snoozing...";

      await onSnooze(patternKey, snoozePreset);
    });

    if (!ran) {
      showBlocked(snoozePresetBtn, "Snooze");
      return;
    }

    if (snoozePresetBtn.isConnected) {
      snoozePresetBtn.disabled = false;
      snoozePresetBtn.textContent = "Snooze";
    }
  } catch (err) {
    console.error("[SENTRY] Snooze failed", err);

    if (is429Error(err)) {
      showRateLimited(snoozePresetBtn, "Snooze");
      return;
    }

    if (snoozePresetBtn.isConnected) {
      snoozePresetBtn.disabled = false;
      snoozePresetBtn.textContent = "Snooze";
    }
  }

  return;
}
    
    const ignoreBtn = event.target.closest("[data-ignore]");

    if (ignoreBtn) {
      const patternKey = ignoreBtn.dataset.patternKey;
      if (!patternKey) return;

      try {
        const ran = await withActionLock(async () => {
        ignoreBtn.disabled = true;
        ignoreBtn.textContent = "Ignoring...";

        await onIgnore(patternKey);
      });

      if (!ran) {
        showBlocked(ignoreBtn, "Ignore");
        return;
      }

      // Success should re-render/remove this incident card.
      if (ignoreBtn.isConnected) {
        ignoreBtn.disabled = false;
        ignoreBtn.textContent = "Ignore";
      }
    } catch (err) {
      console.error("[SENTRY] Ignore failed", err);

      if (is429Error(err)) {
        showRateLimited(ignoreBtn, "Ignore");
        return;
      }

      if (ignoreBtn.isConnected) {
        ignoreBtn.disabled = false;
        ignoreBtn.textContent = "Ignore";
      }
    }

    return;
  }

    const restoreBtn = event.target.closest("[data-restore-rule-id]");

    if (restoreBtn) {
  const ruleId = restoreBtn.dataset.restoreRuleId;
  if (!ruleId) return;

  try {
    const ran = await withActionLock(async () => {
      restoreBtn.disabled = true;
      restoreBtn.textContent = "Restoring...";

      await onRestore(ruleId);
    });

    if (!ran) {
      showBlocked(restoreBtn, "Restore");
      return;
    }

    // Success should re-render/remove this rule card.
    if (restoreBtn.isConnected) {
      restoreBtn.disabled = false;
      restoreBtn.textContent = "Restore";
    }
  } catch (err) {
    console.error("[SENTRY] Restore failed", err);

    if (is429Error(err)) {
      showRateLimited(restoreBtn, "Restore");
      return;
    }

    if (restoreBtn.isConnected) {
      restoreBtn.disabled = false;
      restoreBtn.textContent = "Restore";
    }
  }

  return;
}
  });
}