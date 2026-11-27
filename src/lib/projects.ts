// The projects browser (ADR-0076): GitHub repositories tagged with the `relate` topic, listed
// and ranked. Pure and free of Node imports, so the refresh script, the page and the tests share it.

/** A repository as the page shows it. */
export interface Project {
  fullName: string;
  url: string;
  description: string;
  stars: number;
  language: string | null;
  /** ISO timestamp of the last push. */
  pushedAt: string;
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
  owner: { login: string };
}

export interface Curation {
  /** Owners left out: the project's own repositories, which are not community projects. */
  excludeOwners: string[];
  /** Repositories left out by hand (`owner/name`): off-topic uses of the word, or ones that should not be featured. */
  exclude: string[];
}

/**
 * Whether the page is public in the sitemap and to search engines. Off while the page is shared
 * for review; turn it on when it is linked from the site.
 */
export const PROJECTS_LISTED = false;

export const DESCRIPTION_MAX = 200;

const clip = (s: string) => (s.length > DESCRIPTION_MAX ? `${s.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : s);

/**
 * The repositories worth listing: not a fork, archived or private, with a description (a small
 * quality bar), not owned by the project and not on the exclude list. Names compare
 * case-insensitively, as GitHub's do.
 */
export function select(raw: RawRepo[], curation: Curation): Project[] {
  const owners = new Set(curation.excludeOwners.map((o) => o.toLowerCase()));
  const names = new Set(curation.exclude.map((n) => n.toLowerCase()));
  const seen = new Set<string>();
  const out: Project[] = [];
  for (const r of raw) {
    const description = (r.description ?? '').replace(/\s+/g, ' ').trim();
    const key = r.full_name.toLowerCase();
    if (r.fork || r.archived || r.private || !description) continue;
    if (owners.has(r.owner.login.toLowerCase()) || names.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      fullName: r.full_name,
      url: r.html_url,
      description: clip(description),
      stars: r.stargazers_count,
      language: r.language,
      pushedAt: r.pushed_at,
    });
  }
  return out;
}

const byName = (a: Project, b: Project) => a.fullName.localeCompare(b.fullName);

/** Most recently pushed first; ties by stars, then name. */
export const byActivity = (list: Project[]): Project[] =>
  [...list].sort((a, b) => b.pushedAt.localeCompare(a.pushedAt) || b.stars - a.stars || byName(a, b));

/** Most stars first; ties by activity, then name. */
export const byStars = (list: Project[]): Project[] =>
  [...list].sort((a, b) => b.stars - a.stars || b.pushedAt.localeCompare(a.pushedAt) || byName(a, b));
