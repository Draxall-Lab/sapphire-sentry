# Changelog

All notable changes to Sapphire Sentry are documented here.

This project loosely follows semantic versioning:
- MAJOR: breaking changes
- MINOR: new features
- PATCH: fixes and refinements

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