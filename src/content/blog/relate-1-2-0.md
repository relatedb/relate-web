---
title: Relate 1.2.0
subtitle: A .NET client, more of Neo4j's Cypher spellings, and indexes that answer aggregations
description: Relate.Net brings Relate to C#, F# and Visual Basic, more Neo4j Cypher runs unchanged, and aggregations and reopens get faster.
date: 2026-11-20
tags: [release, dotnet, java]
draft: false
---

One new language, one fewer reason for a query to fail on syntax, and two full-label scans retired.

## Relate.Net

C#, F# and Visual Basic can now embed Relate on .NET 8 and later. It wraps the same C ABI as every other client: disposable databases, connections and transactions, typed parameters, graph and temporal values, result metadata and structured errors. The native library is built and tested on Linux, macOS and Windows. It lives in the `relate` repository under `clients/dotnet`, built on Peter Villadsen's implementation, which he offered in [issue #410](https://github.com/relatedb/relate/issues/410). Add a project reference to it and the native library comes along.

```csharp
using Relate.Net;

using var db = RelateDatabase.Open("./graph");
using var conn = db.Connect();

conn.Query("CREATE (p:Person {name: $name, born: $born})",
    new { name = "Ada", born = new DateOnly(1815, 12, 10) });

var person = conn.Query("MATCH (p:Person) RETURN p.name AS name")[0];
Console.WriteLine(person.Get<string>("name")); // Ada
```
## More Cypher in the Neo4j-style

A dozen spellings that used to fail now plan and run, so a query ported from Neo4j stops dying on syntax:

- Backtick-quoted and whitespace-separated parameters, `` $`p 1` `` and `$ p2`, and a constraint, index or database literally named `null`.
- Redundant parentheses no longer change what a projection means: `WITH (n)`, `RETURN DISTINCT(n.p1) ORDER BY n.p1`.
- Label expressions parse in every node pattern, including `WHERE (a:L1|L2)<-[:R]-(b)`.
- Pattern expressions work in `SET` values and quantifier filters, and `RETURN max(n.p1).p2` reads a property off an aggregate.
- `USING RANGE INDEX` and `USING TEXT INDEX` hints parse like `USING INDEX`, and `\uXXXX` escapes work between tokens and in identifiers.

## Aggregations read your indexes

`MATCH (n:L) RETURN n.p, count(*)`, and the min, max and `count(n.p)` forms over one labeled property, answer from the existing index on that label and property. On the measured group-by query that's 17.3 ms down to 6.2 ms. An aggregation grouped by a relationship property, with a selective predicate on the start node, now seeks the start nodes and walks only their edges: 16.0 ms down to 1.0 ms. Results are identical.

## Large stores reopen 2.66 times faster

A checkpoint reopen decodes across all CPU cores and installs rows in bounded slices. The benchmark store reopens in 461 ms instead of 1,225 ms.

## Also in this release

- Mistral Vibe joins the agent catalog: `relate skill install --agent vibe` writes the skill to `~/.vibe/skills/relate`.
- The Java client publishes to Maven Central with every release.
- `EXPLAIN` warns when a statement references a parameter you didn't supply.
- A store's engine directory is now `.relate/`. Opening an older store read-write adopts it in place; a read-only open asks for one writable pass first.

Every change is in the [v1.2.0 release notes](https://github.com/relatedb/relate/releases/tag/v1.2.0).

Relatedly,\
Archie & The Chords
