export const ORCA_CLI_POSIX_PATH_RESTORE = `if [ -n "\${BBQ_CLI_BIN_DIR:-}" ]; then
  case "\${PATH:-}" in
    "$BBQ_CLI_BIN_DIR"|"$BBQ_CLI_BIN_DIR":*) ;;
    *) export PATH="$BBQ_CLI_BIN_DIR\${PATH:+:$PATH}" ;;
  esac
fi`
