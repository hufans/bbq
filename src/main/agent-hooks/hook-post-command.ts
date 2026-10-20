import type { AgentHookSource } from '../../shared/agent-hook-relay'
import { ORCA_HOOK_RAW_JSON_TRANSPORT } from '../../shared/agent-hook-types'

export function buildPosixAgentHookPostCommand(
  source: AgentHookSource,
  options: { curlCommand?: string; indent?: string } = {}
): string[] {
  const curlCommand = options.curlCommand ?? 'curl'
  const indent = options.indent ?? '  '
  return [
    `if [ "\${BBQ_AGENT_HOOK_TRANSPORT:-}" = "${ORCA_HOOK_RAW_JSON_TRANSPORT}" ] && command -v base64 >/dev/null 2>&1 && command -v tr >/dev/null 2>&1; then`,
    `  bbq_hook_metadata=$(printf '%s\\037%s\\037%s\\037%s\\037%s\\037%s' "$BBQ_PANE_KEY" "$BBQ_TAB_ID" "$BBQ_AGENT_LAUNCH_TOKEN" "$BBQ_WORKTREE_ID" "$BBQ_AGENT_HOOK_ENV" "$BBQ_AGENT_HOOK_VERSION" | base64 | tr -d '\\n') && \\`,
    `  [ -n "$bbq_hook_metadata" ] && \\`,
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${BBQ_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/json" \\`,
    `  ${indent}-H "X-Bbq-Agent-Hook-Token: \${BBQ_AGENT_HOOK_TOKEN}" \\`,
    `  ${indent}-H "X-Bbq-Agent-Hook-Meta-Encoding: base64" \\`,
    `  ${indent}-H "X-Bbq-Agent-Hook-Meta: \${bbq_hook_metadata}" \\`,
    `  ${indent}-H "X-Bbq-Agent-Process: \${bbq_agent_process:-}" \\`,
    `  ${indent}--data-binary @-`,
    'else',
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${BBQ_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/x-www-form-urlencoded" \\`,
    `  ${indent}-H "X-Bbq-Agent-Hook-Token: \${BBQ_AGENT_HOOK_TOKEN}" \\`,
    `  ${indent}--data-urlencode "paneKey=\${BBQ_PANE_KEY}" \\`,
    `  ${indent}--data-urlencode "tabId=\${BBQ_TAB_ID}" \\`,
    `  ${indent}--data-urlencode "launchToken=\${BBQ_AGENT_LAUNCH_TOKEN}" \\`,
    `  ${indent}--data-urlencode "worktreeId=\${BBQ_WORKTREE_ID}" \\`,
    `  ${indent}--data-urlencode "env=\${BBQ_AGENT_HOOK_ENV}" \\`,
    `  ${indent}--data-urlencode "version=\${BBQ_AGENT_HOOK_VERSION}" \\`,
    `  ${indent}--data-urlencode "agentProcess=\${bbq_agent_process:-}" \\`,
    `  ${indent}--data-urlencode "payload@-"`,
    'fi'
  ]
}
