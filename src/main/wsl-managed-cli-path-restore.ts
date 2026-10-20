/** Leads PATH with the managed WSL CLI after startup files ran; an unusable CLI only warns. */
export const WSL_MANAGED_CLI_PATH_RESTORE = `if [ -n "\${BBQ_WSL_CLI_DIR:-}" ]; then
  if [ -x "$BBQ_WSL_CLI_DIR/\${BBQ_CLI_COMMAND:-}" ]; then
    export PATH="$BBQ_WSL_CLI_DIR\${PATH:+:$PATH}"
  else
    printf 'BBQ CLI unavailable: cannot run %s. Check WSL Windows-drive mount options.\\n' "$BBQ_WSL_CLI_DIR/\${BBQ_CLI_COMMAND:-}" >&2
  fi
fi`
