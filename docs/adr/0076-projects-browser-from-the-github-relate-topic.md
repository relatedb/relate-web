# ADR-0076: The projects browser is a relate graph built from the GitHub `relate` topic

Status: Proposed

Date: 2026-11-27

## Context

People are building on relate, and the clearest signal is the `relate` topic on GitHub: a
repository carries it when its author wants it found. The site has no place to show them. A list
of other people's repositories on our site is a public claim, so it needs a quality bar and a way
to remove an entry, and a page that calls the GitHub API when a visitor loads it would add a
runtime dependency, a rate limit and a request the visitor did not ask for. The docs and the
cookbook are static and built from files in the repository (ADR-0002).

## Decision

`/projects/` lists the repositories tagged `relate`, ranked by recent activity or by stars, a
switch between two server-rendered lists (CSS only, no script).

- **A relate store, refreshed on a schedule.** The projects are a graph in a directory store,
  `src/data/projects.relate`, committed with the `json` codec: `Project`, `Owner`, `Language` and
  `Topic` nodes, with `OWNED_BY`, `WRITTEN_IN` and `TAGGED` relationships and uniqueness
  constraints. `scripts/projects.ts` searches GitHub for the topic and upserts with `MERGE`
  through the `@relate/relate` client (`src/lib/projects-store.ts`); the Projects refresh
  workflow runs it daily and by hand and opens a pull request when the store changed. A project
  that leaves the topic is marked `listed: false`, not deleted.
- **The page is a query.** `/projects/` opens the store read-only at build and ranks with
  `ORDER BY` (activity or stars), so a visit makes no GitHub request.
- **The client is pinned with the engine.** `@relate/relate` is an exact-version dependency
  that follows `_data/engine.json`: bump it with the release, since a store is written by one
  release and read by the same.
- **A quality bar, then a model screen.** `select` in `src/lib/projects.ts` drops forks, archived
  and private repositories, ones with no description and the project's own owner. A refresh that
  would keep no project fails. Then a model (`claude-haiku-5-5`, `ANTHROPIC_API_KEY`; no sampling parameters, which that model rejects) reads the
  name, description and topics of each new or changed project, and hides anything hateful, sexual,
  harassing, malicious, a scam, an impersonation of relate or Neo4j, or plainly off-topic
  (`src/lib/projects-review.ts`). The text is third-party, so it goes to the model as data in a
  call with no tools, which can only answer with a verdict; an unparseable reply is dropped.
  A new project is `pending` (not shown) until reviewed, and so is a reviewed one whose text
  changed; with no key or a failed call it stays pending. Hiding is a property of the node
  (`hidden`, `hiddenBy`, `hiddenReason`): the model re-shows only what it hid, a person's hide
  stands, and a person who shows a project again sets `override`, which the model never reverses.
  The run's summary lists each project hidden and why. READMEs are not read.
- **A refresh merges itself once its checks pass.** The workflow opens the pull request with
  `RELEASE_PR_TOKEN` so its checks start, waits for them, and squash-merges when they pass; a
  failing check leaves it open. The site's own build is the gate for the data.
- **Not reviewed, and said so.** The page states that the list is automatic and that the
  projects are their authors', and links an issue to ask for removal.
- **Unlisted until linked.** `PROJECTS_LISTED` is off: the page is built and shared for review
  with `noindex`, left out of the sitemap, and not in the navigation or footer. Linking it from
  the site turns the flag on in the same change.

## Alternatives considered

- **Fetch from the GitHub API in the browser.** Always current. Rejected: a runtime dependency
  on a rate-limited API, an anonymous request per visitor, and an empty page when it fails.
- **A JSON data file.** The first shape of this decision. Simple, and diffable. Rejected: the
  site is for a graph database, and the list is a graph (owners, languages, topics); querying it
  with Cypher keeps the page honest about what the product does, and history and filters follow
  without a second format.
- **The `markdown` or `parquet` codec.** `markdown` writes one note per project, so a diff reads
  per file; `parquet` is compact. Rejected for now: `json` keeps one readable file. Its
  `graph.json` is a single line, so a diff needs `--word-diff` or a query; the codec is chosen
  at creation, so changing it later is a re-seed.
- **A hand-curated list.** Highest quality. Rejected as the default: it does not keep pace, and
  authors would have to ask to be added; the exclude list gives the same control where needed.
- **Commit the refresh straight to `main`.** Rejected: the data is other people's text on our
  site, and the pull request's checks are the gate (the flow the release refresh already uses).
- **Leave the pull request for a person to merge.** The first shape. Rejected: a daily pull
  request is a chore, and the model screen and the checks cover what a quick read would.
- **GitHub's auto-merge.** Reasonable. Rejected for now: it needs a repository setting and
  required checks that are not configured; the workflow waits for the checks itself.
- **Screen the README too.** Catches more. Rejected as the start: a much larger prompt-injection
  surface and cost for a first version.
- **Rank by stars only.** Rejected: most projects are new and have few stars, so the order would
  be near-meaningless; recent activity shows what is alive.

## Consequences

- A repository is listed by adding the topic; no application is needed. Off-topic uses of the
  word appear until they are hidden by hand.
- The daily run reuses one pull request (a fixed branch), so at most one is open, and a person merges it when they like; a day with no change opens nothing.
- The repository gains a dependency (`@relate/relate`, a native library; one platform package per
  OS and CPU) and a committed store directory, WAL segment markers included (the docs' rule for
  a store in a repository).
- A refresh rewrites `graph.json` whole, so every refresh pull request shows one changed line.
- A screen is a filter, not a guarantee: a cleverly worded repository can pass, and a false
  positive is hidden quietly. The run summary is where hidden projects show, and an `override` ends a
  dispute.
- The first run after this change reviews every listed project once (they carry no review yet),
  and they stay visible meanwhile.
- Descriptions are third-party text, rendered escaped and clipped to 200 characters.
- Turning the page on for search is the `PROJECTS_LISTED` flag, with the link to it.
