# ADR-0076: The projects browser is built from the GitHub `relate` topic

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

- **A data file, refreshed on a schedule.** `scripts/projects.ts` searches GitHub for the topic
  and writes `src/data/projects.json`; the Projects refresh workflow runs it weekly and by hand
  and opens a pull request when the file changed. The page is built from the file, so a visit
  makes no GitHub request.
- **A quality bar, in code.** `select` in `src/lib/projects.ts` drops forks, archived and private
  repositories, ones with no description, the project's own owner, and anything named in
  `src/data/projects-curation.json`. A refresh that would write an empty list fails.
- **Not reviewed, and said so.** The page states that the list is automatic and that the
  projects are their authors', and links an issue to ask for removal; a removal is a line in the
  curation file.
- **Unlisted until linked.** `PROJECTS_LISTED` is off: the page is built and shared for review
  with `noindex`, left out of the sitemap, and not in the navigation or footer. Linking it from
  the site turns the flag on in the same change.

## Alternatives considered

- **Fetch from the GitHub API in the browser.** Always current. Rejected: a runtime dependency
  on a rate-limited API, an anonymous request per visitor, and an empty page when it fails.
- **A hand-curated list.** Highest quality. Rejected as the default: it does not keep pace, and
  authors would have to ask to be added; the exclude list gives the same control where needed.
- **Commit the refresh straight to `main`.** Rejected: the data is other people's text on our
  site, and the pull request is the review (the flow the release refresh already uses).
- **Rank by stars only.** Rejected: most projects are new and have few stars, so the order would
  be near-meaningless; recent activity shows what is alive.

## Consequences

- A repository is listed by adding the topic; no application is needed. Off-topic uses of the
  word appear until they are excluded by hand.
- The weekly pull request is small and routine; a person merges it.
- Descriptions are third-party text, rendered escaped and clipped to 200 characters.
- Turning the page on for search is the `PROJECTS_LISTED` flag, with the link to it.
