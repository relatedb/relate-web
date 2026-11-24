// /blog/rss.xml: the published posts as RSS 2.0, newest first (ADR-0073). Hand-written: the feed is
// a few lines of XML, so there is no dependency to keep current.
import type { APIRoute } from 'astro';

import { CANONICAL_ORIGIN } from '../../lib/cookbook/links.ts';
import { isListed, postPath, posts } from '../../lib/blog.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const list = (await posts()).filter(isListed);
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
    <title>Related Posts</title>
    <link>${CANONICAL_ORIGIN}/blog/</link>
    <description>Release notes, engineering write-ups and design decisions from the relate project.</description>
    <language>en</language>
    <atom:link href="${CANONICAL_ORIGIN}/blog/rss.xml" rel="self" type="application/rss+xml" />${built}
${items}
  </channel>
</rss>
`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
};
