# ADR-0064: Windows gets a verified PowerShell install block until upstream ships an installer

Status: Proposed

Date: 2026-11-12

## Context

`install.sh` runs on macOS and Linux only (upstream ADR-0068), and `relate upgrade` refuses Windows
(upstream ADR-0069 §6). The site's Windows install was one sentence: download
`relate-windows-amd64.exe` and `SHA256SUMS` from the releases page and compare `Get-FileHash` with
its line by eye. That skipped the signature on `SHA256SUMS`, the check `install.sh` makes first
(upstream ADR-0115), so a reader on Windows trusted an unsigned manifest. It also never renamed
the binary or put it on `PATH`, so every later `relate …` command on the page failed. The docs
landing showed the bare file name, and the home hero had no Windows entry. The setup prompt every
copy-for-agent button copies (ADR-0060) is `install.sh` only. Claude Code on Windows runs commands in
Git Bash, where `install.sh` stops with `unsupported OS`. An agent following the prompt there
stopped with no next step.

Upstream tracks a Windows installer (`install.ps1`), a static C runtime and the CLI's Windows
gaps as one piece of work. Until it ships, the site is the only place that can give Windows readers
the checks.

## Decision

The install page's Windows tab carries one PowerShell block, `WINDOWS_INSTALL_SCRIPT` in
`src/components/docs/install.ts`. It makes `install.sh`'s three checks in `install.sh`'s order:

1. It resolves the latest release from `releases.json` (upstream ADR-0571).
2. It verifies the SSHSIG signature on `SHA256SUMS` against the pinned key, with the `ssh-keygen`
   from Windows' OpenSSH Client, fed `SHA256SUMS` on stdin.
3. It checks the signed first line names that release.
4. Only then does it download the binary and check its SHA-256.

It installs `relate.exe` in `%LOCALAPPDATA%\Programs\relate` and adds that folder to the user
`PATH`. It runs as one script block, so a failed check stops the rest of a paste, and it writes
Windows PowerShell 5.1 and PowerShell 7 alike. Like `install.sh` it names no version. Pasting it
again is the Windows upgrade.

The site does not publish an `install.ps1` of its own: installers belong to the release pipeline
(MAINTAINING.md), and a site-owned script at the URL upstream will use would have to be retired.

The block is the site's own code. `.github/workflows/docs-windows-install.yml` runs it on
`windows-latest` in both shells on a paths filter, weekly and by hand, and checks three things:

- a copy signed with another key installs nothing;
- the block installs `relate.exe`, after which `relate --version` and one statement run;
- a second paste replaces the binary without adding the folder to `PATH` twice.

`src/lib/docs/windows-install.test.ts` pins the order of the checks and the key `install.sh` pins.

This amends ADR-0060 for the two texts it governs. The setup prompt's first step tells an agent on
Windows outside WSL to use the block on the install page's Windows tab, and to show it to the
person before it runs it. The AGENTS.md block gains a Windows install line pointing to the same
tab. `llms.txt` points there too. The docs landing's Windows tab and a new Windows tab in the
home hero link the install page. A "Windows notes" section on the install page covers Git Bash,
WSL, the C runtime, SmartScreen, PowerShell quoting, upgrades and extensions. Its facts are read
from the release binary and the CLI source.

## Alternatives considered

- **Keep the manual download with better wording.** No code to maintain. Rejected: it still skips
  the signature, and every reader does the comparison by eye.
- **Serve a site-owned `relatedb.ai/install.ps1`.** A one-line install today. Rejected: installers
  are upstream's, the URL would be taken before upstream ships one, and an unreviewed installer at
  a stable URL is worse than a visible block.
- **Pinned download URLs for one release.** Exact and auditable. Rejected: the page names no version
  (ADR-0060), and pinned steps already live on agent-quickstart.
- **`/releases/latest/download/` URLs instead of `releases.json`.** Simpler. Rejected: nothing binds
  the manifest's signed header to the tag the reader asked for, which is the replay check
  `install.sh` makes.
- **Have the setup prompt's agent run the block without asking.** Fewer round trips. Rejected: the
  block comes from a fetched page (ADR-0013 treats docs as data), so the person sees it first.

## Consequences

- Windows readers get the signature check, a `relate` on `PATH`, and an upgrade path.
- When upstream ships `install.ps1`, a one-line `irm … | iex` replaces the block everywhere it
  appears. The ADR that makes that change supersedes this one.
- `docs-windows-install.yml` is one more non-required workflow; a release that changes asset names,
  the manifest header or the signer identity breaks it, as it breaks `install.sh`.
- `example.twin.md` is re-pinned, since the example page renders the Install block.
