---
title: Relate 1.0.2
subtitle: Imports that keep their footing, shortest paths that respect a filter, and a tidier Swift API
description: Large fs-to-graph imports commit batch by batch, a WHERE over a shortest path filters after selection, and the Swift client gets typed namespaces and clearer errors.
date: 2026-11-16
tags: [release, swift]
draft: false
---

The second patch is about keeping promises: an import that doesn't fall over, a filter that doesn't move the goalposts, and Swift names that don't step on Apple's.

## Large imports keep their footing

Each `fs-to-graph` batch now commits on its own. A tree too large for the 64 MB WAL record cap imports, and if you rerun it, the batches that already landed stay.

## Shortest-path filters mind their manners

A `MATCH`-level `WHERE` over a path now filters the keyword shortest selectors after selection. The shortest path is chosen first, then tested, so a longer path can't sneak in just because it passes the filter.

Here the shortest route from A to C is the direct hop, so asking for at least two hops returns no rows:

```bash
relate --database :memory: "CREATE (a:Stop {name:'A'})-[:LINK]->(:Stop {name:'B'})-[:LINK]->(c:Stop {name:'C'}), (a)-[:LINK]->(c)
WITH a, c
MATCH p = SHORTEST 1 (a)-[*]-(c) WHERE length(p) >= 2
RETURN length(p) AS hops"
```

Without the `WHERE`, the same query returns one row with `hops` set to 1.

## A tidier Swift API

The client gets typed namespaces, clearer errors, and metadata names that don't collide with Apple's.

- `Database(url:readOnly:)`, typed `connect(namespace:)` and `setNamespace(_:)`, and predicates such as `EngineError.isConstraintViolation` and `RelateError.isRetryable` make opening, connecting and handling failures more direct.
- Calls that can fail only with the package's own error now use typed `throws(RelateError)`.

One breaking change to know: `Notification` and `Namespace` are gone in favour of `QueryNotification` and `DatabaseNamespace`. `Severity` and `Category` become `NotificationSeverity` and `NotificationCategory`, with deprecated aliases.

## Also in this release

- `system_ontologies` is visible only with `RELATE_PREVIEW=ontology`. Without it, listings and routing treat the namespace as unknown, and stored databases stay put.
- Windows installs through `install.ps1`, with Windows CLI fixes.
- A commit over the cap is refused with a message that names 64 MiB and the batching remedy, on Bolt, HTTP and the CLI.
- `git-to-graph` takes `--until`, so an import window need not end at `HEAD`.

Every change is in the [v1.0.2 release notes](https://github.com/relatedb/relate/releases/tag/v1.0.2).

Relatedly,\
Archie & The Chords
