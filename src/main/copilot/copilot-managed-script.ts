import {
  buildWindowsAgentHookPostCommand,
  getSharedManagedScriptPath
} from '../agent-hooks/installer-utils'
import {
  buildPosixHookPayloadCapture,
  buildPosixHookSpoolLines,
  buildWindowsHookEnvironmentGuardLines,
  buildWindowsHookStdinDrainEpilogue
} from '../agent-hooks/hook-stdin-contract'

export function getManagedScriptFileName(): string {
  return process.platform === 'win32' ? 'copilot-hook.cmd' : 'copilot-hook.sh'
}

export function getManagedScriptPath(): string {
  return getSharedManagedScriptPath(getManagedScriptFileName())
}

export function getManagedScript(target: 'local' | 'posix' = 'local'): string {
  if (target === 'local' && process.platform === 'win32') {
    return [
      '@echo off',
      'setlocal',
      // Why: Copilot consumes stdout for some hooks, so answer before any guard can exit.
      'echo {}',
      // Why: the direct registration passes the event as %1; the encoded fallback sets the env var.
      'if not "%~1"=="" set "BBQ_COPILOT_HOOK_EVENT=%~1"',
      // Why: refresh endpoint coordinates for PTYs surviving an Orca restart.
      'if defined BBQ_AGENT_HOOK_ENDPOINT if exist "%BBQ_AGENT_HOOK_ENDPOINT%" call "%BBQ_AGENT_HOOK_ENDPOINT%" 2>nul',
      ...buildWindowsHookEnvironmentGuardLines(),
      buildWindowsAgentHookPostCommand('copilot', [
        '  --data-urlencode "hookEventName=%BBQ_COPILOT_HOOK_EVENT%" ^'
      ]),
      'exit /b 0',
      ...buildWindowsHookStdinDrainEpilogue(),
      ''
    ].join('\r\n')
  }

  return [
    '#!/bin/sh',
    "printf '{}\\n'",
    ...buildPosixHookPayloadCapture(),
    ...buildPosixHookSpoolLines('copilot'),
    // Why: Copilot consumes stdout for some hooks, so stdout is emitted before
    // endpoint refresh, stdin parsing, or the network POST can fail.
    'if [ -n "$BBQ_AGENT_HOOK_ENDPOINT" ] && [ -r "$BBQ_AGENT_HOOK_ENDPOINT" ]; then',
    '  . "$BBQ_AGENT_HOOK_ENDPOINT" 2>/dev/null || :',
    'fi',
    'if [ -z "$BBQ_AGENT_HOOK_PORT" ] || [ -z "$BBQ_AGENT_HOOK_TOKEN" ] || [ -z "$BBQ_PANE_KEY" ]; then',
    '  spool_hook_event',
    '  exit 0',
    'fi',
    // Why: pipe payload to curl's stdin (`payload@-`) instead of an inline
    // `payload=$VALUE` arg, so tens-of-KB tool output stays off the curl
    // command line (EDR command-line false positives). Wire body is identical.
    'printf \'%s\' "$payload" | curl -sS -X POST "http://127.0.0.1:${BBQ_AGENT_HOOK_PORT}/hook/copilot" \\',
    '  --connect-timeout 0.5 --max-time 1.5 \\',
    '  -H "Content-Type: application/x-www-form-urlencoded" \\',
    '  -H "X-Bbq-Agent-Hook-Token: ${BBQ_AGENT_HOOK_TOKEN}" \\',
    '  --data-urlencode "paneKey=${BBQ_PANE_KEY}" \\',
    '  --data-urlencode "tabId=${BBQ_TAB_ID}" \\',
    '  --data-urlencode "launchToken=${BBQ_AGENT_LAUNCH_TOKEN}" \\',
    '  --data-urlencode "worktreeId=${BBQ_WORKTREE_ID}" \\',
    '  --data-urlencode "hookEventName=${BBQ_COPILOT_HOOK_EVENT}" \\',
    '  --data-urlencode "env=${BBQ_AGENT_HOOK_ENV}" \\',
    '  --data-urlencode "version=${BBQ_AGENT_HOOK_VERSION}" \\',
    '  --data-urlencode "payload@-" >/dev/null 2>&1 || spool_hook_event',
    'exit 0',
    ''
  ].join('\n')
}
