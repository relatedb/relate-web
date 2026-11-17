# Runs a Windows install command the site documents and checks what the install
# page and the upgrade reference say happens (ADR-0067). Called by
# .github/workflows/docs-windows-install.yml in Windows PowerShell 5.1 and in
# PowerShell 7, on a machine with no relate installed:
#
#   scripts\windows-install-check.ps1 -Command 'irm https://relatedb.ai/install.ps1 | iex'
#
#   1. the command installs relate.exe in %LOCALAPPDATA%\Programs\relate, puts
#      that folder on the user PATH once, and this session resolves `relate`;
#   2. `relate --version` and one statement run;
#   3. the command run again (the documented upgrade) replaces the binary and
#      leaves one PATH entry;
#   4. `relate upgrade` exits 1 with the message the docs quote, which names
#      -ReinstallLine, and `relate upgrade --check` reports the versions.
#
# A failed check throws, which fails the step.
param(
    [Parameter(Mandatory = $true)][string] $Command,
    # The reinstall line `relate upgrade` prints on Windows: the documented
    # command for cmd and Git Bash, always with the live URL.
    [Parameter(Mandatory = $true)][string] $ReinstallLine
)

$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\relate'
$exe = Join-Path $dir 'relate.exe'

function Assert-That {
    param([bool] $Condition, [string] $Message)
    if (-not $Condition) { throw $Message }
}

# How many entries of the user PATH name the install folder.
function Get-UserPathCount {
    $entries = [Environment]::GetEnvironmentVariable('Path', 'User') -split ';'
    return @($entries | Where-Object { $_.TrimEnd('\') -ieq $dir }).Count
}

# A native command's exit code and its output, stdout and stderr together.
# Windows PowerShell 5.1 turns a native stderr line into an error record, which
# 'Stop' would throw on, so the preference is relaxed for the call.
function Invoke-Native {
    param([string] $Path, [string[]] $Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $lines = & $Path @Arguments 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    return [pscustomobject]@{ Code = $code; Text = ($lines -join "`n") }
}

"PowerShell $($PSVersionTable.PSVersion) ($($PSVersionTable.PSEdition))"
Assert-That (-not (Test-Path -LiteralPath $exe)) "relate.exe is already at $exe; this check needs a machine without relate"

"--- install: $Command"
Invoke-Expression $Command
Assert-That (Test-Path -LiteralPath $exe) "the command did not install $exe"
Assert-That ((Get-UserPathCount) -eq 1) "the user PATH names the install folder $(Get-UserPathCount) times, not once"
$found = Get-Command relate -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
Assert-That ($null -ne $found) 'this session does not resolve relate after the install'
Assert-That ($found.Source -ieq $exe) "this session resolves relate to $($found.Source), not $exe"

'--- relate runs'
$version = Invoke-Native $exe @('--version')
$version.Text
Assert-That ($version.Code -eq 0) "relate --version exited $($version.Code)"
Assert-That ($version.Text -match '^Relate v\d+\.\d+\.\d+') 'relate --version does not open with "Relate v<version>"'
$statement = Invoke-Native $exe @('--mode', 'table', 'RETURN 1 AS ok')
$statement.Text
Assert-That ($statement.Code -eq 0) "a statement exited $($statement.Code)"

"--- the command again (the documented upgrade)"
Invoke-Expression $Command
Assert-That (Test-Path -LiteralPath $exe) "the second run left no $exe"
Assert-That ((Get-UserPathCount) -eq 1) "after a second run the user PATH names the install folder $(Get-UserPathCount) times"
$again = Invoke-Native $exe @('--version')
Assert-That ($again.Code -eq 0) "relate --version exited $($again.Code) after the second run"

'--- relate upgrade on Windows'
$upgrade = Invoke-Native $exe @('upgrade')
$upgrade.Text
Assert-That ($upgrade.Code -eq 1) "relate upgrade exited $($upgrade.Code), not 1"
$expected = "Error: upgrade: self-upgrade is not supported on Windows (a running .exe cannot replace itself); reinstall with the PowerShell installer to upgrade: $ReinstallLine"
Assert-That ($upgrade.Text.Contains($expected)) "relate upgrade does not print the message the docs quote: $expected"
$check = Invoke-Native $exe @('upgrade', '--check')
$check.Text
Assert-That ($check.Code -eq 0) "relate upgrade --check exited $($check.Code), not 0"
Assert-That ($check.Text -match '(?m)^current version: \d+\.\d+\.\d+') 'relate upgrade --check does not report the current version'
Assert-That ($check.Text -match '(?m)^latest release:\s+\d+\.\d+\.\d+') 'relate upgrade --check does not report the latest release'

'every check passed'
exit 0
