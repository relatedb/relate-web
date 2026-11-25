# ADR-0075: Release posts are drafted by an agent into the release's pull request

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

The post is drafted by `release-post.yml`, which `engine-release.yml` calls as a job on the same
`relate-release` poke (core releases only). It reads the release notes, installs the release's
binary, and runs a headless agent with a checked-in prompt that points at `BLOG-VOICE.md`, the
tone contract and the existing release posts. The agent writes one file, `relate-X-Y-Z.md`, and
runs each CLI example it shows. It reports which examples ran and which could not (client-language
examples). The drafted file goes to the docs refresh job as an artifact, and the refresh adds it
to its own pull request, with the report as a section of the body. A release makes one pull
request, and merging it publishes the post. Run by hand with a version, `release-post.yml` opens
its own pull request.

- The drafting job has a read-only token and the model credential; the job that opens a pull
  request has the write token and no model. Only the post leaves the drafting job, and the job
  fails if the agent changed anything else.
- The release notes are data to summarise, never instructions to the agent.
- A release that already has a post, a draft or prerelease, and a run with no credential or no
  pinned agent package are skipped, not failed. A failed or skipped draft never stops the refresh:
  its pull request opens without the post.
- The drafting job runs before the refresh starts, so the refresh pull request waits for it.

## Alternatives considered

- **A separate workflow that opens its own pull request.** The first shape of this decision. A
  release then made two pull requests (the docs refresh and the post) to review and merge, with
  two sets of checks. Rejected: one pull request per release is easier to review, and the
  reusable-workflow call keeps the model job isolated from the refresh all the same.
- **Draft the post inside the refresh job.** Rejected: the refresh's contract is that no agent
  writes anything in it, and the model credential would then sit in the job that builds clients.
- **A template filled from the release notes, no model.** Reasonable: deterministic and free.
  Rejected: the posts are curated, not a copy of the notes, and the result would not read as
  Archie.
- **Commit the post straight to `main`.** Rejected: a post is a public claim about the product,
  and the agent can be wrong about an example it could not run.
- **Write the posts by hand.** Rejected as the default: it is what we did for the backfill and it
  does not keep pace with releases. A person can still replace the draft in the pull request.

## Consequences

- Each core release produces one pull request, the docs refresh with the draft post in it; review
  is reading the post against the notes and the unverified list, then merging.
- The model account is spent once per release, only here. Setting `ANTHROPIC_API_KEY` and the
  `RELEASE_POST_AGENT_PACKAGE` variable turns the workflow on; until then it skips.
- `BLOG-VOICE.md` and the existing release posts are now also the agent's instructions, so a change
  to either changes what the agent writes.
- The by-hand run has been exercised on a past release, which fixed the agent's write permission
  and the binary on its path. The combined path (the call from `engine-release.yml`) is a dry run
  away from confirmed.
