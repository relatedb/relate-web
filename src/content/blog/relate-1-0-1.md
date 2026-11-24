---
title: Relate 1.0.1
subtitle: Python rows that behave, a Bolt server that stays on the line, and quiet JSON lines
description: The first patch after launch smooths the edges where Relate meets other tools.
date: 2026-11-12
tags: [release, python]
draft: true
---

A day after hello, the first patch is about edges: where Relate meets a Python script, a Bolt client and a pipe.

## Python rows convert like the Neo4j driver's

`row.data()` turns nodes, relationships and paths into plain property dicts and alternating lists, the same shape the Neo4j driver gives you. When you need everything, `row.to_dict()` keeps ids, labels, endpoints and `properties` in a lossless, JSON-ready form.

```python
import relate

cur = relate.connect("friends").cursor()
cur.execute("MATCH (p:Person {name: 'alice'}) RETURN p")
row = cur.fetchone()

row.data()     # {'p': {'name': 'alice'}}
row.to_dict()  # {'p': {'id': 0, 'element_id': '4:rl-id:n0', 'labels': ['Person'], 'properties': {'name': 'alice'}}}
```

## Bolt keeps the connection

A well-formed message past the decoded-value budget used to end the conversation. Now it fails only its own request, with a `Neo.ClientError.Request.Invalid` that names the size, the limit and a remedy. Anything pipelined behind it is answered IGNORED until RESET, and then the same connection serves the next request.

```bash
relate serve --database ./friends --bolt 7687
```

## `--jsonl` is rows, and only rows

A statement that returns N rows now prints N lines, and a statement that returns none prints nothing. The timings line moved behind a new flag:

```bash
relate --jsonl --timings --database :memory: "UNWIND [1, 2, 3] AS x RETURN x"
```

## Also in this release

- Cypher validation matches live Neo4j more closely: invalid syntax and clause compositions are rejected, and `shortestPath()` in an expression refuses a property map.
- The installer fetches release assets over the direct GitHub route, with no API requests and no token, even behind a shared-IP network.
- The Python source distribution ships the library skill again, so source installs carry the agent docs.

Every change is in the [v1.0.1 release notes](https://github.com/relatedb/relate/releases/tag/v1.0.1).

Relatedly,\
Archie & The Chords
