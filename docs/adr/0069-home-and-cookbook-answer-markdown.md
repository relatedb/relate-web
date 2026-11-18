# ADR-0069: The home page and the cookbook answer Accept: text/markdown

Status: Proposed

Date: 2026-11-18

## Context

A docs URL answers `Accept: text/markdown` with the page's markdown twin (ADR-0005, ADR-0025).
No other page did. An agent that asked the home page for markdown, which is where an agent with
only the origin starts and what a scan for agent readiness tests, received the HTML: about 150 KB
built for a browser, most of it the markup of a console, three animations and a graph view. The
commands the page exists to give sit in a data attribute that a script reads.

The cookbook was halfway there. Every recipe has a markdown file at its own URL, and the index
has an `llms.txt` that lists the recipes, but the page URLs an agent is handed did not negotiate.

Two earlier records assumed the functions stay on the docs. ADR-0025 limits the paths that
invoke a function to the docs and the agent files and counts every such request against the
host's quota. ADR-0068 gives the home page static `Link` headers, with no function on that path.

## Decision

Every page that has a markdown form answers a request that prefers markdown with it:

- `/` with a new twin, `/index.md`.
- `/cookbook/` with the cookbook's `llms.txt`, which is the recipe index as markdown.
- `/cookbook/<slug>/` with the recipe's markdown file.

The rules are ADR-0025's, unchanged: markdown only when the `Accept` header ranks it above
HTML, on `GET` and `HEAD`, the file's bytes, `Vary: Accept`, a private cache, the token estimate,
a canonical link, one log line per markdown answer. There is no `?section=` outside the docs.
A page with no markdown form (the playground, a placeholder, the 404 page) is served as before,
with no function.

The home twin is built with the site, not converted from the HTML. It is the page's sections in
order: each heading and its paragraph, and one line of the twin's own where the page has
something only a browser runs. The install commands and the quickstart steps are the same data
the page renders. The rest of the copy is written twice, and the negotiation check holds the two
together: the page's headings are the twin's, in order, and every paragraph the twin takes from
the page is on the page. The page's head and its `Link` headers name the twin as its markdown
alternate.

A function now runs on the home page and under `/cookbook`. A failure on its markdown branch
falls back to the static file, so the function cannot take the page down for a browser.

## Alternatives considered

- **The host's zone-level conversion of HTML to markdown.** No code and no second copy; the scan's
  own suggestion. Rejected, as in ADR-0005: the home page's commands are not in its visible HTML,
  the result cannot be built or checked in the repository, and it depends on the plan the zone is
  on.
- **Answer `/` with `llms.txt`.** The file exists and the page already names it. Rejected: it is
  32 KB, most of it the CLI reference, and it is a different document from the page that was asked
  for. The twin links it.
- **Convert the built HTML at build time.** One source for the copy. Rejected: the widgets convert
  to noise, and the install tabs would still need a special case.
- **Move every heading and paragraph into data.** No second copy and no check. Rejected for now: it
  rewrites ten designed components to save one check, and the check already fails the build of a
  page that drifts.
- **The home page only.** It is all the scan tests. Rejected: recipes are the pages with the most
  to read as markdown, their files already exist, and one rule for every page is easier to state
  than a list of exceptions.

## Consequences

- Every request for the home page, and every request under `/cookbook` (the recipe pages and the
  JSON files beside them), invokes a function and counts toward the request quota. ADR-0025's
  list of function paths grows by these.
- Changing a heading or a paragraph on the home page means changing the twin; the check names the
  first difference. Adding a section means adding it to both.
- ADR-0068's static headers still reach the HTML answer through the function, and the check
  holds that. The markdown answer carries the canonical link instead.
- GitHub Pages, the interim host, runs no function: there the twin is a file at `/index.md` and
  the page URLs answer HTML only.
- The privacy page's hosting line names the new function paths; the log lines are the kinds it
  already lists.
