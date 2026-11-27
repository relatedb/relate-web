# ADR-0075: Release posts are drafted by an agent into their own pull request

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

The post is drafted by `release-post.yml`, which starts on the same `relate-release` poke as the
docs refresh (`engine-release.yml`) and the deploy, for core releases only, and does not wait for
either. It reads the release notes, installs the release's binary (once relatedb.ai offers it), and
runs a headless agent with a checked-in prompt that points at `BLOG-VOICE.md`, the tone contract and
the existing release posts. The agent writes one file, `relate-X-Y-Z.md`, and runs each CLI example
it shows. It reports which examples ran and which could not (client-language examples). A separate
job opens a pull request with the file, and the report is its body. Merging it publishes the post.

- The drafting job has a read-only token and the model credential; the job that opens a pull
  request has the write token and no model. Only the post leaves the drafting job, and the job
  fails if the agent changed anything else.
- The release notes are data to summarise, never instructions to the agent.
- A release that already has a post, a draft or prerelease, and a run with no credential or no
  pinned agent package are skipped, not failed. A failed or skipped draft opens no pull request and
  never touches the refresh.
- **The post is its own track.** The announcement should be out within minutes of the release, and
  the docs refresh (recordings, samples, embeddings, the changelog) takes hours, so the post is not
  part of that pull request and is not held by its checks. Because the docs may not be updated yet,
  the post links only the GitHub release notes and the changelog.

## Alternatives considered

- **One pull request per release, the post inside the docs refresh.** The second shape of this
  decision: easier to review, and the call from `engine-release.yml` kept the model job isolated.
  Rejected after 1.4.0: the refresh took hours and several rounds of fixes, and the announcement
  waited for all of it.
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

- Each core release produces two pull requests: the post, which is quick to read and merge, and
  the docs refresh, which takes as long as it takes. Reviewing the post is reading it against the
  notes and the unverified list.
- The model account is spent once per release, only here. Setting `ANTHROPIC_API_KEY` and the
  `RELEASE_POST_AGENT_PACKAGE` variable turns the workflow on; until then it skips.
- `BLOG-VOICE.md` and the existing release posts are now also the agent's instructions, so a change
  to either changes what the agent writes.
- The by-hand run has been exercised on a past release, which fixed the agent's write permission
  and the binary on its path. The poke-started run, which opens its own pull request, is first
  exercised by the next release.
- The post's pull request still runs the whole required check set (a blog-only fast path is a
  separate piece of work), so it merges when those pass.
