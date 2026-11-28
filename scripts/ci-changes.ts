#!/usr/bin/env node
// Prints which CI work a change needs (src/lib/ci/changes.ts), and writes it as step outputs when
// GITHUB_OUTPUT is set. Used by the `changes` job of .github/workflows/cookbook.yml.
//
//   node scripts/ci-changes.ts --from HEAD^1 --to HEAD   the paths `git diff` lists between the two
//   node scripts/ci-changes.ts --full                    everything (a push, a manual run)
//   git diff --name-only a b | node scripts/ci-changes.ts --stdin
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { plan, type Plan } from '../src/lib/ci/changes.ts';

const { values: o } = parseArgs({ options: { from: { type: 'string' }, to: { type: 'string' }, full: { type: 'boolean', default: false }, stdin: { type: 'boolean', default: false } } });

let result: Plan;
if (o.full) {
  result = { profile: 'full', docs: true, build: true, browser: true, reason: 'a push to main or a manual run always runs everything' };
} else {
  let paths: string[];
  if (o.stdin) paths = readFileSync(0, 'utf8').split('\n');
  else if (o.from && o.to) {
    const r = spawnSync('git', ['diff', '--name-only', o.from, o.to], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(`ci-changes: git diff ${o.from} ${o.to} failed: ${r.stderr}`);
      paths = [];
    } else paths = r.stdout.split('\n');
  } else {
    console.error('usage: ci-changes.ts --from <rev> --to <rev> | --stdin | --full');
    process.exit(2);
  }
  result = plan(paths);
}

console.log(`ci-changes: ${result.profile}: ${result.reason}`);
console.log(`  docs checks: ${result.docs}, build: ${result.build}, browser: ${result.browser}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `profile=${result.profile}\ndocs=${result.docs}\nbuild=${result.build}\nbrowser=${result.browser}\n`);
}
