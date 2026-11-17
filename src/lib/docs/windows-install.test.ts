// Unit tests for the Windows install (npm run docs:test, ADR-0067): the site
// documents upstream's installer, public/install.ps1 (served per ADR-0066),
// with two command lines. They check the lines are the ones the installer,
// install.sh and the docs' surfaces give, that the installer pins the key
// install.sh pins, and that no surface names a version.
// .github/workflows/docs-windows-install.yml runs the lines on Windows.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  agentsMd,
  setupPrompt,
  SIGNING_KEY,
  SIGNING_KEY_FINGERPRINT,
  tabs,
  WINDOWS_ASSET,
  WINDOWS_INSTALL_COMMAND,
  WINDOWS_INSTALL_COMMAND_ANY_SHELL,
  WINDOWS_INSTALL_URL,
} from '../../components/docs/install.ts';
import { engine, ROOT } from './content.ts';

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const installSh = read('public/install.sh');
const installPs1 = read('public/install.ps1');

test('the two command lines are the installer\'s own', () => {
  assert.equal(WINDOWS_INSTALL_URL, 'https://relatedb.ai/install.ps1');
  assert.equal(WINDOWS_INSTALL_COMMAND, 'irm https://relatedb.ai/install.ps1 | iex');
  assert.equal(WINDOWS_INSTALL_COMMAND_ANY_SHELL, 'powershell -ExecutionPolicy ByPass -c "irm https://relatedb.ai/install.ps1 | iex"');
  // install.ps1 opens with both, as comments.
  const head = installPs1.split('\n').slice(0, 5);
  assert.ok(head.includes(`#   ${WINDOWS_INSTALL_COMMAND}`), 'install.ps1 gives the PowerShell line');
  assert.ok(head.includes(`#   ${WINDOWS_INSTALL_COMMAND_ANY_SHELL}`), 'install.ps1 gives the line for cmd and Git Bash');
  // install.sh prints the second to a reader who runs it on Windows.
  assert.ok(installSh.includes(`WINDOWS_INSTALL_ONE_LINER='${WINDOWS_INSTALL_COMMAND_ANY_SHELL}'`), 'install.sh points Windows at the same line');
});

test('install.ps1 pins the key install.sh pins, and installs the asset the docs name', () => {
  assert.ok(installSh.includes(`SIGNING_KEY='${SIGNING_KEY}'`), 'public/install.sh pins SIGNING_KEY');
  assert.ok(installPs1.includes(`$RelateSigningKey = '${SIGNING_KEY}'`), 'public/install.ps1 pins the same key');
  assert.equal(installPs1.split(SIGNING_KEY).length, 2, 'the key appears once in install.ps1');
  const [stem, ext] = WINDOWS_ASSET.split('amd64');
  assert.ok(installPs1.includes(`"${stem}$arch${ext}"`), `install.ps1 downloads ${WINDOWS_ASSET}`);
});

test('the fingerprint the docs give is the key\'s', () => {
  // OpenSSH's SHA256 fingerprint: unpadded base64 of the SHA-256 of the key blob (`ssh-keygen -lf`).
  const blob = Buffer.from(SIGNING_KEY.split(' ')[1], 'base64');
  assert.equal(`SHA256:${createHash('sha256').update(blob).digest('base64').replace(/=+$/, '')}`, SIGNING_KEY_FINGERPRINT);
});

test('the install page\'s Windows tab shows both lines, in PowerShell, and names no version', () => {
  const cli = tabs(engine().version).find((t) => t.key === 'cli');
  const win = cli?.tabs?.find((t) => t.key === 'windows');
  assert.ok(win, 'the CLI tab has a Windows tab');
  const code = win.blocks.filter((b): b is { code: string; lang: string } => 'code' in b);
  assert.deepEqual(code.map((b) => b.code), [WINDOWS_INSTALL_COMMAND, WINDOWS_INSTALL_COMMAND_ANY_SHELL]);
  assert.ok(code.every((b) => b.lang === 'powershell'));
  const tabText = win.blocks.map((b) => ('p' in b ? b.p : b.code)).join('\n');
  assert.doesNotMatch(tabText, /\d+\.\d+\.\d+/, 'the tab names no version: the installer installs the latest release');
  assert.match(read('src/content/docs/get-started/install.mdx'), /^## Windows notes$/m, 'the tab links the page\'s Windows notes section');
});

test('the setup prompt and the AGENTS.md block give the line that runs from any Windows shell', () => {
  assert.ok(setupPrompt().includes(`\`${WINDOWS_INSTALL_COMMAND_ANY_SHELL}\``));
  assert.ok(agentsMd().includes(`\`${WINDOWS_INSTALL_COMMAND_ANY_SHELL}\``));
});

test('the home hero, the docs landing and llms.txt carry the lines from the one source', () => {
  for (const file of ['src/components/Hero.astro', 'src/pages/docs/index.astro']) {
    const source = read(file);
    assert.ok(source.includes('WINDOWS_INSTALL_COMMAND'), `${file} takes the line from install.ts`);
    assert.ok(!source.includes('install.ps1'), `${file} does not spell the URL itself`);
  }
  assert.ok(read('public/llms.txt').includes(WINDOWS_INSTALL_COMMAND_ANY_SHELL), 'llms.txt gives the line');
});
