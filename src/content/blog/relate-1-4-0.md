---
title: Relate 1.4.0
subtitle: Neo4j and APOC write procedures with no shim, a statement timeout, and huge results that stream
description: The vector and APOC write calls graph tooling leans on run unchanged, every statement can run under a wall-clock budget, and large answers stream over HTTP and Bolt instead of buffering.
date: 2026-11-27
tags: [release, python, go]
draft: false
---

Tooling written for Neo4j runs as it is, and a statement on the server no longer runs unbounded by default.

## Neo4j and APOC write procedures, no shim

Four calls that graph tooling leans on now run with no opt-in and no client change: `db.create.setNodeVectorProperty`, `db.create.setRelationshipVectorProperty`, `apoc.create.addLabels` and `apoc.merge.relationship`. That means neo4j-graphrag's knowledge-graph writer runs against `relate serve` unmodified.

```bash
relate --database :memory: "CREATE (n:Chunk) WITH n CALL db.create.setNodeVectorProperty(n, 'embedding', [0.1, 0.2]) RETURN n.embedding AS e"
```

The row comes back as `[0.1,0.2]`.

## Statements run under a wall-clock budget

A new statement timeout defaults to 30 seconds on the network surfaces, and a request can set its own: Bolt `tx_timeout`, HTTP `maxExecutionTime`, MCP `timeout_seconds`. The CLI gains `--timeout` and a `.timeout` dot command. The embedded library, the C API and the language clients opt in per connection, Python's `Connection.statement_timeout` among them. A timeout inside a batched subquery rolls back only the in-flight batch, keeps the committed ones, and is never swallowed by `ON ERROR CONTINUE`.

```bash
relate --database :memory: --timeout 500ms "UNWIND range(1, 100000000) AS i WITH i WHERE i % 7 = 0 RETURN count(i) AS n"
```

That one stops with `query timed out after 500ms`.

One thing to know: `serve` used to run queries unbounded. A statement that legitimately needs longer should set its own budget, or start the server with `--query-timeout-secs 0`. A ceiling over every budget, a request's included, is one more flag:

```bash
relate serve --database ./friends --bolt 7687 --http 7474 --mcp 7475 --query-timeout-secs 30 --query-timeout-max-secs 600
```

## Huge results stream instead of buffering

A multi-million-row answer no longer has to fit the server's memory:

- HTTP: an auto-commit answer past the stream threshold is encoded batch by batch into the chunked body, and an error after the head is reported in-band.
- Bolt: `PULL {n}` is answered from bounded batches the statement produces on demand, `DISCARD` finishes without encoding the rest, and `--max-result-bytes` bounds each streamed batch. Explicit transactions still buffer.

## Same answers, less waiting

A batch of query shapes got faster, with identical results:

- Vector `SEARCH` reads the indexed vectors from a packed matrix cached per index. A 10,000-node, 384-dimension index drops from 19–61 ms to about 2–5 ms per search, and the speed holds across writes.
- A directed two-hop count tallies once per middle node instead of once per path: a 58M-path count on a 100k-node, 2.4M-edge graph drops from 7.0 s to 0.29 s.
- `ORDER BY … LIMIT` over a node scan builds rows only for survivors. An `ORDER BY id(n)` page over 100,000 nodes drops from about 52 ms to about 1.5 ms.
- A shortest path between two label-only endpoints sweeps from both ends: the same 58,113 paths in about 0.4 s of CPU instead of about 1.8 s on a 3,100-node network graph.
- Cached plans survive commits that don't touch them, so a hot read after an unrelated write keeps its plan. The `planCache` metadata now reports `replan` with one of four causes.

## Also in this release

- Per-label and per-type count subqueries answer from the maintained counts instead of scanning once per label or type. A grouped count keyed on one node's properties runs a 2.4M-edge in-degree top-3 in about half the time.
- A result value that is small in memory but exponential once expanded is refused with the expression-memory-limit error instead of hanging. A `table` or `markdown` cell longer than 4096 characters is cut with a trailing `…`.
- `EXPLAIN` and `PROFILE` of `CALL { … } IN TRANSACTIONS` show the body's operators, and `PROFILE` reports batches run, committed and rolled back under `ON ERROR`, and the per-batch peaks.
- Fixes to answers: `LIMIT n` without `ORDER BY` over a variable-length or quantified pattern returns `min(n, total)` rows; counts honor a relationship variable pinned by an earlier clause; a `WITH`'s trailing `WHERE` filters the page the projection produced; `ON CREATE SET labels(n) = …` keeps the merge pattern's own labels; and a POINT-index distance seek at or beyond about 10,018 km keeps the far hemisphere.
- `RETURN toString([1, 2])` answers `'[1, 2]'` instead of failing the statement.
- `LOAD CSV … CALL (row) { … } IN TRANSACTIONS` runs, while a write before the batched call is refused at compile time, with nothing written. A FLOAT batch size is rejected instead of truncated.
- Go client: temporal, point and vector parameters bind as their Cypher kinds, so a value read from a result round-trips as a parameter. Entity values now refuse as parameters; pass their properties explicitly.
- An experimental Vortex columnar property store ships default-off, behind the `vortex-store` build feature plus `RELATE_PREVIEW=vortex-store`. Answers, the Cypher dialect and the checkpoint format are unchanged.
- The Linux installer refuses a system below the documented glibc 2.35 floor before downloading anything, and names the alternatives.

Every change is in the [v1.4.0 release notes](https://github.com/relatedb/relate/releases/tag/v1.4.0).

Relatedly,\
Archie & The Chords
