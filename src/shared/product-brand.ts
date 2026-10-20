/**
 * Product identity for this fork.
 *
 * Write the new names. Read the old ones only as a fallback. Package names,
 * function names, and protocol fields stay on their upstream spellings.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const PRODUCT_COMMAND = 'bbq'
export const PRODUCT_DEV_COMMAND = 'bbq-dev'
export const PRODUCT_DISPLAY_NAME = 'BBQ'
export const PRODUCT_HOME_DIRNAME = '.bbq'
export const LEGACY_HOME_DIRNAME = '.orca'
export const LEGACY_XDG_DIRNAME = 'Orca'
export const PRODUCT_APP_ID = 'com.hufans.bbq'
export const LEGACY_APP_ID = 'com.stablyai.orca'
export const PUBLISH_OWNER = 'hufans'
export const PUBLISH_REPO = 'bbq'

/** Commands this fork used to install. Recognition and cleanup only. */
export const LEGACY_COMMAND_NAMES = ['orca-ide', 'orca', 'orca-dev'] as const

/**
 * First non-empty value wins. An empty string is unset, not a path.
 * `ORCA_USER_DATA` stays in the list because existing installs and tests set it.
 */
const HOME_ENV_PRIORITY = ['BBQ_HOME', 'BBQ_USER_DATA', 'ORCA_HOME', 'ORCA_USER_DATA'] as const

export function nonemptyEnv(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function productHomeEnvIsExplicit(env: NodeJS.ProcessEnv = process.env): boolean {
  return HOME_ENV_PRIORITY.some((name) => nonemptyEnv(env, name) !== null)
}

/** Directory for credentials and other product state. Does not create or copy. */
export function resolveProductHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  for (const name of HOME_ENV_PRIORITY) {
    const value = nonemptyEnv(env, name)
    if (value) {
      return value
    }
  }
  const xdg = nonemptyEnv(env, 'XDG_DATA_HOME')
  if (xdg) {
    return join(xdg, PRODUCT_DISPLAY_NAME)
  }
  return join(home, PRODUCT_HOME_DIRNAME)
}

export function legacyProductHomeSources(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string[] {
  const sources = [join(home, LEGACY_HOME_DIRNAME)]
  const xdg = nonemptyEnv(env, 'XDG_DATA_HOME')
  if (xdg) {
    sources.push(join(xdg, LEGACY_XDG_DIRNAME))
  }
  return sources
}

export function formatProductVersion(version: string): string {
  return `${PRODUCT_COMMAND} ${version}`
}

function copyMissing(source: string, target: string, copied: string[]): void {
  if (!existsSync(source)) {
    return
  }
  const stat = lstatSync(source)
  // A symlink can point outside the legacy home. Leave it in place.
  if (stat.isSymbolicLink()) {
    return
  }
  if (stat.isDirectory()) {
    mkdirSync(target, { recursive: true })
    for (const name of readdirSync(source)) {
      copyMissing(join(source, name), join(target, name), copied)
    }
    return
  }
  if (existsSync(target)) {
    return
  }
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target)
  copied.push(target)
}

/**
 * Copy legacy home files into the new home once.
 * Skips the copy when the user pointed home at an explicit env path.
 * Never overwrites a file that already exists in the new home.
 */
export function migrateProductHome(
  options: {
    env?: NodeJS.ProcessEnv
    home?: string
    target?: string
  } = {}
): string[] {
  const env = options.env ?? process.env
  if (productHomeEnvIsExplicit(env)) {
    return []
  }
  const home = options.home ?? homedir()
  const target = options.target ?? resolveProductHomeDir(env, home)
  const copied: string[] = []
  for (const source of legacyProductHomeSources(env, home)) {
    if (source === target) {
      continue
    }
    copyMissing(source, target, copied)
  }
  return copied
}

/**
 * Env names this app used to export. A live process keeps the `BBQ_` name only.
 * When the new name is unset, the old value is moved across once, then the old name is removed.
 * Home names are handled separately: an empty `BBQ_` value is unset, matching home resolution.
 */
