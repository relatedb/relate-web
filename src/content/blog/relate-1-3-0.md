---
title: Relate 1.3.0
subtitle: SEARCH over any pattern, installs through package managers, and big statements that stream
description: SEARCH keeps every pattern shape MATCH accepts, the CLI installs through package managers, and batched loads and big statements now run where they used to refuse.
date: 2026-11-25
tags: [release, dotnet, java]
draft: false
---

Fewer refusals: bigger patterns, bigger loads and bigger statements now run.

## SEARCH takes any pattern

A searching `MATCH` now keeps every pattern shape the general pattern machinery accepts. `SKIP` and `LIMIT` page over the entities the whole statement keeps, so labels, predicates and bindings from earlier clauses narrow the candidates before the window applies. The inner `WHERE` serves full-text searches too. The `complex-search-patterns` preview opt-in is retired.

Find the films Pacino acted in whose plot vectors sit closest to a query, with the pattern narrowing the candidates before the window applies:

```bash
relate --database ./films "CREATE VECTOR INDEX plotVectors FOR (m:Movie) ON (m.plot) OPTIONS {indexConfig: {\`vector.dimensions\`: 2, \`vector.similarity_function\`: 'cosine'}}"
relate --database ./films "CREATE (p:Person {name:'Pacino'}), (a:Movie {title:'Heat', plot:[1.0,0.0]}), (b:Movie {title:'Scarface', plot:[0.9,0.1]}), (c:Movie {title:'Jaws', plot:[0.0,1.0]}), (p)-[:ACTED_IN]->(a), (p)-[:ACTED_IN]->(b)"
relate --database ./films "MATCH (movie:Movie)<-[:ACTED_IN]-({name: 'Pacino'}) SEARCH movie IN (VECTOR INDEX plotVectors FOR [1.0, 0.0] LIMIT 2) SCORE AS score RETURN movie.title AS title ORDER BY score DESC"
```

Jaws is in the graph but Pacino was not in it, so it never competes for the two slots. The rows come back as Heat, then Scarface.

## Install with your package manager

Homebrew works today. Each release also builds signed APT and RPM repositories, plus winget, Chocolatey and Scoop packages, from its own signed, checksummed artifacts, ready as those channels go live. On an install a package manager owns, `relate upgrade` names that manager's own upgrade command and replaces nothing.

## One statement, a million rows

`CALL { … } IN TRANSACTIONS` runs one engine pass per batch, and the per-statement nested-evaluation budget is now a million passes. A batched bulk load no longer refuses at the 100,001st row. A one-million-node load measured 4.98 s at 0.99 GB peak RSS.

```bash
relate --database ./people "UNWIND range(1,1000000) AS id CALL (id) { CREATE (n:Person {name:'Hakan '+id, id:id, age:id%100}) } IN TRANSACTIONS OF 100000 ROWS"
relate --database ./people --read-only "MATCH (n:Person) RETURN count(n) AS people"
```

The second statement returns 1000000.

## Big statements stream

Statements that refused under the per-allocation cap now run, because they stop demanding memory in proportion to their intermediate results:

- `LOAD CSV` hands records to aggregations as it reads them, so memory stops scaling with the file.
- `CALL` compositions of procedures and subqueries stream their cross products into folding consumers.
- `UNWIND` over a list comprehension streams element by element, and the projected list is never built.
- `ORDER BY … LIMIT` and `DISTINCT` fed by a `MATCH` fold into bounded windows, and `PROFILE` runs the streaming path it reports.

## Also in this release

- The .NET client is on NuGet as `Relate.Net`, one package carrying all five platform builds.
- The Java client's Maven Central deploy publishes itself once Central validates. The 1.2.0 attempt failed importing an empty signing key.
- Warm plan-cache hits skip the front end: a repeated point read's planning window drops from 6.5 µs to 0.7 µs at p50.
- The per-commit WAL payload cap is 256 MiB by default (it was a hard 64 MiB) and configurable at open with `RELATE_WAL_PAYLOAD_LIMIT`.
- A markdown vault can carry its schema in a committed `ontology.yaml`, so every fresh clone opens with it installed. Vaults also open and close faster: a 27k-file vault's session drops from 4.1 s to about 1.25 s.
- Full-text search applies its configured analyzer, adds a `cjk` analyzer for Chinese and Japanese, and rejects unimplemented Lucene constructs with a syntax error instead of a wrong answer.
- A `DELETE` whose `MATCH` held an unnamed empty pattern used to delete every node of the named label past the 10,000-target batching threshold. It now yields no targets at any size.
- `relate upgrade` refreshes the skill only for agents that already have it installed.
- JSON result rows key their objects in the query's column order instead of alphabetically.
- The Windows release binary carries an Authenticode signature with an RFC 3161 timestamp.

Every change is in the [v1.3.0 release notes](https://github.com/relatedb/relate/releases/tag/v1.3.0).

Relatedly,\
Archie & The Chords
