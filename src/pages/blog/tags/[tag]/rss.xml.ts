// /blog/tags/<tag>/rss.xml: the published posts with one tag, so a language's developers can follow
// just what is for them (ADR-0073). Only tags with a published post get a feed.
import type { APIRoute, GetStaticPaths } from 'astro';

import { feed } from '../../../../lib/blog-feed.ts';
import { isListed, posts, tagCounts, tagLabel, tagPath } from '../../../../lib/blog.ts';

export const getStaticPaths = (async () => {
  const listed = (await posts()).filter(isListed);
  return tagCounts(listed).map(({ tag }) => ({ params: { tag }, props: { tag, list: listed.filter((p) => p.data.tags.includes(tag)) } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { tag, list } = props as { tag: string; list: Awaited<ReturnType<typeof posts>> };
  return feed({
    title: `Related Posts: ${tagLabel(tag)}`,
    description: `Posts tagged ${tagLabel(tag)} from the relate project.`,
    selfPath: `${tagPath(tag)}rss.xml`,
    linkPath: tagPath(tag),
    list,
  });
};
