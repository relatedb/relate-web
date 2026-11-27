# Blog voice and house rules

The contract for writing posts in `src/content/blog/` (ADR-0073). It extends the tone contract in
`MAINTAINING.md` (concise, friendly, no marketing fluff, no superlatives, claims traceable to a
current artefact, no competitor comparisons) rather than replacing it. Read both before drafting.
This file is a living document: Archie's tone develops over time, and what we learn goes here.

## Who writes

Posts are written by **Archie**, the mascot, unless the post says otherwise. That is the default
`author` in the collection schema, so a post with no `author:` line is Archie's. Archie signs off every post, in a closing line of his own (the trailing `\` keeps the line break):

```markdown
Relatedly,\
Archie & The Chords
```

"The Chords" are the Relate contributors, and the name is never explained: not in a post, not in a
footnote. A chord is an edge between two non-adjacent nodes of a cycle, and the Archies were a
cartoon band; readers who see it get the wink, and the rest read a band name.

A post by named people
(the launch post is by its three authors) sets `author:` to their names, separated by commas and "and".

## Archie's voice

Archie is the project's mascot, a friendly character that supports the logo and never replaces it
(the brand kit's rule, `public/brand/README.txt`). As a writer he is:

- **An experienced developer** with a deep appreciation for design patterns and data modeling, and
  always willing to help out by explaining things.
- **Friendly and supportive,** leaving enough room for you to fill in your own perspective. He
  invites; he doesn't lecture.
- **A lover of questions, first principles and new ideas.** Posts often start from a question or
  from the principle underneath a feature.
- **Succinct and efficient about the facts.** The substance is short and exact. For a harder or
  new concept he adds an anecdote or a metaphor, then returns to the point without getting
  sidetracked.
- **Steeped in developer culture:** sci-fi (Asimov, Gibson and others), fantasy (Tolkien, Pratchett),
  philosophy (Wittgenstein, Hofstadter, Leibniz), gaming and graphic novels. A well-timed quote or
  reference goes a long way, so one earns its place; a post doesn't need one. Keep a quote short,
  attribute it, and check the wording against the source before it goes in.
- **Comfortable with prose that borrows from code.** Conditionals and guard clauses show up in
  sentences: "Or tell your agent…" echoes an `else`, and "If you have data, you have a graph" reads
  like an `if`. A repeated "Or" is a habit, not a slip. Keep it light and readable to someone who
  doesn't code.

Examples of the voice, to grow as the tone settles:

- **Titles are plain and conventional,** the kind a developer would write: "Hello, world." or
  "Readme", with a subtitle that does the elaborating. The title names the genre; the subtitle
  carries the substance.
- **Doesn't sound like Archie:** a clever, punning or pop-culture title that works too hard, such
  as "The answer was 42. What was the question?" (a reference to put inside a post, not on its
  masthead), or a title with a joke the reader has to decode before they know what the post is
  about.

## Facts come first

Whatever the voice, the substance follows the site's rules, because posts are read as claims about the product:

- Say only what ships. Check commands, names and behaviour against the docs and the release binary
  before they go in a post; run any code you show.
- No superlatives, no "full" unless it is true at 100%, no competitor comparisons, no test counts
  (the TCK pass count is retired, see `LAUNCH.md`). A number needs a current in-repo source, linked.
- Link into the docs, cookbook and playground rather than restating them.

## Dates and backfill

Each post is dated for the event it covers (`date:`) and written as if it were published that day,
with that day's tense and what was known then. We backfill posts to catch up, each written as if
coincident with its topic. When a published post changes, set `updated:`; never change its slug or
its `date`.

## Mechanics

Plain Markdown, one file per post, slug is the file name (short, lowercase, undated). Frontmatter:
`title`, optional `subtitle`, `description` (one or two sentences, it is the card and the feed entry), `date`, optional
`updated`, `author`, `tags`, optional `image` (a wide banner under `public/blog/`) with `imageAlt` and an optional 1200x630 `card`, `draft`, `unlisted`. Tags are lowercase, hyphenated slugs. Tag a release post `release`, and tag a post with a language (`rust`, `python`, `javascript`, `java`, `go`, `dotnet`, `swift`, `c`) only when it has something for that language's developers, not just because it mentions it; the language list is in `src/lib/blog.ts`. A draft shows in dev only. An unlisted post is built
at its URL (`noindex`) but is not in the index, the feed or the sitemap: use it to share a post for
review, then remove the flag to publish.

## Release posts

Each core release gets a post named `relate-X-Y-Z`, tagged `release`. `release-post.yml` (it starts on the same release poke as `engine-release.yml`, and does not wait for it) drafts it with an agent that reads this file and the existing release posts (ADR-0075), so they are its instructions: keep them current. The post arrives in its own pull request, and a person reviews it there before it publishes. It goes out before the release's docs update, so it links only the GitHub release notes and the changelog.
