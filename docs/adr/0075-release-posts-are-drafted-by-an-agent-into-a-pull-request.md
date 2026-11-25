# ADR-0075: Release posts are drafted by an agent into a pull request

Status: Proposed

Date: 2026-11-25

## Context

Each relate release gets a post in the blog's established format and voice (ADR-0073,
`BLOG-VOICE.md`). The four backfilled posts were written by hand with the examples run against
the release. The release signal already exists: upstream's release pipeline sends
`relate-release`, which starts `engine-release.yml`, a deliberately deterministic refresh in
which no agent writes anything. A post in Archie's voice needs a model, and a post makes claims
about the product, so a person must read it before it is public.

## Decision

A separate workflow, `release-post.yml`, listens for the same `relate-release` poke (core
releases only), and by hand with a version. It reads the release notes, installs the release's
binary, and runs a headless agent with a checked-in prompt that points at `BLOG-VOICE.md`, the
tone contract and the existing release posts. The agent writes one file, `relate-X-Y-Z.md`, and
runs each CLI example it shows. It reports which examples ran and which could not (client-language
examples). A second job, with no model, opens a pull request holding that one file, with the
report as the body. Merging the pull request is the publication.

- The drafting job has a read-only token and the model credential; the job that opens the pull
  request has the write token and no model. Only the post leaves the drafting job, and the job
  fails if the agent changed anything else.
- The release notes are data to summarise, never instructions to the agent.
- A release that already has a post, a draft or prerelease, and a run with no credential or no
  pinned agent package are skipped, not failed.
- `engine-release.yml` is unchanged: a failure here never holds up the docs refresh or the
  deployed discovery files.

## Alternatives considered

- **Add the step to `engine-release.yml`.** A reasonable choice: one workflow per release.
  Rejected: that workflow's contract is that no agent writes anything, and a model failure or
  spend would then sit inside the refresh the docs depend on.
- **A template filled from the release notes, no model.** Reasonable: deterministic and free.
  Rejected: the posts are curated, not a copy of the notes, and the result would not read as
  Archie.
- **Commit the post straight to `main`.** Rejected: a post is a public claim about the product,
  and the agent can be wrong about an example it could not run.
- **Write the posts by hand.** Rejected as the default: it is what we did for the backfill and it
  does not keep pace with releases. A person can still replace the draft in the pull request.

## Consequences

- Each core release produces a pull request with a draft post; review is reading it against the
  notes and the unverified list, then merging.
- The model account is spent once per release, only here. Setting `ANTHROPIC_API_KEY` and the
  `RELEASE_POST_AGENT_PACKAGE` variable turns the workflow on; until then it skips.
- `BLOG-VOICE.md` and the existing release posts are now also the agent's instructions, so a change
  to either changes what the agent writes.
- Not exercised against a live account yet: the first run is a dry run to confirm the headless
  invocation and the tool allowlist.
