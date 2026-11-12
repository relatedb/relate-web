// Unit tests for the Windows install block (npm run docs:test, ADR-0064): the
// PowerShell counterpart of install.sh on the install page's Windows tab. They
// check it makes install.sh's three checks in install.sh's order, against the
// key install.sh pins, installs nothing before they pass, names no version,
// and that the Windows tab, the setup prompt and the AGENTS.md block carry it
// or point to it. .github/workflows/docs-windows-install.yml runs it on Windows.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { agentsMd, setupPrompt, SIGNER, SIGNING_KEY, tabs, WINDOWS_ASSET, WINDOWS_INSTALL_PAGE, WINDOWS_INSTALL_SCRIPT } from '../../components/docs/install.ts';
import { engine, ROOT } from './content.ts';

const s = WINDOWS_INSTALL_SCRIPT;
const at = (needle: string): number => {
  const i = s.indexOf(needle);
  assert.ok(i >= 0, `the block has ${needle}`);
  return i;
};

test('the Windows block pins the key install.sh pins', () => {
  const installSh = readFileSync(join(ROOT, 'public/install.sh'), 'utf8');
  assert.ok(installSh.includes(SIGNING_KEY), 'public/install.sh pins SIGNING_KEY');
  assert.ok(s.includes(`"${SIGNER} ${SIGNING_KEY}\`n"`), 'allowed_signers names the signer, then the key, LF-terminated');
  assert.ok(s.includes(`-I ${SIGNER} -n ${SIGNER}`), 'the signer identity and namespace are relate-release');
});

test('the Windows block resolves the latest release from releases.json and names no version', () => {
  assert.ok(s.includes('(Invoke-RestMethod https://relatedb.ai/releases.json).latest.tag'));
  assert.doesNotMatch(s, /v?\d+\.\d+\.\d+/);
  assert.ok(!s.includes(engine().version), 'no engine version in the block');
});

test('the Windows block checks the signature, then the signed first line, then the hash, and installs last', () => {
  const sig = at("Start-Process ssh-keygen -ArgumentList '-Y verify");
  const sigFail = at('if ($verify.ExitCode -ne 0) { throw');
  const header = at(`"# ${SIGNER}-version: $tag"`);
  const binary = at(`Invoke-WebRequest "$url/${WINDOWS_ASSET}"`);
  const hash = at('Get-FileHash');
  const install = at('Move-Item');
  assert.ok(sig < sigFail && sigFail < header, 'the signature is checked, and fails closed, before the header is read');
  assert.ok(header < binary, 'the binary downloads only after the manifest is authenticated, as in install.sh');
  assert.ok(binary < hash && hash < install, 'the hash is checked before the binary is moved into place');
  assert.ok(s.startsWith('& {\n') && s.endsWith('\n}'), 'one script block, so a failed check stops the rest of a paste');
  assert.ok(s.includes("$ErrorActionPreference = 'Stop'"));
  for (const line of s.split('\n').filter((l) => /throw /.test(l) && !/ssh-keygen not found/.test(l))) {
    assert.match(line, /installing nothing/, `a failed check says it installs nothing: ${line.trim()}`);
  }
});

test('the Windows block installs relate.exe and puts its folder on the user PATH once', () => {
  assert.ok(s.includes('Move-Item -Force "$tmp\\relate.exe" "$dir\\relate.exe"'));
  assert.ok(s.includes("[Environment]::SetEnvironmentVariable('Path',"));
  assert.ok(s.includes("-notcontains $dir) { [Environment]::SetEnvironmentVariable"), 'the user PATH gains the folder only when it lacks it');
  assert.ok(s.includes('$env:Path = "$env:Path;$dir"'), 'this session finds relate too');
});

test('the install page shows the block on the CLI tab\'s Windows tab, in PowerShell', () => {
  const cli = tabs(engine().version).find((t) => t.key === 'cli');
  const win = cli?.tabs?.find((t) => t.key === 'windows');
  assert.ok(win, 'the CLI tab has a Windows tab');
  assert.ok(win.blocks.some((b) => 'code' in b && b.code === WINDOWS_INSTALL_SCRIPT && b.lang === 'powershell'));
  const page = readFileSync(join(ROOT, 'src/content/docs/get-started/install.mdx'), 'utf8');
  assert.match(page, /^## Windows notes$/m, 'the tab links the page\'s Windows notes section');
});

test('the setup prompt and the AGENTS.md block point Windows to the block', () => {
  assert.ok(WINDOWS_INSTALL_PAGE.endsWith('/docs/get-started/install.md'));
  assert.ok(setupPrompt().includes(`Windows tab of ${WINDOWS_INSTALL_PAGE}`));
  assert.match(setupPrompt(), /show it to me before you run it/);
  assert.ok(agentsMd().includes(`Windows tab of ${WINDOWS_INSTALL_PAGE}`));
});
