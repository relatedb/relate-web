# ADR-0068: The home page names the agent entry points in Link headers

Status: Proposed

Date: 2026-11-18

## Context

An agent that arrives at `relatedb.ai` with nothing but the origin has to find the files written
for it: `llms.txt`, the agent skills index, the docs. The home page says where they are in its
HTML, with a `<link rel="describedby">` to `llms.txt` and the page's own links. That only helps a
client that downloads and parses the page.

Some clients do not. A `HEAD` request, a fetcher that reads the response headers before deciding
what to do with the body, and the scanners that grade a site for agent use all look for `Link`
response headers (RFC 8288) on the home page, and the site sent none. RFC 9727 names the same
mechanism for a publisher that wants to advertise an API catalog.

Two constraints shape the answer. The site is static: no function runs on the home page
(`_routes.json` limits the Pages Functions to the docs and the agent files, ADR-0025). And the
site has no HTTP API of its own, so the relation types written for APIs describe nothing here.

## Decision

The home page's response carries `Link` headers for three targets, set by the host's static
headers file, which ships in `public/` beside the redirects and routes files:

- `llms.txt`, as `describedby`: the same target and relation the page's head already names.
- The agent skills discovery index, as `describedby`: the machine-readable list of the skills
  that teach an agent to use relate (ADR-0019).
- The docs landing, as `service-doc`: the documentation for people, which also answers with
  markdown to a client that asks for it (ADR-0005).

Only relation types in the IANA registry are used, each with a media type hint. Every target is
a file the build serves, and the headers and the page's head agree; `docs:negotiation-check`
holds both against the built site and against the response under `wrangler pages dev`.

The headers are on the home page only.

## Alternatives considered

- **Advertise an API catalog (`api-catalog`, RFC 9727).** It is the example every guide gives and
  the one a scanner is surest to recognise. Rejected: the site publishes no API, so the catalog
  would be an empty or invented document, and a record that points at nothing misleads the
  agents it is for.
- **`service-desc` for the skills index.** A machine-readable file, like the index. Rejected: the
  relation means a description of a service's interface, such as an OpenAPI document, and the
  index is a list of skill files.
- **Set the headers in the Pages Function.** One place for every response header the site adds.
  Rejected: it puts a function on every home page view, the most requested path, to add a value
  that never changes, and a function failure would then take the home page with it.
- **A transform rule in the host's dashboard.** No file in the build. Rejected: it lives outside
  the repository, is not reviewed, and the local check cannot see it.
- **The same headers on every page.** An agent may land anywhere. Rejected for now: the docs
  pages are answered through the function, where the static headers file is not documented to
  apply, and their heads already name their own `llms.txt` and markdown twin. Widening it is a
  later record.

## Consequences

- A client that reads only the headers of `/` finds `llms.txt`, the skills index and the docs.
- The headers exist on the Cloudflare host only. GitHub Pages, the interim host, sets no custom
  headers and serves the headers file as plain text; nothing else on the site depends on it.
- A target that is renamed or removed fails the check, as does a head that names a different
  `llms.txt` than the headers. Changing either means changing both.
- If the site ever serves an API, an `api-catalog` link is added then, with the catalog.
- `AGENTS.md` lists the file with the other host files, and the negotiation workflow runs when it
  or the home page changes.

## Later references

- Amended by ADR-0069: a function now runs on the home page, to answer `Accept: text/markdown`
  with the page's twin. The static headers still reach the HTML answer, and they also name the
  twin as the page's markdown alternate.
