# ADR-0074: Cloudflare Pages is the only host

Status: Accepted

Date: 2026-11-24

## Context

ADR-0012 chose Cloudflare to host the site, and kept GitHub Pages as an interim host "until DNS
moves". DNS has moved: `relatedb.ai` and `www` resolve to Cloudflare, answer `server: cloudflare`,
and serve the content negotiation and Link headers only the Cloudflare Pages Functions provide.
The repository still carried the interim deploy: `deploy-pages.yml` built and published the same
site on every push to `main`, in parallel with `deploy-cf.yml`, so a push ran two full deploys and
three builds in all (with `cookbook.yml`). The GitHub Pages one served nothing and failed more often,
from Pages API errors. Docs and runbooks still described it as the live host.

## Decision

- Cloudflare Pages (`deploy-cf.yml`, project `relate-web`) is the only host.
- `deploy-pages.yml` is deleted, with the `CNAME` and `.nojekyll` files it needed. The sanity check no
  longer expects `dist/CNAME`.
- `deploy-cf.yml` gains `workflow_dispatch`, the manual redeploy the Pages workflow had.
- `docs-negotiation.yml` runs on pull requests and by hand only. On `main`, `deploy-cf.yml` already runs the
  same check before it deploys; on pull requests this workflow is what covers forks, whose runs the deploy
  skips (ADR-0059).
- The README, AGENTS.md, MAINTAINING.md, LAUNCH.md and the runbooks describe the one host.

## Alternatives considered

- **Keep both hosts.** GitHub Pages would be a fallback if Cloudflare were down. Rejected: DNS points at
  Cloudflare, so a second deploy would not take traffic without a DNS change, and it cost a build per push and
  a second set of docs to keep true.
- **Keep the Pages workflow as manual-only.** Rejected: it would drift from the Cloudflare build (the checks, the
  discovery files, the functions) and fail when someone needed it.

## Consequences

- One deploy and, with `cookbook.yml`, two builds per push to `main`, not three.
- Nothing serves from GitHub Pages. Turning off Pages in the repository settings and deleting the
  `github-pages` environment is the remaining step, and a person with admin rights does it (LAUNCH.md).
- A deploy outage is a Cloudflare outage; there is no second host to fall back to. Rolling back is a
  revert (runbooks/rollback-site.md) or an earlier Cloudflare deployment.
- ADR-0068 and ADR-0069 describe GitHub Pages as the interim host; those passages are history.

## Later references

- Supersedes the interim-host part of ADR-0012.
