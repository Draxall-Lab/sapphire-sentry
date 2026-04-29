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