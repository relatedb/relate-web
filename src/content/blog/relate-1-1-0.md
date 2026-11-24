---
title: Relate 1.1.0
subtitle: Lookups without an index, a leaner memory footprint, and a Swift API to match
description: Equality lookups no longer need a declared index, queries hold less memory, long shortest-path queries finish, and agents can send feedback from a session.
date: 2026-11-17
tags: [release]
draft: true
---

If one theme runs through this release, it's doing the same work with less waiting and less memory.

## Equality lookups don't need an index

A keyed `MATCH` or `MERGE` without a declared `RANGE` index used to scan per row. It now serves from equality postings built on demand. A 4,000-node bulk load took 14.6 seconds that way, against 76 ms with an index.

## The same answers, holding less memory

The adjacency floor shrank by 37.5% (147.24 to 91.99 MiB on SF0.1). `ORDER BY … LIMIT` collects into a charged top-k heap and `UNWIND` streams into it, so a query refused under a 16 MiB workspace limit now answers.

## Shortest paths that used to hang now answer

When a `WHERE` carries the endpoints, Relate seeks them instead of fanning out from every node: 16.0 s to 0.49 s on soc-pokec. `SHORTEST k` and `SHORTEST k GROUPS` walk one length class at a time, which took one query from over four minutes to milliseconds.

## The Swift API grew up

Typed value bridges, `Statement` interpolation, `Codable` in both directions, scoped transactions with retry and snapshot reads, managed async reads and writes with a pool, a trace handler with signposts and a commit stream, store provisioning, a schema migrator and SwiftUI live queries.

Two changes to know: `QueryResult.records` returns `Record`s instead of dictionaries, and a transaction body receives a `Transaction` instead of the `Connection`.

## Agents can report what went wrong

A person can let agents send feedback reports about Relate for 30 days. The agent then files a report on what failed and why, in the session where it hit the problem:

```bash
relate feedback enable
```

## Also in this release

- The HTTP Query API accepts `application/vnd.neo4j.query`, the unversioned alias Neo4j Browser sends, so Browser's `http://` connect works.
- `db.index.fulltext.listAvailableAnalyzers` runs, and `TERMINATE TRANSACTION` matches live Neo4j.
- `fs-to-graph` and `git-to-graph` 0.14.0 shipped the same week, versioned separately.

Every change is in the [v1.1.0 release notes](https://github.com/relatedb/relate/releases/tag/v1.1.0).

Relatedly,\
Archie & The Chords
