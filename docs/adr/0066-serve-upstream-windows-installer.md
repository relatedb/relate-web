# ADR-0066: The site serves upstream's Windows installer beside install.sh

Status: Proposed

Date: 2026-11-17

## Context

From relate 1.0.2, each core release attaches `install.ps1`, the Windows twin of `install.sh`
(upstream ADR-0586). It resolves the release from `releases.json`, verifies the signature on
`SHA256SUMS` against a pinned key, checks the signed version header and the binary's SHA-256, and
only then installs. Upstream's decision names its URL, `https://relatedb.ai/install.ps1`, and says
this site must serve it beside `install.sh`.

The site did not. Release discovery (`scripts/fetch-discovery.sh`) pulled `install.sh`,
`releases.json` and the signed extensions pair, and nothing else. Three published texts already
pointed at the missing URL:

- `install.sh`, which the deploys publish with no review, stops on Windows shells with a message
  that gives the one-line install from that URL.
- The engine's skill bundle, which the site serves and `relate skill install` writes, gives the
  same line.
- `docs:check -- --built` fails a skill that cites a site URL the build does not serve, so the
  release refresh for 1.1.0 could not pass the required check.

ADR-0064 gave Windows readers a verified PowerShell block on the install page "until upstream ships
an installer", and declined a site-owned `install.ps1` because installers belong to the release
pipeline. Upstream has now shipped one.

## Decision

`install.ps1` is a release-discovery file. `fetch-discovery.sh` downloads it from the newest
stable core release, the release `install.sh` comes from, and writes it to `public/` with the other
files, so the deploys publish it at `/install.ps1` with no pull request in the path. The checked-in
copy is a seed, as for `install.sh`, and is never edited here.

The fetch fails closed on one more condition: `install.ps1` must pin the signing key `install.sh`
pins. A release that attaches no `install.ps1` keeps the copy already there, with a line in the
summary, so an older or partial release does not stop a deploy.

This record changes what the site serves, not what its pages tell a reader to run. The install
page's Windows tab keeps the block of ADR-0064, and the home hero keeps its link to that tab, until
the one-line install has been run on Windows from the live URL. The record that moves the pages to
the one-liner supersedes ADR-0064.

## Alternatives considered

- **Leave the URL unserved until the pages move to the one-liner.** One change instead of two.
  Rejected: `install.sh` and the skill already send Windows readers and agents to a 404, and the
  required check fails on every release refresh until the URL resolves.
- **Check the file in and update it in the release refresh pull request.** A reviewed diff for an
  executable. Rejected: `install.sh` goes live with the release through discovery, and an
  `install.ps1` that waits for review would lag it, or pin a key the release no longer uses.
- **Redirect `/install.ps1` to the release asset.** No copy to keep current. Rejected: GitHub Pages,
  the interim host, serves no redirects, and the installer's own comments and the skill name the
  site URL as the place the file lives.
- **Move the install page and the hero to the one-liner in the same change.** Finishes ADR-0064.
  Rejected for now: the check that runs the Windows block in two shells has not run the one-liner,
  and the host's content type for a `.ps1` file is unverified until the first deploy.
- **Teach the check to skip this URL.** No hosting change. Rejected: it hides a broken link that
  readers hit.

## Consequences

- `https://relatedb.ai/install.ps1` resolves after the next deploy, so the line `install.sh` and
  the skill give works; the built-site check passes.
- The site publishes a second installer it does not review. Its integrity rests on the same chain
  as `install.sh`: the release pipeline, and a key check at fetch time.
- `AGENTS.md`, the release-discovery runbook and the launch notes list the file. The first deploy
  after this change needs one manual check from Windows: that `irm https://relatedb.ai/install.ps1`
  returns the script as text on the host in use.
- Windows now has two documented installs for a while: the block on the install page, and the
  one-liner the CLI's own messages give. The superseding record removes the block, its test and its
  workflow.
