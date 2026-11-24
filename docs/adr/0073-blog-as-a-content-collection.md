# ADR-0073: The blog is a content collection of plain Markdown posts

Status: Proposed

Date: 2026-11-24

## Context

The site has linked a `/blog/` placeholder since launch planning. The project needs somewhere for
release notes, engineering write-ups and design decisions that is not the docs (reference and
guides) or the cookbook (runnable recipes). The site already uses Astro content collections for
the docs (ADR-0002) and a plain shared shell, SEO head and indexing switch (ADR-0058), so the blog
can reuse all of that. Posts are prose; the docs' directive pipeline (callouts, tabs, runnable
cells) is not needed and would tie post authors to its rules.

## Decision

The blog is an Astro content collection, `blog`, of plain Markdown files in `src/content/blog/`,
served at `/blog/<slug>/`. The section is titled "Related Posts" wherever it is named (the header and
footer links, the index heading, the feed); the path and the collection stay `blog`.

- Frontmatter is strict: `title`, an optional `subtitle` (shown under the title; the page title
  reads "Title: subtitle", or "Title! Subtitle" with a space when the title ends in punctuation), `description`, `date` (and optionally `updated`), `author`
  (default "Archie", the mascot; BLOG-VOICE.md), `tags` (lowercase slugs; each is a page at `/blog/tags/<tag>/`, each tag page has its own RSS feed at `/blog/tags/<tag>/rss.xml`, and the post page lists the posts that share its tags; language tags such as `python` and `swift` are how a language's developers find what is for them), `draft` and `unlisted`. A draft is shown by the dev server only; a
  production build leaves it out of the index, the feed and the sitemap. An `unlisted` post is built
  at its URL with `noindex` but left out of the index, the feed and the sitemap: a private-by-obscurity
  preview to share for review (the URL is public to anyone who has it).
- A post's slug is its file name, and slugs are short, lowercase, hyphenated and undated: the date
  is in the frontmatter, the page, the feed and the JSON-LD, so the URL stays stable when a post
  is revised. A release post may carry its version (`relate-1-2-0`). A published slug is never
  renamed; a move gets a line in `public/_redirects`, and a revision sets `updated`.
- A tag is a public URL too (`/blog/tags/<tag>/` and its `rss.xml`, which readers subscribe to), so
  the same rule holds: a tag that has appeared on a published post is never renamed or dropped
  without a line in `public/_redirects` for its page and its feed. Adding a tag needs nothing but
  the frontmatter; a new language also goes in `LANGUAGES` and `LABELS` in `src/lib/blog.ts`, for
  its label and its place in the index row.
- A post is one `<article>` with an `<h1>`, a byline and its date, so reader modes and agents get
  the prose without chrome. Its head carries `article` Open Graph data and `BlogPosting` JSON-LD.
- `/blog/` lists posts newest first. With no published post it says so and is `noindex`, so an
  empty blog never reaches a search index; the sitemap lists the blog only once a post is published.
- `/blog/rss.xml` is an RSS 2.0 feed, written by hand (a few lines of XML, no dependency), and every
  page's head links it.
- Code uses Astro's Shiki highlighting with the same light and dark themes as the docs, picked by
  the site's Day/Night theme (`src/styles/base.css`).

## Alternatives considered

- **MDX posts with the docs components.** Rejected: posts are prose, and the docs pipeline's
  constructs and checks (ADR-0002) would constrain authors for no gain. Plain Markdown can move to
  MDX later per file if a post needs a component.
- **`@astrojs/rss`.** A reasonable choice. Rejected: the feed is short enough to own, and it avoids
  a dependency to keep current.
- **Posts outside the collections, parsed like the cookbook.** Rejected: nothing about posts
  needs a custom parser.

## Consequences

- Publishing a post is adding one Markdown file; the index, feed and sitemap follow.
- Posts have no markdown twin, no entry in `llms.txt` and no Pagefind indexing yet. Each is a
  small addition when wanted (ADR-0069 describes the twin for the home page and cookbook).
- The dual-theme Shiki rules moved from `cookbook.css` to `base.css`, since the blog uses them too.
- Per-post social images, tag pages and pagination are not built; the default card applies.
