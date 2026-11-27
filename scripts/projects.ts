// Refreshes src/data/projects.json: the GitHub repositories tagged with the `relate` topic
// (ADR-0076). `npm run projects:refresh`; the Projects refresh workflow runs it weekly.
// Reads GITHUB_TOKEN or GH_TOKEN when set (a higher rate limit); the search needs none.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { select, type Curation, type RawRepo } from '../src/lib/projects.ts';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'src', 'data', 'projects.json');
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
  const body = (await res.json()) as { items: RawRepo[]; incomplete_results?: boolean };
  raw.push(...body.items);
  if (body.items.length < PAGE) break;
}

const curation = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'projects-curation.json'), 'utf8')) as Curation;
const projects = select(raw, curation);
if (raw.length > 0 && projects.length === 0) throw new Error(`the search found ${raw.length} repositories and the selection kept none: refusing to write an empty list`);

// Keep a stable order in the file (by name) so a refresh's diff shows only what changed.
projects.sort((a, b) => a.fullName.localeCompare(b.fullName));
const fetchedAt = new Date().toISOString().slice(0, 10);
writeFileSync(OUT, `${JSON.stringify({ fetchedAt, topic: TOPIC, projects }, null, 2)}\n`);
console.log(`projects: ${projects.length} listed of ${raw.length} tagged '${TOPIC}' (${fetchedAt})`);
