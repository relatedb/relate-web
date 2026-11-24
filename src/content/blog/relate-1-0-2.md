---
title: Relate 1.0.2
subtitle: Imports that keep their footing, shortest paths that honor the filter, and a tidier Swift API
description: Large imports commit batch by batch, shortest-path filters run after selection, and the Swift client gets typed namespaces.
date: 2026-11-16
tags: [release]
draft: true
---

Three fixes for things that were right in spirit and wrong in the details.

## Large imports commit in batches

Each `fs-to-graph` batch now commits on its own. A tree larger than the 64 MB WAL record cap can import, and if you rerun, the batches that already landed stay.

## Shortest paths mind the filter

A `MATCH`-level `WHERE` over a path now filters keyword shortest selectors after the selection, so a longer path can't sneak in just because it passes the filter.

```bash
relate --database ./friends "MATCH p = SHORTEST 1 (a)-[*]-(b) WHERE length(p) >= 2 RETURN p"
```

## A tidier Swift API

The Swift client gets typed namespaces, clearer errors and metadata names that don't collide with Apple's.

- `Database(url:readOnly:)`, a typed `connect(namespace:)` and `setNamespace(_:)`, plus predicates such as `EngineError.isConstraintViolation` and `RelateError.isRetryable`, make opening, connecting and handling failure more direct.
- Calls that can fail only with the package's own error use typed `throws(RelateError)`.
- Renames: `Notification` and `Namespace` become `QueryNotification` and `DatabaseNamespace`, and `Severity` and `Category` become `NotificationSeverity` and `NotificationCategory`. The old `Notification` and `Namespace` are removed; the old `Severity` and `Category` stay as deprecated aliases.

Every change is in the [v1.0.2 release notes](https://github.com/relatedb/relate/releases/tag/v1.0.2).

Relatedly,\
Archie & The Chords
