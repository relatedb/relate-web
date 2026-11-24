// The blog's posts (ADR-0073): published posts, newest first, and the small formatters the
// index, the post page, the feed and the sitemap share. Drafts show in dev only.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Published posts, newest first. In production a draft is left out; the dev server shows it. */
export async function posts(): Promise<Post[]> {
  const all = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** Shown in the index, the feed and the sitemap: neither a draft nor unlisted. */
export const isListed = (post: Post) => !post.data.draft && !post.data.unlisted;
export const postPath = (post: Post) => `/blog/${post.id}/`;
/** `YYYY-MM-DD`, as the dates are written. */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const longDate = (d: Date) => new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(d);
