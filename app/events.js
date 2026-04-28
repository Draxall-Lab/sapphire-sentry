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
      const card = ignoreBtn.closest(".sentry-card");
      const patternKey = ignoreBtn.dataset.patternKey;

      if (!patternKey) return;

      ignoreBtn.disabled = true;
      ignoreBtn.textContent = "Ignoring...";

      await onIgnore(patternKey);
      return;
    }

    const restoreBtn = event.target.closest("[data-restore-rule-id]");
    if (restoreBtn) {
      const ruleId = restoreBtn.dataset.restoreRuleId;
      if (!ruleId) return;

      restoreBtn.disabled = true;
      restoreBtn.textContent = "Restoring...";

      await onRestore(ruleId);
    }
  });
}