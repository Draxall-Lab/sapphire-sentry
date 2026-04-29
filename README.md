# Sapphire Sentry

Sapphire Sentry is a plugin for Sapphire that transforms raw logs into structured, actionable incident snapshots.

It focuses on detecting patterns, grouping noise, and giving users control over what matters.

---

## Core Concept

Sentry follows a simple flow:

Detection → Organisation → Control → Memory

- **Detection**: Scan logs and identify meaningful events
- **Organisation**: Group incidents by frequency, category, or source
- **Control**: Ignore or suppress known noise
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
- Suppressed incidents filtering
- Visual distinction for suppressed rules

---

## Stability (v0.5.0)

Sentry is designed to remain stable under heavy interaction:

- Handles API rate limiting (429) gracefully
- Prevents duplicate actions and race conditions
- Recovers cleanly from failed refresh calls
- Provides clear UI feedback for all states

---

## UI Feedback States

| Message           | Meaning                         |
|------------------|---------------------------------|
| Please wait…     | Frontend cooldown               |
| Rate limited…    | Backend rate limit (429)        |
| Ignoring…        | Action in progress              |
| Restoring…       | Action in progress              |

---

## Roadmap

- Snooze rules (time-based suppression)
- Rule expiry handling
- Enhanced status messaging
- Deeper analysis tooling

---

## Philosophy

Sentry is not a dashboard.

It’s a control layer over log noise.

The goal is not more data - it’s clarity.