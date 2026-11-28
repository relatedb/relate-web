#!/usr/bin/env node
// Reads the committed projects store the way the /projects/ page does and fails when it could not
// be rendered: the fast check for a pull request that changes only the store (the daily refresh),
// in place of a site build. `npm run projects:verify`.
import { fetchedAt, openStore, ranked } from '../src/lib/projects-store.ts';

const problems: string[] = [];
const store = openStore(undefined, { readOnly: true });
const lists = { activity: ranked(store, 'activity'), stars: ranked(store, 'stars') };
if (lists.activity.length !== lists.stars.length) problems.push(`the two rankings differ in length (${lists.activity.length} and ${lists.stars.length})`);
if (lists.activity.length === 0) problems.push('no project is listed');
for (const p of lists.activity) {
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(p.url)) problems.push(`${p.fullName}: url ${p.url}`);
  if (!p.description || typeof p.stars !== 'number' || !Number.isInteger(p.stars) || p.stars < 0) problems.push(`${p.fullName}: description or stars`);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(p.pushedAt)) problems.push(`${p.fullName}: pushedAt ${p.pushedAt}`);
}
const at = fetchedAt(store);
if (!at || !/^\d{4}-\d{2}-\d{2}$/.test(at)) problems.push(`the last refresh day is ${at}`);
if (problems.length) {
  console.error(`projects:verify: ${problems.length} problem(s)\n${problems.slice(0, 20).map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`projects:verify: ${lists.activity.length} listed projects read both ways; refreshed ${at}`);
