// Refreshes the projects store, src/data/projects.relate: the GitHub repositories tagged with the
// `relate` topic (ADR-0076). `npm run projects:refresh`; the Projects refresh workflow runs it
// daily. Reads GITHUB_TOKEN or GH_TOKEN when set (a higher rate limit); the search needs none.
import { select, type RawRepo } from '../src/lib/projects.ts';
import { openStore, upsert } from '../src/lib/projects-store.ts';

const TOPIC = 'relate';
const PAGE = 100;
const MAX_PAGES = 10; // the search API returns at most 1000 results

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'relate-web-projects',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const raw: RawRepo[] = [];
for (let page = 1; page <= MAX_PAGES; page++) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${TOPIC} fork:false archived:false`)}&sort=stars&order=desc&per_page=${PAGE}&page=${page}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub search failed: ${res.status} ${res.statusText}\n${await res.text()}`);
  const body = (await res.json()) as { items: RawRepo[] };
  raw.push(...body.items);
  if (body.items.length < PAGE) break;
}

const projects = select(raw);
if (raw.length > 0 && projects.length === 0) throw new Error(`the search found ${raw.length} repositories and the selection kept none: refusing to update the store`);

const fetchedAt = new Date().toISOString().slice(0, 10);
upsert(openStore(), projects, fetchedAt);
console.log(`projects: ${projects.length} listed of ${raw.length} tagged '${TOPIC}' (${fetchedAt})`);
