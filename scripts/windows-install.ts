// The Windows install commands the site documents (WINDOWS_INSTALL_COMMAND and
// WINDOWS_INSTALL_COMMAND_ANY_SHELL in src/components/docs/install.ts,
// ADR-0067), for .github/workflows/docs-windows-install.yml to run on Windows,
// and a stand-in for the site that serves this checkout's installer.
//
//   node scripts/windows-install.ts command [--any-shell] [--origin <url>]
//     prints the command a PowerShell window runs, or with --any-shell the one
//     that starts PowerShell (from cmd or Git Bash). --origin swaps
//     https://relatedb.ai for another origin, so a pull request runs the
//     installer it carries, not the one the live site serves.
//   node scripts/windows-install.ts serve <port>
//     serves public/install.ps1 at http://127.0.0.1:<port>/install.ps1, with
//     the content type the host gives a .ps1 file (application/octet-stream,
//     nosniff), and nothing else.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WINDOWS_INSTALL_COMMAND, WINDOWS_INSTALL_COMMAND_ANY_SHELL, WINDOWS_INSTALL_URL } from '../src/components/docs/install.ts';

const usage = (): never => {
  console.error('usage: node scripts/windows-install.ts command [--any-shell] [--origin <url>]\n       node scripts/windows-install.ts serve <port>');
  process.exit(2);
};

const [mode, ...rest] = process.argv.slice(2);
const site = new URL(WINDOWS_INSTALL_URL);

if (mode === 'command') {
  let anyShell = false;
  let origin: string | null = null;
  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--any-shell') anyShell = true;
    else if (arg === '--origin' && rest.length) origin = rest.shift()!.replace(/\/$/, '');
    else usage();
  }
  const command = anyShell ? WINDOWS_INSTALL_COMMAND_ANY_SHELL : WINDOWS_INSTALL_COMMAND;
  if (command.split(site.origin).length !== 2) throw new Error(`the command does not name ${site.origin} once: ${command}`);
  console.log(origin ? command.replace(site.origin, origin) : command);
} else if (mode === 'serve') {
  const port = Number(rest[0]);
  if (rest.length !== 1 || !Number.isInteger(port) || port < 1 || port > 65535) usage();
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', site.pathname.slice(1));
  createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== site.pathname) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found\n');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'x-content-type-options': 'nosniff' }).end(readFileSync(file));
  }).listen(port, '127.0.0.1', () => console.log(`serving ${file} at http://127.0.0.1:${port}${site.pathname}`));
} else usage();
