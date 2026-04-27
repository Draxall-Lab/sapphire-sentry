export async function runScanRequest(csrfToken) {
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

  return res.json();
}

export async function loadSnapshotGroupsRequest() {
  const res = await fetch("/api/plugin/sapphire-sentry/snapshot-groups");

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

export async function loadRulesRequest() {
  const res = await fetch("/api/plugin/sapphire-sentry/rules");

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

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

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

export async function deleteRuleRequest(ruleId, csrfToken) {
  const res = await fetch(`/api/plugin/sapphire-sentry/rules/${ruleId}`, {
    method: "DELETE",
    headers: {
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
    }
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}