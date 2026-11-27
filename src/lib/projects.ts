// The projects browser (ADR-0076): GitHub repositories tagged with the `relate` topic, listed
// and ranked. Pure (no store, no Node imports): the selection and the types. The store is projects-store.ts.

/** A repository as the page shows it. */
export interface Project {
  fullName: string;
  url: string;
  description: string;
  stars: number;
  language: string | null;
  /** ISO timestamp of the last push. */
  pushedAt: string;
  /** The repository's topics, lowercase and sorted (set by `select`; not read back for the page). */
  topics?: string[];
}

/** The fields the GitHub search API returns that the selection reads. */
export interface RawRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
  private?: boolean;
  topics?: string[];
  owner: { login: string };
}

/** Owners left out: the project's own repositories, which are not community projects. */
export const EXCLUDED_OWNERS = ['relatedb'];

/**
 * Whether the page is public in the sitemap and to search engines. Off while the page is shared
 * for review; turn it on when it is linked from the site.
 */
export const PROJECTS_LISTED = false;

export const DESCRIPTION_MAX = 200;

const clip = (s: string) => (s.length > DESCRIPTION_MAX ? `${s.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : s);

/**
 * The repositories worth listing: not a fork, archived or private, with a description (a small
 * quality bar) and not owned by the project. Names compare case-insensitively, as GitHub's do.
 * A repository to leave out by hand is marked `hidden` in the store, not here.
 */
export function select(raw: RawRepo[]): Project[] {
  const owners = new Set(EXCLUDED_OWNERS.map((o) => o.toLowerCase()));
  const seen = new Set<string>();
  const out: Project[] = [];
  for (const r of raw) {
    const description = (r.description ?? '').replace(/\s+/g, ' ').trim();
    const key = r.full_name.toLowerCase();
    if (r.fork || r.archived || r.private || !description) continue;
    if (owners.has(r.owner.login.toLowerCase()) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      fullName: r.full_name,
      url: r.html_url,
      description: clip(description),
      stars: r.stargazers_count,
      language: r.language,
      pushedAt: r.pushed_at,
      topics: [...new Set((r.topics ?? []).map((t) => t.toLowerCase()))].sort(),
    });
  }
  return out;
}
