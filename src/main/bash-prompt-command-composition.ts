export const BASH_PROMPT_COMMAND_COMPOSITION_BLOCK = `__bbq_normalize_prompt_command_part() {
  local __bbq_value="$1" __bbq_output_name="$2" __bbq_character __bbq_chunk
  local __bbq_value_length=\${#1} __bbq_suffix_length=0 __bbq_backslash_length=0
  local __bbq_output_length __bbq_scan_start
  while (( __bbq_value_length - __bbq_suffix_length >= 1024 )); do
    __bbq_scan_start=$(( __bbq_value_length - __bbq_suffix_length - 1024 ))
    __bbq_chunk="\${__bbq_value:__bbq_scan_start:1024}"
    case "$__bbq_chunk" in
      *[!$' \\t\\n;']*) break ;;
      *) __bbq_suffix_length=$(( __bbq_suffix_length + 1024 )) ;;
    esac
  done
  while (( __bbq_suffix_length < __bbq_value_length )); do
    __bbq_character="\${__bbq_value: -__bbq_suffix_length - 1:1}"
    case "$__bbq_character" in
      ' '|$'\\t'|$'\\n'|';') __bbq_suffix_length=$(( __bbq_suffix_length + 1 )) ;;
      *) break ;;
    esac
  done
  __bbq_output_length=$(( \${#__bbq_value} - __bbq_suffix_length ))
  while (( __bbq_output_length - __bbq_backslash_length >= 1024 )); do
    __bbq_scan_start=$(( __bbq_output_length - __bbq_backslash_length - 1024 ))
    __bbq_chunk="\${__bbq_value:__bbq_scan_start:1024}"
    case "$__bbq_chunk" in
      *[!\\\\]*) break ;;
      *) __bbq_backslash_length=$(( __bbq_backslash_length + 1024 )) ;;
    esac
  done
  while (( __bbq_backslash_length < __bbq_output_length )); do
    __bbq_character="\${__bbq_value:__bbq_output_length - __bbq_backslash_length - 1:1}"
    [[ "$__bbq_character" == '\\' ]] || break
    __bbq_backslash_length=$(( __bbq_backslash_length + 1 ))
  done
  # Preserve the first separator when an odd backslash run escapes it.
  if (( __bbq_suffix_length > 0 && __bbq_backslash_length % 2 == 1 )); then
    __bbq_suffix_length=$(( __bbq_suffix_length - 1 ))
    __bbq_backslash_length=0
  fi
  __bbq_output_length=$(( \${#__bbq_value} - __bbq_suffix_length ))
  __bbq_value="\${__bbq_value:0:__bbq_output_length}"
  # Bash 4.4-5.0 scalar prompt evaluation preserves an odd terminal backslash.
  if (( __bbq_suffix_length == 0 && ((BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 4) || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] == 0)) && __bbq_backslash_length % 2 == 1 )); then
    __bbq_value="$__bbq_value\\\\"
  fi
  printf -v "$__bbq_output_name" '%s' "$__bbq_value"
}
__bbq_restore_prompt_status() {
  return "$1"
}
__bbq_update_user_debug_trap() {
  local __bbq_debug_trap_spec="$1" __bbq_unchanged_debug_trap_spec="$2"
  local __bbq_debug_trap_command
  [[ "$__bbq_debug_trap_spec" != "$__bbq_unchanged_debug_trap_spec" ]] || return 0
  [[ "$__bbq_debug_trap_spec" != "trap -- '__bbq_osc133_preexec' DEBUG" ]] || return 0
  if [[ -z "$__bbq_debug_trap_spec" ]]; then
    __bbq_user_debug_trap=""
    unset __bbq_chained_debug_trap
    return 0
  fi
  __bbq_debug_trap_command="\${__bbq_debug_trap_spec#trap -- }"
  __bbq_debug_trap_command="\${__bbq_debug_trap_command% DEBUG}"
  eval "__bbq_user_debug_trap=$__bbq_debug_trap_command"
  unset __bbq_chained_debug_trap
}
__bbq_run_user_debug_trap() {
  if [[ -n "\${__bbq_user_debug_trap:-}" ]]; then
    eval "$__bbq_user_debug_trap" || true
  fi
}
__bbq_adopt_outer_debug_trap() {
  local __bbq_debug_trap_spec="\${__bbq_outer_debug_trap_spec:-}"
  unset __bbq_outer_debug_trap_spec
  __bbq_update_user_debug_trap "$__bbq_debug_trap_spec" "trap -- '__bbq_osc133_preexec' DEBUG"
}
__bbq_run_prompt_command_array() {
  local __bbq_exit_code="\${__bbq_prompt_status:-$?}" __bbq_prompt_part __bbq_prompt_index __bbq_user_count
  local __bbq_suffix_part
  local __bbq_final_prompt_command
  local __bbq_in_prompt_dispatch=1 __bbq_dispatching_user_prompt_command=""
  unset __bbq_prompt_status
  __bbq_adopt_outer_debug_trap
  trap '__bbq_osc133_preexec' DEBUG
  for __bbq_prompt_part in "\${__bbq_prompt_command_prefix[@]+"\${__bbq_prompt_command_prefix[@]}"}"; do
    if (( __bbq_exit_code == 0 )); then
      eval "$__bbq_prompt_part"
    else
      __bbq_restore_prompt_status "$__bbq_exit_code" || eval "$__bbq_prompt_part"
    fi
  done
  __bbq_user_count=0
  for __bbq_prompt_part in "\${__bbq_prompt_command_array[@]+"\${__bbq_prompt_command_array[@]}"}"; do
    __bbq_user_count=$(( __bbq_user_count + 1 ))
  done
  for (( __bbq_prompt_index = 0; __bbq_prompt_index + 1 < __bbq_user_count; __bbq_prompt_index++ )); do
    __bbq_prompt_part="\${__bbq_prompt_command_array[__bbq_prompt_index]}"
    __bbq_dispatching_user_prompt_command=1
    if (( __bbq_exit_code == 0 )); then
      eval "$__bbq_prompt_part"
    else
      __bbq_restore_prompt_status "$__bbq_exit_code" || eval "$__bbq_prompt_part"
    fi
    __bbq_dispatching_user_prompt_command=""
  done
  if (( __bbq_user_count > 0 )); then
    __bbq_prompt_part="\${__bbq_prompt_command_array[__bbq_user_count - 1]}"
    # Why: keep the final user hook and Orca suffixes in one status-preserving eval.
    __bbq_final_prompt_command='eval "$__bbq_prompt_part"'
    for __bbq_suffix_part in "\${__bbq_prompt_command_suffix[@]+"\${__bbq_prompt_command_suffix[@]}"}"; do
      __bbq_final_prompt_command+=$'\\n'"$__bbq_suffix_part"
    done
    __bbq_dispatching_user_prompt_command=1
    if (( __bbq_exit_code == 0 )); then
      eval "$__bbq_final_prompt_command"
    else
      __bbq_restore_prompt_status "$__bbq_exit_code" || eval "$__bbq_final_prompt_command"
    fi
    __bbq_dispatching_user_prompt_command=""
  else
    for __bbq_prompt_part in "\${__bbq_prompt_command_suffix[@]+"\${__bbq_prompt_command_suffix[@]}"}"; do
      if (( __bbq_exit_code == 0 )); then
        eval "$__bbq_prompt_part"
      else
        __bbq_restore_prompt_status "$__bbq_exit_code" || eval "$__bbq_prompt_part"
      fi
    done
  fi
  return "$__bbq_exit_code"
}
__bbq_finish_legacy_prompt_dispatch() {
  local __bbq_suffix_part
  if [[ -n "\${__bbq_in_prompt_command:-}" ]]; then
    for __bbq_suffix_part in "\${__bbq_prompt_command_suffix[@]+"\${__bbq_prompt_command_suffix[@]}"}"; do
      eval "$__bbq_suffix_part"
    done
  fi
  trap '__bbq_osc133_preexec' DEBUG
  unset __bbq_in_legacy_prompt_wrapper
}
__bbq_normalize_prompt_command() {
  [[ -z "\${__bbq_prompt_command_normalized:-}" ]] || return 0
  local __bbq_prompt_part
  local -a __bbq_normalized=()
  for __bbq_prompt_part in "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}"; do
    __bbq_normalize_prompt_command_part "$__bbq_prompt_part" __bbq_prompt_part
    [[ -n "$__bbq_prompt_part" ]] && __bbq_normalized+=("$__bbq_prompt_part")
  done
  __bbq_prompt_command_normalized=1
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND=("\${__bbq_normalized[@]+"\${__bbq_normalized[@]}"}")
  else
    __bbq_prompt_command_array=("\${__bbq_normalized[@]+"\${__bbq_normalized[@]}"}")
    __bbq_prompt_command_prefix=()
    __bbq_prompt_command_suffix=()
    unset PROMPT_COMMAND
    # Why: PID scope distinguishes legacy prompt dispatch from ordinary user command text.
    __bbq_prompt_status_variable="__bbq_prompt_status_$$"
    __bbq_prompt_status_capture_command="$__bbq_prompt_status_variable=\\$?"
    __bbq_prompt_status_value="\\\${$__bbq_prompt_status_variable}"
    PROMPT_COMMAND="$__bbq_prompt_status_capture_command; __bbq_prompt_status=$__bbq_prompt_status_value"'; __bbq_prompt_had_functrace=""; if [[ -o functrace ]]; then __bbq_prompt_had_functrace=1; set +T; fi; __bbq_outer_debug_trap_spec="$(trap -p DEBUG)"; [[ -z "$__bbq_prompt_had_functrace" ]] || set -T; unset __bbq_prompt_had_functrace; __bbq_run_prompt_command_array; __bbq_finish_legacy_prompt_dispatch'
  fi
}
__bbq_prepend_prompt_command() {
  local command="$1"
  __bbq_normalize_prompt_command
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND=("$command" "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}")
  else
    __bbq_prompt_command_prefix=("$command" "\${__bbq_prompt_command_prefix[@]+"\${__bbq_prompt_command_prefix[@]}"}")
  fi
}
__bbq_append_prompt_command() {
  local command="$1"
  __bbq_normalize_prompt_command
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND+=("$command")
  else
    __bbq_prompt_command_suffix+=("$command")
  fi
}`
