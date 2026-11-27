// Records the MCP tryout's one binary-recorded fixture: the line `relate serve --mcp stdio
// --database :memory:` answers when `read_cypher` is sent `RETURN 1 AS a;  ` (a trailing
// semicolon, which the server keeps in the plan's statement). The unit test
// (src/lib/docs/mcp-tryout.test.ts) compares the tryout's own answer with it, timings masked.
//
//   RELATE_BIN=<path to relate> node src/lib/docs/elements/_mcp-tryout-fixtures.ts
//
// `npm run docs:rerecord` runs this after a release. Review the diff: a changed line is a change
// in the engine's MCP reply, which the tryout's protocol module (_mcp-tryout-protocol.ts) may
// need to follow (a new field goes in its FIELD_ORDER).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { maskTimings, replayEnv } from '../checks/cli.ts';

export const FIXTURES_JSON = 'src/lib/docs/elements/_mcp-tryout-fixtures.json';

const bin = process.env.RELATE_BIN || 'relate';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const base = mkdtempSync(join(tmpdir(), 'mcp-fixtures-'));
try {
  const version = spawnSync(bin, ['--version'], { encoding: 'utf8', env: replayEnv(dirname(bin), base, base) }).stdout?.split('\n')[0] ?? '';
  const input = [
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"docs","version":"0"}}}',
    '{"jsonrpc":"2.0","method":"notifications/initialized"}',
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_cypher","arguments":{"statement":"RETURN 1 AS a;  "}}}',
    '',
  ].join('\n');
  const r = spawnSync(bin, ['serve', '--mcp', 'stdio', '--database', ':memory:'], { input, encoding: 'utf8', env: replayEnv(dirname(bin), base, base), cwd: base, timeout: 60_000 });
  const line = (r.stdout ?? '').split('\n').find((l) => l.startsWith('{"jsonrpc":"2.0","id":2'));
  if (!line || !version.startsWith('Relate v')) {
    console.error(`_mcp-tryout-fixtures: no answer from ${bin} (${version || 'no version'}): ${(r.stderr ?? '').slice(0, 300)}`);
    process.exit(1);
  }
  const fixtures = { $note: 'Recorded by _mcp-tryout-fixtures.ts from the binary named in recorded_with; timings masked.', recorded_with: version, semicolon: maskTimings(line) };
  writeFileSync(join(root, FIXTURES_JSON), `${JSON.stringify(fixtures, null, 2)}\n`);
  console.log(`wrote ${FIXTURES_JSON}: 1 reply, ${version}`);
} finally {
  rmSync(base, { recursive: true, force: true });
}