const LEGACY_HOME_ENV_KEYS = ['ORCA_HOME', 'ORCA_USER_DATA'] as const

const LEGACY_EXPORTED_ENV_KEYS = [
  'ORCA_AGENT_HOOK_ENDPOINT',
  'ORCA_AGENT_HOOK_ENV',
  'ORCA_AGENT_HOOK_NODE',
  'ORCA_AGENT_HOOK_OPENCODE_TUI',
  'ORCA_AGENT_HOOK_PORT',
  'ORCA_AGENT_HOOK_TOKEN',
  'ORCA_AGENT_HOOK_TRANSPORT',
  'ORCA_AGENT_HOOK_VERSION',
  'ORCA_AGENT_LAUNCH',
  'ORCA_AGENT_LAUNCH_TOKEN',
  'ORCA_AGENT_PANE',
  'ORCA_APP_VERSION',
  'ORCA_CHAT_SCRATCH_DIR',
  'ORCA_CLAUDE_INJECTED_CONFIG_DIR',
  'ORCA_CLAUDE_PROFILE_POINTER',
  'ORCA_CLAUDE_USER_CONFIG_DIR',
  'ORCA_CLI_BIN_DIR',
  'ORCA_CLI_COMMAND',
  'ORCA_CLI_LAUNCH_REDIRECTED',
  'ORCA_HERMES_STARTUP_QUERY',
  'ORCA_HISTFILE',
  'ORCA_HOOK_AGENT_PID',
  'ORCA_IMAGE_PROTOCOL',
  'ORCA_NODE_OPTIONS',
  'ORCA_NODE_REPL_EXTERNAL_MODULE',
  'ORCA_OPENCODE_AGENT',
  'ORCA_OPENCODE_CONFIG_DIR',
  'ORCA_OPENCODE_PLUGIN_API',
  'ORCA_OPENCODE_SOURCE_CONFIG_DIR',
  'ORCA_OPENCODE_STARTUP_PROMPT_ENDPOINT',
  'ORCA_OPENCODE_STARTUP_PROMPT_NONCE',
  'ORCA_ORCAD_MANAGED_ACTIVATION_ROOT',
  'ORCA_ORIG_ZDOTDIR',
  'ORCA_PANE_KEY',
  'ORCA_SHELL_FEATURES',
  'ORCA_TAB_ID',
  'ORCA_USER_DATA_PATH',
  'ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER',
  'ORCA_WORKTREE_ID',
  'ORCA_WSL_CLI_DIR',
  'ORCA_ZSHENV_SOURCE_DIR',
  'ORCA_AGENT_HOOK_ROOT',
  'ORCA_AGENT_SESSION_ID',
  'ORCA_AGENT_SESSION_SPAWN_TOKEN',
  'ORCA_AGENT_TEAMS_SHIM_BIN',
  'ORCA_AGENT_TEAMS_SHIM_DIR',
  'ORCA_AGENT_TEAMS_TEAM_ID',
  'ORCA_AGENT_TEAMS_TOKEN',
  'ORCA_APP_EXECUTABLE',
  'ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT',
  'ORCA_CLI_CWD',
  'ORCA_CODEX_HOME',
  'ORCA_CODEX_ISOLATE',
  'ORCA_CODEX_LAUNCH_PREFLIGHT',
  'ORCA_CODEX_LAUNCH_PREFLIGHT_CMD_QUOTE',
  'ORCA_DATA_ACCOUNT_DATA_HOME',
  'ORCA_DATA_ACCOUNT_ORIGINAL_ENV',
  'ORCA_DATA_ACCOUNT_PROVIDER',
  'ORCA_DATA_ACCOUNT_STATE_HOME',
  'ORCA_DISABLE_HTTP2',
  'ORCA_DISABLE_MACOS_LOGIN_SHELL',
  'ORCA_ELECTRON_NO_SANDBOX',
  'ORCA_ENVIRONMENT',
  'ORCA_FISH_XDG_DATA_DIRS_PREFIX',
  'ORCA_MIMOCODE_HOME',
  'ORCA_OMP_CODING_AGENT_DIR',
  'ORCA_OMP_FRESH_CONFIG',
  'ORCA_OMP_PREFILL',
  'ORCA_OMP_SOURCE_AGENT_DIR',
  'ORCA_OMP_STATUS_EXTENSION',
  'ORCA_ORCAD_SIDECAR',
  'ORCA_ORCHESTRATION_COMPATIBILITY_ATTACHMENT',
  'ORCA_ORCHESTRATION_COMPATIBILITY_HOST_ID',
  'ORCA_ORCHESTRATION_COMPATIBILITY_HOST_INCARNATION',
  'ORCA_ORCHESTRATION_COMPATIBILITY_HOST_KIND',
  'ORCA_PAIRING_CODE',
  'ORCA_PI_CODING_AGENT_DIR',
  'ORCA_PI_PREFILL',
  'ORCA_PI_SOURCE_AGENT_DIR',
  'ORCA_PI_STATUS_OWNED',
  'ORCA_PI_TITLE_MARKER_OWNED',
  'ORCA_PRIME_AGENT_SOURCE_AGENT_DIR',
  'ORCA_PRIME_AGENT_STATUS_EXTENSION',
  'ORCA_PRIME_AGENT_STATUS_OWNED',
  'ORCA_REMOTE_CLI_BIN_DIR',
  'ORCA_REMOTE_PAIRING',
  'ORCA_ROOT_PATH',
  'ORCA_SHELL_READY_ROOT',
  'ORCA_STRUCTURED_SESSION',
  'ORCA_TERMINAL_HANDLE',
  'ORCA_WORKSPACE_NAME',
  'ORCA_WORKTREE_PATH',
  'ORCA_WSL_HOOK_INSTANCE',
  'ORCA_WSL_HOOK_RELAY_VERSION',
  'ORCA_ANTIGRAVITY_EVENT',
  'ORCA_APP_BUNDLE_PATH',
  'ORCA_APP_ICON_PATH',
  'ORCA_ATTRIBUTION_BYPASS',
  'ORCA_ATTRIBUTION_SHIM_DIR',
  'ORCA_COPILOT_HOOK_EVENT',
  'ORCA_CURSOR_HOOK_RESPONSE',
  'ORCA_ENABLE_GIT_ATTRIBUTION',
  'ORCA_GH_ISSUE_FOOTER',
  'ORCA_GH_PR_FOOTER',
  'ORCA_GIT_COMMIT_TRAILER',
  'ORCA_LOGIN_PROBE_USERNAME',
  'ORCA_POSIX_SHELL_STARTUP_COMMAND',
  'ORCA_REAL_GH',
  'ORCA_REAL_GIT',
  'ORCA_SERVE_RUNTIME',
  'ORCA_SERVE_SUPERVISOR_APP_ROOT',
  'ORCA_SHELL_PATH_PROBE'
] as const

function moveLegacyExportedEnv(
  env: Record<string, string | undefined>,
  key: string,
  emptyIsUnset: boolean
): void {
  const next = `BBQ_${key.slice('ORCA_'.length)}`
  const nextMissing = emptyIsUnset ? nonemptyEnv(env, next) === null : env[next] === undefined
  const current = env[key]
  if (nextMissing && current !== undefined && (!emptyIsUnset || current.length > 0)) {
    env[next] = current
  }
  delete env[key]
}

export function stripLegacyExportedProductEnv<Env extends Record<string, string | undefined>>(
  env: Env
): Env {
  for (const key of LEGACY_EXPORTED_ENV_KEYS) {
    moveLegacyExportedEnv(env, key, false)
  }
  for (const key of LEGACY_HOME_ENV_KEYS) {
    moveLegacyExportedEnv(env, key, true)
  }
  return env
}
