export const SENTRY_LOG_DOCTOR_HANDOFF_KEY =
  "sapphire-sentry:log-doctor-handoff";

function snapshotSample(snapshot) {
  return (
    snapshot.sample ||
    snapshot.example ||
    snapshot.message ||
    snapshot.raw ||
    snapshot.raw_line ||
    snapshot.text ||
    snapshot.normalised_pattern ||
    snapshot.normalisedPattern ||
    ""
  );
}

function snapshotScanTimestamp(snapshot) {
  return (
    snapshot.scan_timestamp ||
    snapshot.scanTimestamp ||
    snapshot.created_at ||
    snapshot.createdAt ||
    snapshot.timestamp ||
    null
  );
}

  export function buildLogDoctorHandoff(snapshot) {
  return {
    version: "1.0",
    from: "sapphire-sentry",
    type: "log-doctor-handoff",
    createdAt: new Date().toISOString(),

    snapshot: {
      id: snapshot.id || null,
      scanId: snapshot.scan_id || snapshot.scanId || null,
      scanTimestamp: snapshotScanTimestamp(snapshot),
      source: snapshot.source || null,
      category: snapshot.category || null,
      patternKey: snapshot.pattern_key || snapshot.patternKey || null,
      normalisedPattern:
        snapshot.normalised_pattern || snapshot.normalisedPattern || "",
      count: snapshot.count || 0,
      firstSeen: snapshot.first_seen || snapshot.firstSeen || null,
      lastSeen: snapshot.last_seen || snapshot.lastSeen || null,
      sample: snapshotSample(snapshot)
    },

    filter: {
      text: snapshot.normalised_pattern || snapshot.normalisedPattern || "",
      searchText: handoffSearchText(snapshot),
      source: snapshot.source || null,
      category: snapshot.category || null,
      mode: "all-terms"
    }
  };
}

export function handoffToLogDoctor(snapshot) {
  const payload = buildLogDoctorHandoff(snapshot);

  sessionStorage.setItem(
    SENTRY_LOG_DOCTOR_HANDOFF_KEY,
    JSON.stringify(payload)
  );

  window.location.hash = "#app-log-doctor";
}

function handoffSearchText(snapshot) {
  const text =
    snapshot.normalised_pattern ||
    snapshot.normalisedPattern ||
    "";

  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join("+");
}