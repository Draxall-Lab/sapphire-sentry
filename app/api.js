async function assertOk(res) {
  if (res.status === 429) {
    const err = new Error("Rate limit hit");
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
}

export async function runScanRequest(csrfToken) {
  const res = await fetch("/api/plugin/sapphire-sentry/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
    },
    body: JSON.stringify({})
  });

  await assertOk(res);

  return res.json();
}

export async function loadSnapshotGroupsRequest() {
  const res = await fetch("/api/plugin/sapphire-sentry/snapshot-groups");

  await assertOk(res);

  return res.json();
}

export async function loadRulesRequest() {
  const res = await fetch("/api/plugin/sapphire-sentry/rules");

  await assertOk(res);

  return res.json();
}

export async function createSnoozeRuleRequest(snapshot, snoozePreset, csrfToken) {
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
      action: "snooze",
      snooze_preset: snoozePreset,
      reason: "Snoozed from Sentry UI"
    })
  });

  await assertOk(res);

  return res.json();
}

export async function createIgnoreRuleRequest(snapshot, csrfToken) {
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

  await assertOk(res);

  return res.json();
}

export async function deleteRuleRequest(ruleId, csrfToken) {
  const res = await fetch(`/api/plugin/sapphire-sentry/rules/${ruleId}`, {
    method: "DELETE",
    headers: {
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
    }
  });

  await assertOk(res);

  return res.json();
}

export async function getPluginsRequest() {
  const res = await fetch("/api/webui/plugins", {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  await assertOk(res);
  return res.json();
}

export async function loadPluginMeta() {
  const res = await fetch("/api/plugin/sapphire-sentry/meta");

  if (!res.ok) {
    throw new Error(`Failed to load plugin meta: ${res.status}`);
  }

  return res.json();
}

export async function checkPluginUpdate() {
  const res = await fetch("/api/plugins/sapphire-sentry/check-update");

  if (!res.ok) {
    throw new Error(`Failed to check plugin update: ${res.status}`);
  }

  return res.json();
}