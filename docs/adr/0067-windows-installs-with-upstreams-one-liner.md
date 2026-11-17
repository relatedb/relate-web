# ADR-0067: Windows installs with upstream's one-line installer, and CI runs it

Status: Proposed

Date: 2026-11-17

## Context

ADR-0064 gave Windows readers a PowerShell block on the install page, written and tested here,
"until upstream ships an installer". Upstream ships one from relate 1.0.2: `install.ps1`, which
makes `install.sh`'s checks in `install.sh`'s order (upstream ADR-0586). ADR-0066 put it at
`https://relatedb.ai/install.ps1` through release discovery and left the pages alone until the
one-line install had been run on Windows from the live URL.

Two installs for one platform had costs. The CLI's own messages give the one-liner: `install.sh`
in Git Bash, `relate upgrade` on Windows, and the skill bundle. The site gave the block. The block
was a second implementation of the release checks, kept in step with upstream by hand. And the
page's Windows facts had drifted, because nothing on macOS or Linux replays them: it still said the
binary needs the Visual C++ runtime, which 1.0.2 stopped needing, and that `relate upgrade --check`
fails on Windows, which it no longer does.

## Decision

The Windows install is upstream's installer, in the two spellings its own header gives:

- in PowerShell, `irm https://relatedb.ai/install.ps1 | iex`;
- from `cmd` or Git Bash, `powershell -ExecutionPolicy ByPass -c "irm https://relatedb.ai/install.ps1 | iex"`.

Both live in one place in the source. The install page's Windows tab shows both. The home hero and
the docs landing show the first. The setup prompt, the AGENTS.md block and `llms.txt` give the
second, because an agent on Windows often runs in Git Bash; this amends the two texts ADR-0060
governs. The prompt no longer asks the agent to show the person the install first: the command is
in the prompt the person pasted, as the `install.sh` line is.

The site's own block, its script and its tests are removed. This supersedes ADR-0064.

One workflow runs the documented lines on Windows, in Windows PowerShell 5.1 and PowerShell 7, from
two sources: the `install.ps1` a commit carries, served on loopback with the host's content type,
and the live URL, whose bytes it also compares with the newest release's asset. For each it
checks what the pages state: `install.sh` in Git Bash prints the second line; the first line
installs `relate.exe`, puts its folder on the user `PATH` once and resolves `relate` in the same
window; a second run upgrades in place; `relate upgrade` refuses with the message the docs quote
and `relate upgrade --check` reports versions; the second line installs from `cmd` and from Git
Bash. It runs on changes to the installer or the commands, after each deploy of the main branch,
weekly and by hand. It is not a required check.

## Alternatives considered

- **Keep the block beside the one-liner.** A fallback if the URL is down. Rejected: two installs to
  document and test, and the block repeats checks upstream already owns and tests.
- **Show only the line that starts PowerShell.** One command for every shell. Rejected: run that
  way, the installer cannot put `relate` on the `PATH` of the window that ran it, so the next line
  of the tutorial fails until a new terminal opens.
- **Make the Windows run a required check.** Nothing merges with a broken install. Rejected: it
  needs the network and a published release, so an outage upstream would block unrelated changes.
- **Test only the live URL.** One job. Rejected: a pull request that changes the checked-in
  installer or the commands would be tested against what the site served before it.
- **Repeat upstream's tamper tests here (a wrong key, a wrong hash).** Belt and braces. Rejected:
  upstream's test suite owns the installer's logic, and release discovery already refuses a copy
  that pins another key than `install.sh`'s.

## Consequences

- A Windows reader runs one line, the same one the CLI's messages give, and gets what the block
  gave: the signature check, `relate.exe` on `PATH`, and an upgrade by running it again.
- The site holds no install logic for Windows. A change to the installer arrives with a release,
  and the weekly and post-deploy runs are what notice a break.
- The Windows facts on the install page, the upgrade reference and the limitations page are now
  checked by a workflow, not only read from source. The ARM64 behaviour is still read from the
  installer's text: the runners are x64.
- `LAUNCH.md` closes the Windows installer item. Authenticode signing of the binary stays open
  upstream and does not affect the installer.
