// RSS 2.0 for the blog (ADR-0073), shared by the main feed and the per-tag feeds. Hand-written: the
// feed is a few lines of XML, so there is no dependency to keep current.
import { CANONICAL_ORIGIN } from './cookbook/links.ts';
import { postPath, type Post } from './blog.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A feed of `list` (listed posts, newest first). `selfPath` is the feed's own path; `linkPath` the page it mirrors. */
export function feed(opts: { title: string; description: string; selfPath: string; linkPath: string; list: Post[] }): Response {
  const { title, description, selfPath, linkPath, list } = opts;
  const items = list
    .map((p) => {
      const url = `${CANONICAL_ORIGIN}${postPath(p)}`;
      return `    <item>
      <title>${esc(p.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${p.data.date.toUTCString()}</pubDate>
      <description>${esc(p.data.description)}</description>${p.data.tags.map((t) => `\n      <category>${esc(t)}</category>`).join('')}
    </item>`;
    })
    .join('\n');
  const built = list.length ? `\n    <lastBuildDate>${(list[0].data.updated ?? list[0].data.date).toUTCString()}</lastBuildDate>` : '';
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(title)}</title>
    <link>${CANONICAL_ORIGIN}${linkPath}</link>
    <description>${esc(description)}</description>
    <language>en</language>
    <atom:link href="${CANONICAL_ORIGIN}${selfPath}" rel="self" type="application/rss+xml" />${built}
${items}
  </channel>
</rss>
`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
}
