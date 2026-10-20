// Why: kept beside the POSIX tombstone so the generated wrapper text for every platform lives
// in one place, and so the shim-dir module stays under the max-lines limit.
//
// Keep percent signs out of every emitted `rem` line. cmd expands variables inside rem, so a
// comment mentioning %CD% substitutes the working directory into itself. That is harmless at top
// level -- verified on Windows 11 that rem does not re-parse the result, so a cwd of
// `C:\x&pwned&rem` did not execute anything -- but rem handles separators differently inside a
// parenthesized block, and this script now has some.
//
// Keep both templates ASCII-only, comments included. cmd.exe tracks its position in a batch file
// in bytes but advances by decoded character count, so every extra UTF-8 byte shifts the whole
// file: two em dashes in comments made cmd drop the first four characters of every line and the
// script died with "The syntax of the command is incorrect."

const WIN32_PASSTHROUGH_WRAPPER = String.raw`@echo off
rem Why explicit: bare setlocal inherits the caller's delayed-expansion state, and a parent shell
rem started with /V:ON made every PATH entry undergo ! expansion inside the loops below. A literal
rem !CD! entry then became the current directory and a planted git.cmd ran (exit 66), and a
rem legitimate directory whose name contains ! stopped resolving (exit 127). Both proven on
rem Windows 11; both disappear when the wrapper pins its own state.
setlocal DisableDelayedExpansion
set "bbq_real=%BBQ_REAL___BBQ_UPPER_COMMAND__%"
set "bbq_wrapper_dir=%~dp0"
set "bbq_legacy_wrapper_dir=%BBQ_ATTRIBUTION_SHIM_DIR%"
set "bbq_clean_path="
rem Why: holds a single separator so the trailing-separator tests below need neither a literal
rem backslash before a quote (which breaks cmd parsing) nor a sentinel character (which would
rem corrupt any path containing it). Comparisons append a dot so the separator is never
rem adjacent to a closing quote, which would break the parser exactly as a literal would.
set "bbq_sep=\"
rem Why a subroutine, not an "if defined ... " one-liner: cmd expands a whole line before it
rem evaluates the condition, so the substring syntax below still runs against an unset variable
rem and leaves the line mangled. A CALL body is only parsed once it is reached.
rem Why here: the value cannot change mid-run, so normalize once rather than per PATH entry.
set "bbq_legacy_norm="
if defined bbq_legacy_wrapper_dir call :bbq_normalize_legacy_dir
rem Why: an empty PATH leaves the substitution below with an unbalanced quote, which
rem desynchronizes cmd parsing for the rest of the file. Skip the line entirely instead.
if not defined PATH goto :bbq_path_walked
rem Why the variable: CALL re-expands its own command line, so a PATH entry naming the current
rem directory through a percent expression would become that directory before the rooted check
rem below ever saw it, and the cwd would then be searched for __BBQ_COMMAND__. Proven on
rem Windows 11. The expression is spelled out only in the TypeScript comment above: cmd expands
rem percent signs inside rem, so writing one here would substitute a path into the comment.
for %%P in ("%PATH:;=" "%") do (
  set "bbq_entry=%%~P"
  call :bbq_append_path
)
:bbq_path_walked
set "PATH=%bbq_clean_path%"
set "BBQ_ENABLE_GIT_ATTRIBUTION="
set "BBQ_GIT_COMMIT_TRAILER="
set "BBQ_GH_PR_FOOTER="
set "BBQ_GH_ISSUE_FOOTER="
set "BBQ_ATTRIBUTION_SHIM_DIR="
set "BBQ_ATTRIBUTION_BYPASS="
set "BBQ_REAL_GIT="
set "BBQ_REAL_GH="
set "ORCA_ENABLE_GIT_ATTRIBUTION="
set "ORCA_GIT_COMMIT_TRAILER="
set "ORCA_GH_PR_FOOTER="
set "ORCA_GH_ISSUE_FOOTER="
set "ORCA_ATTRIBUTION_SHIM_DIR="
set "ORCA_ATTRIBUTION_BYPASS="
set "ORCA_REAL_GIT="
set "ORCA_REAL_GH="
set "ORCA_REAL___BBQ_UPPER_COMMAND__="
if defined bbq_real for %%G in ("%bbq_real%") do if /I "%%~dpG"=="%~dp0" set "bbq_real="
rem Why: a captured path may be relative, and both "if exist" and the invocation resolve it
rem against the current directory, so an inherited .\__BBQ_COMMAND__.exe would run from the repo.
set "bbq_probe=%bbq_real%"
if defined bbq_real call :bbq_check_rooted
if defined bbq_real if not defined bbq_rooted set "bbq_real="
rem Why: clear a captured path that no longer exists, or the PATH walk below is skipped.
if defined bbq_real if not exist "%bbq_real%" set "bbq_real="
if defined bbq_real goto run
rem Why: an unqualified Windows command lookup searches the current directory before PATH, so a
rem repository-local __BBQ_COMMAND__.exe would win. Walk the cleaned PATH ourselves instead.
if not defined bbq_clean_path goto :bbq_candidates_walked
for %%P in ("%bbq_clean_path:;=" "%") do (
  set "bbq_entry=%%~P"
  call :bbq_try_candidate
)
:bbq_candidates_walked
if not defined bbq_real (
  echo BBQ compatibility wrapper could not locate __BBQ_COMMAND__ on PATH. 1>&2
  exit /b 127
)
:run
"%bbq_real%" %*
exit /b %ERRORLEVEL%

:bbq_normalize_legacy_dir
rem Why the rooted test first: full-path expansion resolves a relative value against the current
rem directory, so a
rem relative BBQ_ATTRIBUTION_SHIM_DIR would let the cwd decide which PATH entry counts as the
rem legacy directory and get a legitimate one skipped. Leaving the normalized value unset makes
rem the reject subroutine below a no-op, which is the safe outcome.
set "bbq_probe=%bbq_legacy_wrapper_dir%"
call :bbq_check_rooted
if not defined bbq_rooted exit /b
for %%G in ("%bbq_legacy_wrapper_dir%") do set "bbq_legacy_norm=%%~fG"
rem Why: full-path expansion preserves a trailing separator; normalize before comparing.
if "%bbq_legacy_norm:~-1%."=="%bbq_sep%." set "bbq_legacy_norm=%bbq_legacy_norm:~0,-1%"
exit /b

:bbq_check_rooted
rem Why: tested in pure batch on purpose. An external tool invoked here would itself be resolved
rem from the current directory, reintroducing the very hijack this guard exists to prevent.
rem Why bbq_probe rather than an argument: see the CALL re-expansion note above.
set "bbq_rooted="
rem Why: an unset probe would leave the substring syntax below unexpanded and mangle the line.
if not defined bbq_probe exit /b
if "%bbq_probe:~0,2%"=="\\" set "bbq_rooted=1"
if "%bbq_probe:~1,2%"==":\" set "bbq_rooted=1"
if "%bbq_probe:~1,2%"==":/" set "bbq_rooted=1"
exit /b

:bbq_try_candidate
if defined bbq_real exit /b
if not defined bbq_entry exit /b
rem Why: a relative entry resolves against the current directory, same exposure as an empty one.
set "bbq_probe=%bbq_entry%"
call :bbq_check_rooted
if not defined bbq_rooted exit /b
for %%G in ("%bbq_entry%") do set "bbq_candidate_dir=%%~fG"
rem Why: full-path expansion preserves a trailing separator, so without normalizing, the
rem self-exclusion below misses a wrapper-dir entry spelled with one and the wrapper resolves
rem to itself, looping forever.
if "%bbq_candidate_dir:~-1%."=="%bbq_sep%." set "bbq_candidate_dir=%bbq_candidate_dir:~0,-1%"
rem Why: the script-dir operator is rebound to this label inside CALL, so compare against the
rem cached wrapper dir captured at top level.
if /I "%bbq_candidate_dir%\"=="%bbq_wrapper_dir%" exit /b
if exist "%bbq_candidate_dir%\__BBQ_COMMAND__.exe" set "bbq_real=%bbq_candidate_dir%\__BBQ_COMMAND__.exe"
if not defined bbq_real if exist "%bbq_candidate_dir%\__BBQ_COMMAND__.cmd" set "bbq_real=%bbq_candidate_dir%\__BBQ_COMMAND__.cmd"
if not defined bbq_real if exist "%bbq_candidate_dir%\__BBQ_COMMAND__.bat" set "bbq_real=%bbq_candidate_dir%\__BBQ_COMMAND__.bat"
exit /b

:bbq_append_path
if not defined bbq_entry exit /b
rem Why: the exported PATH is inherited by the real git and anything it spawns, so a relative
rem entry left here lets the current directory select those tools instead.
set "bbq_probe=%bbq_entry%"
call :bbq_check_rooted
if not defined bbq_rooted exit /b
for %%G in ("%bbq_entry%") do set "bbq_path_entry_dir=%%~fG"
rem Why: full-path expansion preserves a trailing separator; normalize before comparing.
if "%bbq_path_entry_dir:~-1%."=="%bbq_sep%." set "bbq_path_entry_dir=%bbq_path_entry_dir:~0,-1%"
set "bbq_path_entry_dir=%bbq_path_entry_dir%\"
if /I "%bbq_path_entry_dir%"=="%bbq_wrapper_dir%" exit /b
set "bbq_skip_entry="
if defined bbq_legacy_wrapper_dir call :bbq_reject_legacy_dir
if defined bbq_skip_entry exit /b
if defined bbq_clean_path (set "bbq_clean_path=%bbq_clean_path%;%bbq_entry%") else set "bbq_clean_path=%bbq_entry%"
exit /b

:bbq_reject_legacy_dir
rem Why: an unrooted legacy dir leaves this unset, and comparing against a bare separator could
rem only ever misfire.
if not defined bbq_legacy_norm exit /b
if /I "%bbq_path_entry_dir%"=="%bbq_legacy_norm%\" set "bbq_skip_entry=1"
exit /b
`

