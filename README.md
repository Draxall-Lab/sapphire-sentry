# Sapphire Sentry

Incident snapshots and noise control for Sapphire logs.

Sapphire Sentry is a plugin for Sapphire that transforms raw logs into structured, actionable incident snapshots.

It focuses on detecting patterns, grouping noise, preserving incident memory, and helping users decide what matters.

---

## Core Concept

Sentry follows a simple flow:

Detection → Organisation → Control → Memory

- **Detection**: Scan logs and identify meaningful events
- **Organisation**: Group incidents by frequency, category, or source
- **Control**: Ignore or snooze known noise
- **Memory**: Store snapshots and rules for future context

---

## Features

- Run Scan to generate incident snapshots
- Multiple view modes:
  - Frequency
  - Category
  - Source
- Snapshot history with grouped scans
- Ignore / Restore rules
- Snooze rules with automatic expiry handling
- Suppressed incident filtering
- Persistent incident memory across scans
- Visual distinction for suppressed and snoozed rules
- Scheduled scan support via `sentry_scan` tool

---

## 🔗 Log Doctor Integration (v0.5.x)

Sentry integrates directly with Log Doctor for deeper investigation workflows.

Sentry handles:
- detection
- triage
- incident memory

Log Doctor handles:
- investigation
- scoped analysis
- contextual interpretation

Features:

- One-click Sentry → Log Doctor handoff
- Snapshot-aware investigations
- Historical incident analysis
- Correct handling of rotated or expired logs

Mental model:

Sentry = radar
Log Doctor = microscope

---

## Stability (v0.5.x)

Sentry is designed to remain stable under heavy interaction:

- Handles API rate limiting (429) gracefully
- Prevents duplicate actions and race conditions
- Recovers cleanly from failed refresh calls
- Provides clear UI feedback for all states
- Maintains stable behaviour under rapid repeated input

---

## UI Feedback States

| Message           | Meaning                         |
|------------------|---------------------------------|
| Please wait…     | Frontend cooldown               |
| Rate limited…    | Backend rate limit (429)        |
| Ignoring…        | Action in progress              |
| Restoring…       | Action in progress              |
| Snoozed          | Rule temporarily suppressed     |

---

## Philosophy

Sentry is not a dashboard.

It’s a control layer over log noise.

The goal is not more data - it’s clarity.

Sentry preserves awareness.
Log Doctor performs investigation.