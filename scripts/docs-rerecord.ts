#!/usr/bin/env node
// docs:rerecord: re-records everything the docs record from a relate binary, in the order the
// records depend on each other, so a release's refresh (or a laptop after a docs change) is one
// command instead of a chain someone has to remember.
//
//   RELATE_BIN=<path to relate> npm run docs:rerecord [-- options]
//
// In order (each step is reported; a failed step does not stop the rest, the exit code is 1):
//   cli            docs:cli-check --record --update-fences  the CLI recordings, and the page fences
//                                                          that drifted, rewritten from the binary
//   terminal       the terminal element's fixtures, from the binary
//   mcp            the MCP tryout's recorded server reply, from the binary
//   terminal-facts the terminal element's facts, built from the two data files `cli` records
//   cookbook       cookbook:record                         the recipes' cells and element static forms
//   docs           docs:check --record                     the docs' cells, samples' digests and statics
//   twin           the example page's golden twin (UPDATE=1 on its test)
//   skills         skills:record --dist dist                (--skills; builds first unless --no-build)
//   embeddings     docs:embeddings, then cookbook and docs again, the recipe that reads them
//                  (--embeddings; Linux, the model downloads on first use: on a laptop, run the
//                  Docs embeddings workflow instead)
//   verify         docs:test and docs:check, reported, not fixed (--no-verify skips)
//
// Needs a relate binary for cli, terminal and mcp (the others are skipped without one). Review
// `git diff` afterwards: every change is a change in the engine or the docs' text, and the diff
// is the review. What no recorder can do, a person does: the changelog entry (set
// DOCS_CHANGELOG_PENDING=<version> to let verify pass without it), the surfaces recheck, and any
// code that must follow a new engine field (a verify failure in mcp-tryout.test.ts or
// terminal.test.ts says so).
//
// Options: --only=a,b  --skip=a,b  --skills  --embeddings  --no-build  --no-verify  --list

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = join(import.meta.dirname, '..');
const { values: opt } = parseArgs({
  options: {
    only: { type: 'string' },
    skip: { type: 'string' },
    skills: { type: 'boolean', default: false },
    embeddings: { type: 'boolean', default: false },
    'no-build': { type: 'boolean', default: false },
    'no-verify': { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
  },
});
const csv = (s?: string) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const only = csv(opt.only);
const skip = csv(opt.skip);

function binary(): string | null {
  if (process.env.RELATE_BIN) return existsSync(process.env.RELATE_BIN) ? process.env.RELATE_BIN : null;
  const r = spawnSync('sh', ['-c', 'command -v relate'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}
const bin = binary();

type Cmd = { cmd: string; args: string[]; env?: Record<string, string> };
interface Step {
  id: string;
  label: string;
  needsBinary: boolean;
  /** Off unless asked for. */
  optIn?: 'skills' | 'embeddings' | 'verify';
  run: Cmd[];
}

const node = (...args: string[]): Cmd => ({ cmd: process.execPath, args });
const npm = (...args: string[]): Cmd => ({ cmd: 'npm', args: ['run', '--silent', ...args] });

const STEPS: Step[] = [
  { id: 'cli', label: 'CLI recordings and drifted page fences', needsBinary: true, run: [node('scripts/docs-cli-check.ts', '--record', '--update-fences')] },
  { id: 'terminal', label: 'terminal fixtures', needsBinary: true, run: [node('src/lib/docs/elements/_terminal-record.ts')] },
  { id: 'mcp', label: 'MCP tryout server reply', needsBinary: true, run: [node('src/lib/docs/elements/_mcp-tryout-fixtures.ts')] },
  { id: 'terminal-facts', label: 'terminal facts', needsBinary: false, run: [node('src/lib/docs/elements/_terminal-facts.ts', '--write')] },
  { id: 'cookbook', label: 'cookbook cells and statics', needsBinary: false, run: [npm('cookbook:record')] },
  { id: 'docs', label: 'docs cells, digests and statics', needsBinary: false, run: [npm('docs:check', '--', '--record')] },
  { id: 'twin', label: 'example page twin golden', needsBinary: false, run: [{ cmd: process.execPath, args: ['--test', 'src/lib/docs/docs.test.ts'], env: { UPDATE: '1' } }] },
  {
    id: 'skills',
    label: 'task skills (after a build)',
    needsBinary: true,
    optIn: 'skills',
    run: [...(opt['no-build'] ? [] : [npm('build')]), npm('skills:record', '--', '--dist', 'dist')],
  },
  {
    id: 'embeddings',
    label: 'embeddings, then the recipe and docs that read them',
    needsBinary: false,
    optIn: 'embeddings',
    run: [npm('docs:embeddings'), npm('cookbook:record'), npm('docs:check', '--', '--record')],
  },
  { id: 'verify', label: 'docs:test and docs:check (reported, not fixed)', needsBinary: false, optIn: 'verify', run: [npm('docs:test'), npm('docs:check')] },
];

const selected = (s: Step) => {
  if (only.length) return only.includes(s.id);
  if (skip.includes(s.id)) return false;
  if (s.optIn === 'skills') return opt.skills;
  if (s.optIn === 'embeddings') return opt.embeddings;
  if (s.optIn === 'verify') return !opt['no-verify'];
  return true;
};

if (opt.list) {
  for (const s of STEPS) console.log(`${s.id.padEnd(15)} ${selected(s) ? 'runs ' : 'off  '} ${s.needsBinary ? '(binary) ' : ''}${s.label}`);
  process.exit(0);
}

console.log(`docs:rerecord: ${bin ? `relate binary ${bin}` : 'no relate binary (set RELATE_BIN): cli, terminal and mcp will be skipped'}`);
const rows: { id: string; status: 'ok' | 'failed' | 'skipped'; detail: string }[] = [];
for (const step of STEPS) {
  if (!selected(step)) {
    if (step.optIn && !only.length) rows.push({ id: step.id, status: 'skipped', detail: step.optIn === 'verify' ? 'off (--no-verify)' : `off (add --${step.optIn})` });
    continue;
  }
  if (step.needsBinary && !bin) {
    rows.push({ id: step.id, status: 'skipped', detail: 'no relate binary' });
    continue;
  }
  console.log(`\n▶ ${step.id}: ${step.label}`);
  let failed = '';
  for (const c of step.run) {
    const r = spawnSync(c.cmd, c.args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, ...(bin ? { RELATE_BIN: bin, PATH: `${join(bin, '..')}:${process.env.PATH ?? ''}` } : {}), DO_NOT_TRACK: '1', ...c.env },
    });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n');
    console.log(out.slice(-4).map((l) => `    ${l.slice(0, 160)}`).join('\n'));
    if (r.status !== 0) {
      failed = `${[c.cmd === process.execPath ? 'node' : c.cmd, ...c.args].join(' ')} exited ${r.status}`;
      // Show enough of a failure to act on.
      if (out.length > 4) console.log(out.slice(-40, -4).map((l) => `    ${l.slice(0, 200)}`).join('\n'));
      break;
    }
  }
  rows.push({ id: step.id, status: failed ? 'failed' : 'ok', detail: failed });
}

console.log('\ndocs:rerecord summary');
for (const r of rows) console.log(`  ${r.status.padEnd(8)} ${r.id}${r.detail ? `: ${r.detail}` : ''}`);
const changed = spawnSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' }).stdout?.split('\n').filter(Boolean).length ?? 0;
console.log(`\n${changed} changed file(s); review \`git diff\`.`);
process.exit(rows.some((r) => r.status === 'failed') ? 1 : 0);
