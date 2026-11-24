---
title: Hello, world!
subtitle: Meet Relate by Neo4j, an embedded database for AI agents
description: Agents keep facts yet lose the context. Relate is an embedded database that keeps both.
date: 2026-11-11
tags: [launch]
draft: false
unlisted: true
---

Today, Relate by Neo4j says hello to the agentic world.

## A world of related facts

> The world is the totality of facts, not of things.
>
> -- Wittgenstein

An agent's world is made of facts too. Facts are not isolated bits. They compose into things.

A ticket cites a document. That situation led to this decision. Some other agent ran into this problem before. Most agents keep all of it in a Python dict, a JSON file, or maybe some markdown. The facts survive, yet how they relate doesn't, and the relationships are where the facts become context and meaning.

To reason, to act, to collaborate in the world requires the relevant facts, and how they relate.

## Relate all the things

Relate is an open-source, embedded database. It runs inside what you already have: a library in your application, a CLI in your sandbox, or WebAssembly in your browser.

- Keep in memory, in a directory, or in one `.rl` file you can move around or check into git.
- Query in Cypher, a query language your agent already knows. One statement can mix pattern matching and similarity search.
- Libraries for Rust, Python, JavaScript, Java, Go, .NET, Swift and C.
- Agents get a skill (`relate skill install`), an MCP endpoint (`relate serve`), and compact, row-capped output when Relate sees one on the other end.

It is a new Rust implementation, built on twenty years of Neo4j database experience.

## Try it

Install and run it:

```bash
curl -sSfL https://relatedb.ai/install.sh | bash
relate --database :memory: "CREATE (a:Agent {name:'planner'})-[:USES]->(t:Tool {name:'search'}) RETURN a.name, t.name"
```

Or tell your agent to get Relate, by pasting this:

> Install Relate by Neo4j by following the instructions at https://relatedb.ai. Use Relate as this project's memory, task tracker, or application store.

Or try Relate in the [playground](/playground/). No install required.

## Pure data joy

OK, yes, there be graphs in here. If you have data, you have a graph. The graphs are the reason the data comes alive. Do the same kind of querying you're familiar with, extended with pattern matching, vector search, and an adaptive schema. Structured data, unstructured data, and vectors all in one bundle of joy.

Relatedly,\
Archie & The Chords