// Scores question-to-Cypher answers on the home console's datasets: each packaged question
// (the `ask` of a demo in src/lib/home/console-scenarios.ts) is answered by a query, the query runs on
// the dataset in the site's WASM engine, and its result is compared with the packaged query's.
//
//   node scripts/text2cypher-score.ts --reference             the packaged queries as answers: must score 100% (checks the scorer)
//   node scripts/text2cypher-score.ts --answers FILE.json     answers by "<dataset>/<question>" (scripts/text2cypher-browser.ts writes them)
//   node scripts/text2cypher-score.ts --prompts               prints the prompt each question gets, for any other model
//
// Levels, best first: "exact" (the same rows, in order when the reference orders them), "same facts" (the
// same values, however the rows and columns are arranged), "runs" (a result, not the right one), "fails".

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { loadEngine } from '../src/lib/cookbook/run.ts';
import { SCENARIOS } from '../src/lib/home/console-scenarios.ts';
import { messagesFor, schemaText } from '../src/lib/home/text2cypher.ts';

type Db = { executeScript(code: string, params: string | null): string[]; reset(): void; free(): void };
type Level = 'exact' | 'same facts' | 'runs' | 'fails';

const { values } = parseArgs({ options: { reference: { type: 'boolean' }, answers: { type: 'string' }, prompts: { type: 'boolean' } } });
const engine = (await loadEngine()) as unknown as { RelateDb: new () => Db };

const last = (envs: string[]) => JSON.parse(envs[envs.length - 1]) as { error?: string; rows?: Record<string, unknown>[]; plan?: unknown };

/** Every scalar inside a value, in a stable order: what "the same facts" compares. */
const leaves = (v: unknown, out: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach((x) => leaves(x, out));
  else if (v && typeof v === 'object') {
    // A node or relationship is its identity, not its properties (those follow from it).
    const o = v as Record<string, unknown>;
    if (o.kind === 'node' || o.kind === 'relationship') out.push(`${o.kind}#${o.id}`);
    else Object.values(o).forEach((x) => leaves(x, out));
  } else out.push(JSON.stringify(v));
  return out;
};
const rowKey = (r: Record<string, unknown>) => JSON.stringify(Object.values(r).map((v) => leaves(v)));
const facts = (rows: Record<string, unknown>[]) => rows.flatMap((r) => leaves(Object.values(r))).sort();

function level(db: Db, reference: string, candidate: string): { level: Level; note: string } {
  let got;
  try {
    got = last(db.executeScript(candidate, null));
  } catch (e) {
    return { level: 'fails', note: String((e as Error).message).split('\n')[0] };
  }
  if (got.error || !got.rows) return { level: 'fails', note: String(got.error ?? 'no rows').split('\n')[0] };
  const want = last(db.executeScript(reference, null)).rows ?? [];
  const ordered = /\border\s+by\b/i.test(reference);
  const a = want.map(rowKey);
  const b = got.rows.map(rowKey);
  const same = ordered ? a.join('\n') === b.join('\n') : [...a].sort().join('\n') === [...b].sort().join('\n');
  if (same) return { level: 'exact', note: '' };
  if (facts(want).join('\n') === facts(got.rows).join('\n')) return { level: 'same facts', note: '' };
  return { level: 'runs', note: `${got.rows.length} rows, wanted ${want.length}` };
}

const answers: Record<string, string> = values.answers ? JSON.parse(readFileSync(values.answers, 'utf8')) : {};
const tally: Record<Level | 'missing', number> = { exact: 0, 'same facts': 0, runs: 0, fails: 0, missing: 0 };
let total = 0;

for (const [id, sc] of Object.entries(SCENARIOS)) {
  const db = new engine.RelateDb();
  for (const s of sc.seed) db.executeScript(s, null);
  console.log(`\n${id}`);
  for (const d of sc.demos) {
    if (!d.ask) continue;
    total++;
    if (values.prompts) {
      const schema = schemaText(db.executeScript('CALL db.schema.nodeTypeProperties()', null).at(-1)!, db.executeScript('CALL db.schema.visualization()', null).at(-1)!);
      console.log(`\n--- ${d.ask}\n${messagesFor(id, schema, d.ask, { skip: d.ask }).map((m) => `[${m.role}]\n${m.content}`).join('\n')}`);
      continue;
    }
    const candidate = values.reference ? d.query : answers[`${id}/${d.ask}`];
    if (!candidate) {
      tally.missing++;
      console.log(`  missing     ${d.ask}`);
      continue;
    }
    const r = level(db, d.query, candidate);
    tally[r.level]++;
    console.log(`  ${r.level.padEnd(11)} ${d.ask}${r.note ? `  (${r.note})` : ''}`);
  }
  db.free();
}

if (!values.prompts) {
  console.log(`\n${total} questions: exact ${tally.exact}, same facts ${tally['same facts']}, runs ${tally.runs}, fails ${tally.fails}, missing ${tally.missing}`);
  if (values.reference && tally.exact !== total) {
    console.error('The packaged queries must match themselves: the scorer is wrong.');
    process.exit(1);
  }
}
