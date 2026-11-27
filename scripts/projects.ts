// Refreshes the projects store, src/data/projects.relate: the GitHub repositories tagged with the
// `relate` topic (ADR-0076). `npm run projects:refresh`; the Projects refresh workflow runs it
// daily. Reads GITHUB_TOKEN or GH_TOKEN when set (a higher rate limit); the search needs none.
// New and changed projects are then screened by a model (ANTHROPIC_API_KEY; without it they stay
// pending, which keeps a new one off the page).
import { select, type RawRepo } from '../src/lib/projects.ts';
import { anthropicCall, review } from '../src/lib/projects-review.ts';
import { applyVerdicts, hiddenByModel, openStore, toReview, upsert } from '../src/lib/projects-store.ts';

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
const store = openStore();
upsert(store, projects, fetchedAt);
console.log(`projects: ${projects.length} listed of ${raw.length} tagged '${TOPIC}' (${fetchedAt})`);

// The guardrails check: only what is new or changed since its last review.
const summary: string[] = [];
const items = toReview(store);
const apiKey = process.env.ANTHROPIC_API_KEY;
if (items.length === 0) {
  console.log('review: nothing new or changed');
} else if (!apiKey) {
  console.log(`::warning::ANTHROPIC_API_KEY is not set: ${items.length} project(s) not reviewed; new ones stay unlisted`);
  summary.push(`- ${items.length} project(s) not reviewed: no API key`);
} else {
  const result = await review(items, anthropicCall(apiKey));
  applyVerdicts(store, result.verdicts, fetchedAt);
  const hidden = result.verdicts.filter((v) => v.verdict === 'hide');
  console.log(`review: ${result.verdicts.length} reviewed, ${hidden.length} hidden, ${result.unreviewed.length} left unreviewed`);
  for (const v of hidden) console.log(`::warning::hidden ${v.fullName} (${v.category}): ${v.reason}`);
  for (const e of result.errors) console.log(`::warning::review call failed: ${e}`);
  summary.push(`- Reviewed ${result.verdicts.length} of ${items.length}; hid ${hidden.length}; ${result.unreviewed.length} left for the next run`);
  for (const v of hidden) summary.push(`  - hid \`${v.fullName}\` (${v.category}): ${v.reason}`);
}
const all = hiddenByModel(store);
if (all.length) summary.push(`- ${all.length} project(s) now hidden by the model in total`);
if (process.env.GITHUB_STEP_SUMMARY && summary.length) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Projects review\n\n${summary.join('\n')}\n`);
}