const POWERSHELL_PASSTHROUGH_WRAPPER = String.raw`$ErrorActionPreference = 'Stop'
$commandName = '__BBQ_COMMAND__'
$realCommand = [Environment]::GetEnvironmentVariable('BBQ_REAL___BBQ_UPPER_COMMAND__')
$wrapperDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$legacyWrapperDir = $env:BBQ_ATTRIBUTION_SHIM_DIR
# Why both separators: the rooted-path test below accepts forward slashes, so a directory
# spelled with a trailing / would miss this lexical exclusion and the wrapper could recurse.
$wrapperDirs = @($wrapperDir, $legacyWrapperDir) | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\', '/') }
$env:PATH = (($env:PATH -split ';') | Where-Object {
  $pathEntry = $_
  # Why: the exported PATH is inherited by the real command and anything it spawns.
  $pathEntry -and ($pathEntry -match '^([A-Za-z]:[\\/]|\\\\)') -and -not ($wrapperDirs | Where-Object {
    [string]::Equals($_, $pathEntry.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase)
  })
}) -join ';'
'BBQ_ENABLE_GIT_ATTRIBUTION', 'BBQ_GIT_COMMIT_TRAILER', 'BBQ_GH_PR_FOOTER', 'BBQ_GH_ISSUE_FOOTER', 'BBQ_ATTRIBUTION_SHIM_DIR', 'BBQ_REAL_GIT', 'BBQ_REAL_GH', 'BBQ_ATTRIBUTION_BYPASS', 'ORCA_ENABLE_GIT_ATTRIBUTION', 'ORCA_GIT_COMMIT_TRAILER', 'ORCA_GH_PR_FOOTER', 'ORCA_GH_ISSUE_FOOTER', 'ORCA_ATTRIBUTION_SHIM_DIR', 'ORCA_REAL_GIT', 'ORCA_REAL_GH', 'ORCA_ATTRIBUTION_BYPASS', 'ORCA_REAL___BBQ_UPPER_COMMAND__' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
# Why: a captured value may be relative, and Test-Path plus invocation resolve it against the cwd.
if ($realCommand -and $realCommand -notmatch '^([A-Za-z]:[\\/]|\\\\)') { $realCommand = $null }
if ($realCommand) {
  try {
    $capturedDir = Split-Path -Parent ([IO.Path]::GetFullPath($realCommand))
    if ([string]::Equals($capturedDir.TrimEnd('\', '/'), $wrapperDir.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase)) {
      $realCommand = $null
    }
  } catch {
    $realCommand = $null
  }
}
if (-not $realCommand -or -not (Test-Path -LiteralPath $realCommand)) {
  # Why: resolve only against the cleaned PATH directories. Ambient lookup could pick up a
  # repository-local git.exe/gh.exe from the current directory.
  $realCommand = $null
  foreach ($dir in ($env:PATH -split ';')) {
    if (-not $dir) { continue }
    # Why: a relative entry resolves against the current directory, same exposure as an empty one.
    # IsPathRooted is not enough: it accepts drive-relative 'C:foo', which resolves against the
    # current directory on that drive. IsPathFullyQualified is absent on Windows PowerShell 5.1,
    # so match the same prefixes the cmd wrapper accepts.
    if ($dir -notmatch '^([A-Za-z]:[\\/]|\\\\)') { continue }
    if ($wrapperDirs | Where-Object { [string]::Equals($_, $dir.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase) }) { continue }
    foreach ($ext in @('.exe', '.cmd', '.bat')) {
      $candidate = Join-Path $dir "$commandName$ext"
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { $realCommand = $candidate; break }
    }
    if ($realCommand) { break }
  }
}
if (-not $realCommand) {
  [Console]::Error.WriteLine("BBQ compatibility wrapper could not locate $commandName on PATH.")
  exit 127
}
& $realCommand @args
exit $LASTEXITCODE
`

function renderWindowsWrapper(template: string, command: string, upperCommand: string): string {
  return template
    .replaceAll('__BBQ_UPPER_COMMAND__', upperCommand)
    .replaceAll('__BBQ_COMMAND__', command)
}

// Why: cmd locates `call :label` targets by byte offset and that lookup is unreliable in
// LF-only files — the same script worked at 2.4 KB and failed with "cannot find the batch label"
// once it grew. Emit CRLF, which is what cmd expects.
function toCrlf(text: string): string {
  return text.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n')
}

export function renderLegacyTerminalWindowsCmdTombstone(command: 'git' | 'gh'): string {
  return toCrlf(renderWindowsWrapper(WIN32_PASSTHROUGH_WRAPPER, command, command.toUpperCase()))
}

export function renderLegacyTerminalWindowsPowerShellTombstone(command: 'git' | 'gh'): string {
  return toCrlf(
    renderWindowsWrapper(POWERSHELL_PASSTHROUGH_WRAPPER, command, command.toUpperCase())
  )
}
