// /blog/rss.xml: the published posts as RSS 2.0, newest first (ADR-0073).
import type { APIRoute } from 'astro';

import { feed } from '../../lib/blog-feed.ts';
import { isListed, posts } from '../../lib/blog.ts';

export const GET: APIRoute = async () =>
  feed({
    title: 'Related Posts',
    description: 'Release notes, engineering write-ups and design decisions from the relate project.',
    selfPath: '/blog/rss.xml',
    linkPath: '/blog/',
    list: (await posts()).filter(isListed),
  });
