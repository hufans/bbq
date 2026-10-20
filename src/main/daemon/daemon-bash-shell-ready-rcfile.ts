import { getPosixOmpShellWrapper } from '../pty/omp-shell-wrapper'
import { ORCA_CLI_POSIX_PATH_RESTORE } from '../../shared/orca-cli-shell-path'
import { MANAGED_DATA_ACCOUNT_POSIX_RESTORE } from '../../shared/managed-data-account-shell'
import { getPosixCodexShellLaunchPreflight } from '../../shared/codex-shell-function'
import { getPosixClaudeShellFunction } from '../../shared/claude-shell-function'
import { BASH_PROMPT_COMMAND_COMPOSITION_BLOCK } from '../bash-prompt-command-composition'
import { BASH_FEATURE_CHANNEL_BLOCK, SHELL_STARTUP_IDENTITY_MARKER_BLOCK } from '../shell-templates'

export function getDaemonBashShellReadyRcfileContent(): string {
  return `# Orca daemon bash shell-ready wrapper
${BASH_FEATURE_CHANNEL_BLOCK}
${SHELL_STARTUP_IDENTITY_MARKER_BLOCK}
# Why a plain variable: the channel is consumed and destroyed in these first
# lines, so nothing this shell later spawns can see or inherit the selection.
__bbq_ready_marker=""
__bbq_has_feature ready && __bbq_ready_marker=1
unset _bbq_shell_features
unset -f __bbq_has_feature
[[ -f /etc/profile ]] && source /etc/profile
if [[ -f "$HOME/.bash_profile" ]]; then
  source "$HOME/.bash_profile"
elif [[ -f "$HOME/.bash_login" ]]; then
  source "$HOME/.bash_login"
elif [[ -f "$HOME/.profile" ]]; then
  source "$HOME/.profile"
fi
# Why: enable bracketed paste so Orca can deliver a multiline startup prompt as
# a single literal paste (ESC[200~…ESC[201~); without it, older readline builds
# treat each embedded newline as Enter and mangle the prompt into PS2
# continuation. Modern readline defaults this on; force it for the rest.
[[ $- == *i* ]] && bind 'set enable-bracketed-paste on' 2>/dev/null
__bbq_restore_agent_teams_path() {
  [[ -n "\${BBQ_AGENT_TEAMS_SHIM_DIR:-}" ]] || return 0
  case "$PATH" in
    "\${BBQ_AGENT_TEAMS_SHIM_DIR}"|"\${BBQ_AGENT_TEAMS_SHIM_DIR}:"*) return 0 ;;
  esac
  export PATH="\${BBQ_AGENT_TEAMS_SHIM_DIR}:$PATH"
}
__bbq_restore_agent_teams_path
${ORCA_CLI_POSIX_PATH_RESTORE}
# Why: user startup files may set the default OpenCode config after Orca's
# spawn env; restore the Orca-managed config dir before the first prompt.
[[ -n "\${BBQ_OPENCODE_CONFIG_DIR:-}" ]] && export OPENCODE_CONFIG_DIR="\${BBQ_OPENCODE_CONFIG_DIR}"
${MANAGED_DATA_ACCOUNT_POSIX_RESTORE}
[[ -n "\${BBQ_MIMOCODE_HOME:-}" ]] && export MIMOCODE_HOME="\${BBQ_MIMOCODE_HOME}"
${getPosixOmpShellWrapper()}
# Why: Codex must keep using Orca's runtime CODEX_HOME after profile scripts.
[[ -n "\${BBQ_CODEX_HOME:-}" ]] && export CODEX_HOME="\${BBQ_CODEX_HOME}"
${getPosixCodexShellLaunchPreflight() + getPosixClaudeShellFunction()}
# Why: emit OSC 133 C/D so terminal-command-lifecycle can drop stale agent
# status when the foreground command exits — mirrors the zsh daemon wrapper.
# Without this, bash users (default on most Linux distros) keep a stuck
# 'working' spinner after the CLI exits without a Stop/SessionEnd hook.
__bbq_initializing_wrapper=1
__bbq_osc133_precmd() {
  local exit_code=$?
  __bbq_in_prompt_command=1
  if [[ -n "\${__bbq_in_command:-}" ]]; then
    printf "\\033]133;D;%s\\007" "$exit_code"
    unset __bbq_in_command
  fi
  printf "\\033]133;A\\007"
  return "$exit_code"
}
__bbq_osc133_preexec() {
  if [[ -n "\${__bbq_prompt_status_capture_command:-}" && "$BASH_COMMAND" == "$__bbq_prompt_status_capture_command" ]]; then
    unset __bbq_initial_prompt
    __bbq_in_legacy_prompt_wrapper=1
    return 0
  fi
  if [[ -n "\${__bbq_initializing_wrapper:-}\${__bbq_in_debug_capture:-}\${__bbq_initial_prompt:-}\${__bbq_in_prompt_dispatch:-}\${__bbq_in_legacy_prompt_wrapper:-}\${__bbq_in_prompt_command:-}" ]]; then
    [[ -z "\${__bbq_initializing_wrapper:-}\${__bbq_in_debug_capture:-}" ]] || return 0
    if [[ -n "\${__bbq_initial_prompt:-}" && "$BASH_COMMAND" == "__bbq_osc133_precmd" ]]; then
      unset __bbq_initial_prompt; return 0
    fi
    if [[ -n "\${__bbq_in_prompt_dispatch:-}" ]]; then
      [[ -n "\${__bbq_dispatching_user_prompt_command:-}" ]] || return 0
      if [[ "\${FUNCNAME[1]:-}" == "__bbq_run_prompt_command_array" ]]; then
        case "$BASH_COMMAND" in
          '(( __bbq_exit_code == 0 ))'|'__bbq_restore_prompt_status "$__bbq_exit_code"'|'eval "$__bbq_prompt_part"'|'eval "$__bbq_final_prompt_command"'|__bbq_dispatching_user_prompt_command=*|__bbq_osc133_precmd|__bbq_osc133_epilogue) return 0 ;;
        esac
      fi
    elif [[ "\${FUNCNAME[1]:-}" == "__bbq_run_prompt_command_array" || "$BASH_COMMAND" == "__bbq_run_prompt_command_array" ]]; then
      return 0
    fi
    [[ -z "\${__bbq_in_legacy_prompt_wrapper:-}" || -n "\${__bbq_dispatching_user_prompt_command:-}" ]] || return 0
    if [[ -n "\${__bbq_in_prompt_command:-}" && "$BASH_COMMAND" == "__bbq_in_debug_capture=1" ]]; then
      return 0
    fi
  fi
  case "\${FUNCNAME[1]:-}" in
    __bbq_osc133_*|__bbq_restore_prompt_status|__bp_*) return 0 ;;
  esac
  case "$BASH_COMMAND" in
    __bbq_osc133_precmd|__bbq_osc133_epilogue) return 0 ;;
    # The prefix is only special while bash-preexec prompt hooks run.
    __bp_*) [[ -n "\${__bbq_in_prompt_command:-}" ]] && return 0 ;;
  esac
  __bbq_run_user_debug_trap
  # Why: a framework (bash-preexec/starship) may replace our DEBUG trap at the
  # first prompt; __bbq_osc133_epilogue re-takes it each prompt and stores the
  # framework's trap here, so the framework's own preexec still runs while our
  # command-start C survives its re-arm.
  if [[ -n "\${__bbq_chained_debug_trap:-}" ]]; then
    eval "$__bbq_chained_debug_trap" || true
  fi
  [[ -z "\${__bbq_in_prompt_command:-}" ]] || return 0
  # Why: a chained trap can invoke us more than once for a single command, so
  # emit C only on the first fire (the __bbq_in_command gate), and never for a
  # prompt-time hook — ours or bash-preexec's __bp_* helpers.
  [[ -z "\${__bbq_in_command:-}" ]] || return 0
  printf "\\033]133;C\\007"
  __bbq_in_command=1
}
# Why: adopt the latest user trap before Orca retakes lifecycle ownership.
__bbq_osc133_epilogue() {
  unset __bbq_in_prompt_command
  __bbq_adopt_outer_debug_trap
  trap '__bbq_osc133_preexec' DEBUG
  # Readline renders PS1 after entering raw mode; prompt hooks still run in cooked mode.
  if [[ -n "$__bbq_ready_marker" ]]; then
    PS1="\${PS1-}"'\\[\\e]777;bbq-shell-ready\\a\\]'
    __bbq_ready_marker=""
  fi
}
${BASH_PROMPT_COMMAND_COMPOSITION_BLOCK}
__bbq_prepend_prompt_command "__bbq_osc133_precmd"
__bbq_append_prompt_command '__bbq_in_debug_capture=1; __bbq_prompt_had_functrace=""; if [[ -o functrace ]]; then __bbq_prompt_had_functrace=1; set +T; fi; __bbq_outer_debug_trap_spec="$(trap -p DEBUG)"; [[ -z "$__bbq_prompt_had_functrace" ]] || set -T; unset __bbq_prompt_had_functrace __bbq_in_debug_capture'
__bbq_append_prompt_command "__bbq_osc133_epilogue"
__bbq_had_functrace=""
[[ -o functrace ]] && __bbq_had_functrace=1
set +T
__bbq_debug_trap_spec="$(trap -p DEBUG)"
[[ -z "$__bbq_had_functrace" ]] || set -T
if [[ -n "$__bbq_debug_trap_spec" && "$__bbq_debug_trap_spec" != "trap -- '__bbq_osc133_preexec' DEBUG" ]]; then
  __bbq_debug_trap_command="\${__bbq_debug_trap_spec#trap -- }"
  __bbq_debug_trap_command="\${__bbq_debug_trap_command% DEBUG}"
  eval "__bbq_user_debug_trap=$__bbq_debug_trap_command"
fi
unset __bbq_debug_trap_spec __bbq_debug_trap_command __bbq_had_functrace
unset -f __bbq_normalize_prompt_command_part __bbq_normalize_prompt_command __bbq_prepend_prompt_command __bbq_append_prompt_command
unset __bbq_prompt_command_normalized
# Why: arm DEBUG after wrapper setup; otherwise bash treats our own rcfile
# commands as a foreground command and emits a fake C/D before the first prompt.
__bbq_initial_prompt=1
trap '__bbq_osc133_preexec' DEBUG
unset __bbq_initializing_wrapper
`
}
