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

/** What the index, the tag pages and the related list show: the dev server shows everything, production only listed posts. */
export async function browsable(): Promise<Post[]> {
  return (await posts()).filter((p) => import.meta.env.DEV || isListed(p));
}

/** The languages a post can be tagged with, in the order the index lists them. */
export const LANGUAGES = ['rust', 'python', 'javascript', 'java', 'go', 'dotnet', 'swift', 'c'] as const;
const LABELS: Record<string, string> = { rust: 'Rust', python: 'Python', javascript: 'JavaScript', java: 'Java', go: 'Go', dotnet: '.NET', swift: 'Swift', c: 'C' };
export const tagLabel = (tag: string) => LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ');
export const tagPath = (tag: string) => `/blog/tags/${tag}/`;

/** Every tag in these posts with its count: languages first (in LANGUAGES order), then the rest A to Z. */
export function tagCounts(list: Post[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of list) for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const rank = (t: string) => { const i = (LANGUAGES as readonly string[]).indexOf(t); return i === -1 ? LANGUAGES.length : i; };
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => rank(a.tag) - rank(b.tag) || a.tag.localeCompare(b.tag));
}

/** Other posts that share tags with this one: most shared first, then newest. */
export function related(post: Post, all: Post[], limit = 3): Post[] {
  const mine = new Set(post.data.tags);
  return all
    .filter((p) => p.id !== post.id)
    .map((p) => ({ p, shared: p.data.tags.filter((t) => mine.has(t)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.p.data.date.getTime() - a.p.data.date.getTime())
    .slice(0, limit)
    .map((x) => x.p);
}
