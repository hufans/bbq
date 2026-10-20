/** Capture before Orca inserts its managed-script shell. */
export const CLAUDE_HOOK_PARENT_CAPTURE =
  'BBQ_HOOK_AGENT_PID="${PPID:-}"; export BBQ_HOOK_AGENT_PID; '

export function buildHookProcessCapture(): string[] {
  return [
    'bbq_agent_process=',
    // Why: skip the process reads for Claude sessions outside an Orca pane.
    '[ -z "${BBQ_PANE_KEY:-}" ] || case "${BBQ_HOOK_AGENT_PID:-}" in ""|*[!0-9]*) ;; *)',
    '  if [ -r "/proc/$BBQ_HOOK_AGENT_PID/stat" ]; then',
    '    bbq_agent_stat=$(cat "/proc/$BBQ_HOOK_AGENT_PID/stat" 2>/dev/null) || bbq_agent_stat=',
    '    bbq_agent_boot=$(cat /proc/sys/kernel/random/boot_id 2>/dev/null) || bbq_agent_boot=',
    '    bbq_agent_fields=${bbq_agent_stat##*) }',
    '    bbq_agent_start=$(printf "%s" "$bbq_agent_fields" | awk \'{print $20}\')',
    '    case "$bbq_agent_start" in ""|*[!0-9]*) ;; *)',
    '      [ -z "$bbq_agent_boot" ] || bbq_agent_process=$(printf \'{"pid":%s,"platform":"linux","startTime":"%s:%s"}\' "$BBQ_HOOK_AGENT_PID" "$bbq_agent_boot" "$bbq_agent_start") ;; esac',
    '  elif [ "$(uname -s 2>/dev/null)" = Darwin ]; then',
    // Why: lstart is local time; the host probe pins the same zone so the strings compare.
    '    bbq_agent_start=$(TZ=UTC0 LC_ALL=C /bin/ps -p "$BBQ_HOOK_AGENT_PID" -o lstart= 2>/dev/null | sed \'s/^ *//;s/ *$//\')',
    '    [ -z "$bbq_agent_start" ] || bbq_agent_process=$(printf \'{"pid":%s,"platform":"darwin","startTime":"%s"}\' "$BBQ_HOOK_AGENT_PID" "$bbq_agent_start")',
    '  fi ;;',
    'esac'
  ]
}
