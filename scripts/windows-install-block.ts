// Writes the install page's Windows install block (WINDOWS_INSTALL_SCRIPT in
// src/components/docs/install.ts, ADR-0064) to a file, for
// .github/workflows/docs-windows-install.yml to paste into PowerShell.
//
//   node scripts/windows-install-block.ts <out.ps1> [--wrong-key]
//
// --wrong-key swaps the pinned signing key for another ed25519 key, so the
// workflow can show that a signature from any other key installs nothing.
import { writeFileSync } from 'node:fs';

import { SIGNING_KEY, WINDOWS_INSTALL_SCRIPT } from '../src/components/docs/install.ts';

const [out, flag] = process.argv.slice(2);
if (!out || (flag !== undefined && flag !== '--wrong-key')) {
  console.error('usage: node scripts/windows-install-block.ts <out.ps1> [--wrong-key]');
  process.exit(2);
}

// An ed25519 public key that signs nothing relate publishes.
const OTHER_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINLzP/dVT08S+F2HsTVR/uQ3DtOskpRcIMTiFOFLj22J relate-release';

let block = WINDOWS_INSTALL_SCRIPT;
if (flag === '--wrong-key') {
  if (!block.includes(SIGNING_KEY)) throw new Error('the Windows install block does not carry SIGNING_KEY');
  block = block.replace(SIGNING_KEY, OTHER_KEY);
}
writeFileSync(out, block + '\n');
console.log(`wrote ${out}${flag ? ` (${flag})` : ''}`);
