---
title: Seven Bridges of Integrationsburg
subtitle: Relating with Astro, Next.js, SvelteKit, Observable, react-admin, Phaser, and vanilla JS
description: Seven npm packages put a Relate database in a web page and connect it to the frameworks you already use.
date: 2026-11-23
tags: [integrations, web, javascript]
draft: true
---

Relate runs in a browser as WebAssembly. The packages below handle the rest: where the database file goes, which thread it runs on, what happens to it when a visitor navigates. One core, six ways in.

> This question is so banal, but seemed worthy of attention in that neither geometry, nor algebra, nor even a `<script>` tag was sufficient to solve it.
>
> -- (probably) Euler

## Vanilla JS

[`@relate/contrib-web@0.1.2`](https://www.npmjs.com/package/@relate/contrib-web/v/0.1.2) puts a Relate database in any web page.

- The database runs in a dedicated worker, so the page never freezes. If the worker crashes or a query times out, the client replaces it and re-runs your live subscriptions. You write no retry code.
- A D3-compatible graph object of nodes and links, validated in the build and loaded with two fixed statements.
- Two navigation profiles: `client-routing` keeps one instance for the whole visit, `multi-page` starts one per page and restores from a stored copy.
- Application graphs are named, durable graphs the visitor writes to, with versioned migrations, export and import.

```bash
pnpm add @relate/contrib-web @relate/relate-wasm
```

Every package below builds on this one. [Source](https://github.com/relatedb/relate-contrib/tree/main/packages/web).

## Astro

[`@relate/contrib-astro@0.1.2`](https://www.npmjs.com/package/@relate/contrib-astro/v/0.1.2) turns your content into a graph at build time.

A graph source is a module that may use `astro:content`. The build validates it and publishes it as static files named by their hash, so a content change invalidates every stored copy. Declare a graph once for the whole site, or inline with `<GraphData>` for a single recipe, notebook or dashboard. `onPage` ties a page's clients to the `ClientRouter`. For Astro 7, static output. [Source](https://github.com/relatedb/relate-contrib/tree/main/packages/astro).

## Next.js

[`@relate/contrib-nextjs@0.1.3`](https://www.npmjs.com/package/@relate/contrib-nextjs/v/0.1.3) serves graphs built from your content and gives React components hooks to query them.

Next can't inject routes, so you own one small route file and the package supplies `createGraphRoute`, a `RelateProvider` and the hooks. It works with Turbopack and webpack, in a static export or on the Node server, with or without a `basePath`. The hooks render a placeholder first and read after mount, so hydration stays quiet. For Next 16, app router. [Source](https://github.com/relatedb/relate-contrib/tree/main/packages/nextjs).

## SvelteKit

[`@relate/contrib-sveltekit@0.1.2`](https://www.npmjs.com/package/@relate/contrib-sveltekit/v/0.1.2) prerenders graphs and gives components reactive access to a client.

One `+server.ts` with `prerender = true` writes the graph into your static output, under `adapter-static` or `adapter-node`. Components get `RelateProvider`, `GraphData`, `useGraph` and `useQuery`, written for Svelte 5 runes. A server-only catalog keeps graph sources out of the browser bundle. For SvelteKit 3. [Source](https://github.com/relatedb/relate-contrib/tree/main/packages/sveltekit).

## Observable Framework

[`@relate/contrib-observable@0.1.2`](https://www.npmjs.com/package/@relate/contrib-observable/v/0.1.2) makes a graph query a notebook cell.

Framework has no plugin interface, so the package is three entries you call from your own files: loaders that place the database and its worker, `open`, which ties a client to a cell, and result helpers. Query with the `cypher` tagged template, and the rows come back shaped for Plot, Inputs, d3 and DuckDB. The client is destroyed when a cell re-runs. There's a graph shape for force layouts too. For Framework 1.x, in preview and static builds. [Source](https://github.com/relatedb/relate-contrib/tree/main/packages/observable).

## react-admin

[`@relate/contrib-react-admin@0.1.2`](https://www.npmjs.com/package/@relate/contrib-react-admin/v/0.1.2) is a react-admin data provider over the embedded graph. An admin app with no backend.

Declare your resources, with their fields and references, and you get lists, filters, search, paging, edit forms and relation pickers. Each is translated into a parameterised statement. Records persist in the visitor's browser and survive a reload. The `demos/react-admin` app shows companies, people and projects, and an `onStatement` hook logs every statement it runs. For react-admin 5. [Source](https://github.com/relatedb/relate-contrib/tree/main/packages/react-admin).

## Phaser

[`@relate/contrib-phaser@0.1.2`](https://www.npmjs.com/package/@relate/contrib-phaser/v/0.1.2) is for a game whose world is a graph.

A game loop wants an answer every frame, and a worker answers when it's ready. Four pieces bridge the two: `Bridge` sends statements in order without the loop awaiting, `ReplyCache` is the store the loop reads and applies optimistic changes with rollback, `createThrowawayClient` gives an attract mode or tutorial its own in-memory graph, and `versionWatch` redraws only when the cache changes. They were lifted out of the path explorer demo, where an explorer extends a thread across a hidden hex map and the world, rules and score all live in the graph. For Phaser 4. [Source](https://github.com/relatedb/relate-contrib/tree/main/packages/phaser).

Relatedly,\
Archie & The Chords
