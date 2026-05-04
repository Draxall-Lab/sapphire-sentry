# Changelog

All notable changes to Sapphire Sentry are documented here.

This project loosely follows semantic versioning:
- MAJOR: breaking changes
- MINOR: new features
- PATCH: fixes and refinements

---

## [v0.5.2] – 2026-04-30

### Added
- Analyse button availability gating based on Log Doctor integration readiness
- Detection of Log Doctor installation via Sapphire plugin registry
- Version check for Log Doctor (minimum required version for integration)
- Contextual tooltips explaining Analyse availability:
  - Not installed
  - Installed but disabled
  - Installed but below required version
  - Ready for use

### Changed
- Analyse button now dynamically enabled/disabled across:
  - Active Incidents
  - Snapshot History
- Render pipeline updated to propagate external dependency state (`logDoctorAvailability`) consistently

### Fixed
- Inconsistent Analyse button state between Active and Snapshot views
- Render errors caused by missing availability state in snapshot rendering paths

### Notes
- Analyse currently performs availability gating only
- Log Doctor handoff (prefill + navigation) will be introduced in a future version
- Minimum required Log Doctor version set to support upcoming integration endpoint

---

## [v0.5.1] – 2026-04-30

### Added
- Snooze rules with preset durations (1h, 6h, 24h)
- Snoozed Rules section in UI
- Inline snooze preset selector on incident cards
- Human-readable expiry display ("Snoozed until ...")

### Changed
- Active incident filtering now respects:
  - ignore rules (permanent)
  - snooze rules (time-bound)
- Run Scan now returns filtered snapshots (rules applied server-side)
- Snoozed rules sorted by nearest expiry
- Suppressed rules sorted by newest first

### Fixed
- Snoozed incidents reappearing after scan (rules not applied to scan output)
- Snooze rules missing expiry when created from pattern payload
- Snapshot rendering error (`item is not defined`) in snooze button

### Notes
- Snooze expiry is passive:
  - expired rules are removed on next scan or data load
- Forms the first complete control loop:
  Detection → Organisation → Control → Memory

---

## [v0.5.0] – 2026-04-29

### Added
- Global rate limit handling (429 detection and cooldown state)
- Delayed self-healing refresh after rate limit
- Clear user feedback states:
  - “Please wait…” (frontend cooldown)
  - “Rate limited…” (backend limit)

### Changed
- Unified Ignore/Restore action handling
- Reworked action locking to correctly propagate errors
- Separated action success from UI refresh logic
- Improved event handling to prevent duplicate triggers

### Fixed
- Stuck button states ("Restoring...", "Ignoring...")
- Incorrect fallback to “Please wait…” during 429 conditions
- Hidden failures when refresh calls were rate limited

### Notes
- System now stable under heavy interaction and rapid input
- Forms the baseline for upcoming Snooze feature

---

## [0.1.0] – 2026-04-25
### Added
- Initial plugin scaffold (plugin.json, folder structure)
- Core project architecture defined (engine, routes, tools)
- Data model for snapshots, rules, and scans
- Obsidian project documentation

### Notes
- First working baseline for Sapphire Sentry