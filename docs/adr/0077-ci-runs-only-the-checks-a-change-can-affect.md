# ADR-0077: CI runs only the checks a change can affect

Status: Proposed

Date: 2026-11-27

## Context

The Cookbook workflow is the one required check (ADR-0061). It runs every job on every change:
source checks, the site build, the built-docs checks and four browser shards, 3 to 11 minutes
wall-clock and a flaky browser test now and then. That is the right set for a change to the docs,
the cookbook, a component or the engine copy. It is the wrong set for a change that no job can see:
the daily projects refresh is one data file, a blog post is prose and an image, and a decision
record or a runbook is read by nothing the build runs. A workflow with a `paths` filter cannot be
the required check, since a filtered run never reports and blocks the merge.

## Decision

The workflow keeps no `paths` filter, so `check` always reports. A first job, `changes`, sorts the
paths a pull request touches (`src/lib/ci/changes.ts`, unit-tested) and the other jobs read its
outputs:

- **projects-data**, only `src/data/projects.relate/`: the unit tests, the decision-record check and
  `projects:verify`, which reads the store as the page does. No build, no browser, no docs checks.
- **meta**, only decision records, runbooks, root notes, other workflows and the release-post
  prompt: the unit tests and the decision-record check.
- **blog**, blog posts and their images (with the above): the same, plus the site build and the
  built-docs checks, which validate the content schema and the sitemap. No browser, no docs or
  recipe checks.
- **full**, any other path or none: everything, as before.

`check` passes when `changes` and `source` succeeded and every other job succeeded or was skipped,
and requires the build and the browser whenever `changes` asked for them. A push to `main` and a
manual run are always full, so a wrong rule is caught after the merge, not never. A change to the
Cookbook workflow itself is full.

## Alternatives considered

- **A `paths` filter on the workflow.** Rejected: a workflow that does not run never reports, so it
  cannot be the required status.
- **A third-party path-filter action.** Reasonable. Rejected: the rules are a short function we can
  unit-test, and one fewer action to pin.
- **Per-element browser selection** (map a changed element file to its `ELEMENT_ONLY` case).
  Deferred: more precise, more rules to get wrong; the coarse profiles cover the common cases.
- **Skip the build for blog posts too.** Rejected: the content schema is validated at build, and a
  bad frontmatter must not reach `main`.

## Consequences

- The daily refresh pull request checks in about a minute and no longer meets the browser flake.
  A blog post skips the browser shards and the docs checks.
- A path the rules do not name runs everything, so a new directory is safe by default; making a
  new kind of change light is adding a rule and a test to `changes.ts`.
- The skip rules are an assertion that nothing else reads those paths. A change that makes a build
  or a browser check read one (a page that renders a decision record, say) must update
  `changes.ts` in the same pull request.
- `npm run ci` and a push to `main` still run every step.
