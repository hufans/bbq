import { basename, win32 as pathWin32 } from 'node:path'

export const POSIX_SHELL_STARTUP_COMMAND_ENV = 'BBQ_POSIX_SHELL_STARTUP_COMMAND'

export function supportsPosixShellStartupCommand(shellPath: string): boolean {
  const shellName = pathWin32.basename(basename(shellPath)).toLowerCase()
  return shellName === 'bash' || shellName === 'zsh' || shellName === 'fish'
}

export function getBashStartupCommandPromptBlock(): string {
  return `if [[ \${${POSIX_SHELL_STARTUP_COMMAND_ENV}+present} == present ]]; then
  __bbq_remove_startup_command_prompt_hook() {
    local __bbq_item
    local -a __bbq_remaining=()
    if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
      for __bbq_item in "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}"; do
        [[ "$__bbq_item" == "__bbq_run_startup_command" ]] || __bbq_remaining+=("$__bbq_item")
      done
      PROMPT_COMMAND=("\${__bbq_remaining[@]+"\${__bbq_remaining[@]}"}")
    else
      for __bbq_item in "\${__bbq_prompt_command_suffix[@]+"\${__bbq_prompt_command_suffix[@]}"}"; do
        [[ "$__bbq_item" == "__bbq_run_startup_command" ]] || __bbq_remaining+=("$__bbq_item")
      done
      __bbq_prompt_command_suffix=("\${__bbq_remaining[@]+"\${__bbq_remaining[@]}"}")
    fi
  }
  __bbq_run_startup_command() {
    local __bbq_command="$${POSIX_SHELL_STARTUP_COMMAND_ENV}" __bbq_status
    unset ${POSIX_SHELL_STARTUP_COMMAND_ENV}
    __bbq_remove_startup_command_prompt_hook
    unset -f __bbq_remove_startup_command_prompt_hook
    builtin history -s "$__bbq_command" 2>/dev/null || true
    builtin printf '%s\n' "$__bbq_command"
    eval "$__bbq_command"
    __bbq_status=$?
    unset -f __bbq_run_startup_command
    return "$__bbq_status"
  }
  __bbq_append_prompt_command "__bbq_run_startup_command"
fi`
}
