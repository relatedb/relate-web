---
title: Time and Relate in Space
subtitle: Graphiti from Zep builds temporal context graphs, and now Relate can be the database inside the process
description: Graphiti 0.32 adds a Relate driver, so an agent's temporal context graph lives inside its Python process with no database server.
date: 2026-11-24
tags: [integrations, python]
image: /blog/time-and-relate.jpg
card: /blog/time-and-relate-card.jpg
imageAlt: Archie peeking around a fuzzy clay police box in a purple and blue galaxy, a plate on its door showing Relate loves Zep.
draft: false
---

Graphiti 0.32 ships with Relate as a graph database, so a Graphiti application can keep its graph in the same Python process, with no server to run. 

## What Graphiti does

[Graphiti](https://github.com/getzep/graphiti) is an open-source framework for building temporal context graphs. Raw data comes in as episodes, and Graphiti extracts the entities and the relationships between them. Every fact has a validity window: when something changes, the old fact is invalidated, not deleted, so you can ask what is true now or what was true then. Every fact traces back to the episode that produced it.

## What Relate adds

Until now, Graphiti needed a graph database running somewhere: Neo4j, FalkorDB or Amazon Neptune. With Relate there is nothing to start. The database is a library inside your process, and the graph is memory or a directory.

- `:memory:` is ephemeral, which suits tests and short-lived agents.
- A path persists the graph as a directory. Move it or back it up.
- The driver implements Graphiti's operations natively: entities, episodes, facts, communities and sagas, along with search.

It needs Python 3.11 or later. Graphiti still calls an LLM to extract entities, by default OpenAI, so the usual API key applies.

## Try it

Install the extra:

```bash
pip install "graphiti-core[relate]"
```

Then hand Graphiti a Relate driver:

```python
from graphiti_core import Graphiti
from graphiti_core.driver.relate_driver import RelateDriver

# ':memory:' is the default; pass a path to keep the graph on disk
driver = RelateDriver('./context.relate')
graphiti = Graphiti(graph_driver=driver)
```

Everything else in Graphiti works the same. The graph it builds is an ordinary Relate database, so you can open the same directory with the `relate` CLI and query it in Cypher:

```bash
relate --database ./context.relate --read-only "MATCH (e:Episodic) RETURN e.name, e.content"
```

The driver is a contribution from the Relate team, proposed in [issue #2158](https://github.com/getzep/graphiti/issues/2158) and merged in [pull request #2176](https://github.com/getzep/graphiti/pull/2176). Graphiti's [0.32.1 release notes](https://github.com/getzep/graphiti/releases/tag/v0.32.1) have the rest of the release.

Thank you to the Zep team for making room for us in Graphiti. Good things relate across time.

Relatedly,\
Archie & The Chords
