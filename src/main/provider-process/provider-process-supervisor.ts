import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveProviderChildEnv, type ProviderProcessLaunch } from './provider-process-launch'
import { PROVIDER_SPAWN_FAILURE_MARKER } from './provider-spawn-failure-report'

/** Filename of the supervisor program. It is a real file, not an `-e` argument. */
export const PROVIDER_SUPERVISOR_SCRIPT_FILENAME = 'bbq-provider-supervisor.cjs'

/** Time the provider gets to exit on its own after its stdin ends, before SIGTERM. */
export const PROVIDER_STDIN_END_GRACE_MS = 1_000
/** Time the provider group gets to flush and exit after SIGTERM, before SIGKILL. */
export const PROVIDER_SIGTERM_GRACE_MS = 3_000
/**
 * How long the supervisor waits for a SIGKILLed group to disappear. A killed process never runs
 * again, so this only covers the kernel finishing the kill; waiting forever could hang close or
 * recovery on a process stuck in the kernel, such as one blocked on a hung network drive.
 */
export const PROVIDER_GROUP_REAP_TIMEOUT_MS = 1_500
/** Longest a supervisor waits, after its provider exits, to relay output still in the pipes. */
export const PROVIDER_OUTPUT_DRAIN_TIMEOUT_MS = 1_000
/**
 * Longest a supervisor can take to stop once asked (stdin end, grace, SIGTERM, grace, SIGKILL,
 * reap); a SIGKILL sooner can orphan its group. The graces are also the largest a spec may carry.
 */
export const PROVIDER_SUPERVISOR_MAX_STOP_MS =
  PROVIDER_STDIN_END_GRACE_MS + PROVIDER_SIGTERM_GRACE_MS + PROVIDER_GROUP_REAP_TIMEOUT_MS

/**
 * Supervisor source kept dependency-free for the spawned Node child.
 * The launch writes this to a file and passes the spec as a second file, so neither
 * the source nor the spec appears on the process command line or in the environment.
 */
export const POSIX_PROVIDER_SUPERVISOR_SCRIPT = `
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const specPath = process.argv[2]; let spec
try {
  spec = JSON.parse(fs.readFileSync(specPath, 'utf8')); fs.unlinkSync(specPath)
} catch (error) {
  process.exit(1)
}
// The provider's own argv, after this script's '--'.
const providerSeparator = process.argv.indexOf('--')
if (providerSeparator < 0) process.exit(1)
const [providerCommand, ...providerArgs] = process.argv.slice(providerSeparator + 1)
// A detached supervisor is reparented when its owner exits. The new parent may
// be PID 1 or a platform subreaper, so any other parent means no live owner.
const ownerGone = () => process.ppid !== spec.ownerPid
// Registered before the spawn, so a stop that lands while the provider starts still reaps it.
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => stopProviderGroup(signal))
// The owner can exit before this runs; spawning then would start a provider nothing watches.
if (ownerGone()) process.exit(1)
const childEnv = { ...process.env, ...spec.nodeEnv }; delete childEnv.ELECTRON_RUN_AS_NODE
// The owner sees only this pid's exit; this marked last stderr line says the provider never started.
const exitWithSpawnFailure = (error, thrown) => {
  const report = { thrown, code: (error && error.code) || 'UNKNOWN', message: String(error && error.message) }
  try { require('node:fs').writeSync(2, ${JSON.stringify(PROVIDER_SPAWN_FAILURE_MARKER)} + JSON.stringify(report) + '\\n') } catch {}
  process.exit(127)
}
let child
try {
  child = spawn(providerCommand, providerArgs, {
    cwd: spec.cwd,
    env: childEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true
  })
} catch (error) {
  // Node throws most spawn failures (ENOEXEC, ENOTDIR, ...) rather than emitting them.
  exitWithSpawnFailure(error, true)
}
let timer
let ownerShutdownTimer
let settling = false
let providerExited = false
const providerGroupExists = () => {
  if (!child.pid) return false
  try {
    process.kill(-child.pid, 0)
    return true
  } catch (error) {
    return Boolean(error && error.code !== 'ESRCH')
  }
}
const waitForProviderGroupExit = async (timeoutMs, untilProviderExits = false) => {
  const deadline = Date.now() + timeoutMs
  while (providerGroupExists()) {
    if (Date.now() >= deadline || (untilProviderExits && providerExited)) return false
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return true
}
const reapOwnedProviderGroup = async () => {
  if (!child.pid) return false
  try { process.kill(-child.pid, 'SIGKILL') } catch (error) {
    if (error && error.code !== 'ESRCH') return false
  }
  return waitForProviderGroupExit(${PROVIDER_GROUP_REAP_TIMEOUT_MS})
}
const finishWithProviderOutcome = (code, signal) => {
  if (!signal) return process.exit(code ?? 1)
  // Re-raise with the default action; this supervisor's own handler would swallow it.
  process.removeAllListeners(signal)
  process.kill(process.pid, signal)
}
// Every stop is the same: SIGTERM the group, SIGKILL it after its grace, and exit only once it is
// gone. Whoever stops this pid judges the provider by it, so a dead supervisor means a dead group.
const stopProviderGroup = (receivedSignal) => {
  if (settling) return
  settling = true
  clearInterval(timer)
  if (ownerShutdownTimer) clearTimeout(ownerShutdownTimer)
  try { process.kill(-child.pid, 'SIGTERM') } catch {}
  // A one-shot's helpers die with it once it has exited; a session's keep the grace to clean up.
  void waitForProviderGroupExit(spec.sigtermGraceMs, spec.lifetime === 'one-shot')
    .then((exited) => exited || reapOwnedProviderGroup())
    .then((reaped) => {
      if (!reaped) return process.exit(1)
      finishWithProviderOutcome(137, receivedSignal)
    })
}
const scheduleOwnerShutdown = () => {
  if (settling || ownerShutdownTimer) return
  // A normal close ends the provider's stdin first; allow it to flush and
  // exit before forcing the group, while still bounding an orphaned child.
  ownerShutdownTimer = setTimeout(() => stopProviderGroup(null), spec.stdinEndGraceMs)
  ownerShutdownTimer.unref()
}
// A one-shot's stdin end is the end of its request, not a stop; only its owner's death stops it.
if (spec.lifetime !== 'one-shot') {
  process.stdin.once('end', scheduleOwnerShutdown)
  process.stdin.once('close', scheduleOwnerShutdown)
}
// A spawn that failed outright (EMFILE, ENFILE) has no pid and no pipes; its 'error' reports it.
if (child.pid) {
  process.stdin.pipe(child.stdin)
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  // A dead owner's stdout pipe raises EPIPE; unhandled, it would end this pid before the group.
  for (const stream of [process.stdin, process.stdout, process.stderr, child.stdin, child.stdout, child.stderr]) {
    stream.on('error', () => {})
  }
}
// Exit can land before the provider's last output is relayed; a one-shot's answer is that output.
const drainProviderOutput = () => {
  const ended = (stream) => stream.readableEnded || stream.destroyed ? null : new Promise((resolve) => {
    stream.once('end', resolve)
    stream.once('close', resolve)
  })
  const flushed = (stream) => new Promise((resolve) => stream.write('', resolve))
  const drained = Promise.all([child.stdout, child.stderr].map(ended))
    .then(() => Promise.all([process.stdout, process.stderr].map(flushed)))
  return Promise.race([drained, new Promise((resolve) => setTimeout(resolve, ${PROVIDER_OUTPUT_DRAIN_TIMEOUT_MS}))])
}
const reapProviderExit = async (code, signal) => {
  if (settling) return
  settling = true
  clearInterval(timer)
  if (ownerShutdownTimer) clearTimeout(ownerShutdownTimer)
  if (!(await reapOwnedProviderGroup())) return process.exit(1)
  await drainProviderOutput()
  finishWithProviderOutcome(code, signal)
}
// An owner that is gone gets the close its owner would have asked for, made here on its behalf.
timer = setInterval(() => {
  if (!ownerGone()) return
  clearInterval(timer)
  process.stdin.unpipe(child.stdin)
  try { child.stdin.end() } catch {}
  // A one-shot's stdin end was its request, so only a stop is left to ask for.
  if (spec.lifetime === 'one-shot' || spec.closeRequest !== 'stdin-end') return stopProviderGroup(null)
  scheduleOwnerShutdown()
}, 100)
timer.unref()
child.once('error', (error) => {
  clearInterval(timer)
  exitWithSpawnFailure(error, false)
})
child.once('exit', (code, signal) => {
  providerExited = true
  void reapProviderExit(code, signal)
})
`

/**
 * `session`: the owner ending stdin is a close, so the provider is stopped after a grace.
 * `one-shot`: stdin end only completes the request; the provider runs until it exits or is stopped.
 */
export type ProviderSupervisorLifetime = 'session' | 'one-shot'

/**
 * How a provider's owner closes it: by ending its stdin, after which a session gets its grace (a
 * drain), or by ending stdin and sending SIGTERM at once (`signalSupervisorOnClose` in its close
 * policy). A gone owner gets the same request.
 */
export type ProviderCloseRequest = 'stdin-end' | 'stdin-end-and-sigterm'

export type ProviderSupervisorOptions = {
  cwd?: string
  lifetime?: ProviderSupervisorLifetime
  /** Defaults to the immediate stop; a provider that drains on its stdin end opts into 'stdin-end'. */
  closeRequest?: ProviderCloseRequest
  /** The process the supervisor serves; it must be the supervisor's parent. */
  ownerPid?: number
  stdinEndGraceMs?: number
  sigtermGraceMs?: number
}

// The user's Node startup options, as the CLI launchers stash them away from Electron's bootstrap.
const PROVIDER_ONLY_NODE_ENV_KEYS = ['NODE_OPTIONS', 'NODE_REPL_EXTERNAL_MODULE'] as const

const SUPERVISOR_DIR_NAME = 'bbq-provider-supervisor'
let cachedSupervisorScriptPath: string | null = null

function supervisorDirectory(): string {
  const dir = join(tmpdir(), SUPERVISOR_DIR_NAME)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

/** Path of the on-disk supervisor program. Rewritten when its source changes. */
export function providerSupervisorScriptPath(): string {
  if (cachedSupervisorScriptPath) {
    return cachedSupervisorScriptPath
  }
  const path = join(supervisorDirectory(), PROVIDER_SUPERVISOR_SCRIPT_FILENAME)
  let current = ''
  try {
    current = readFileSync(path, 'utf8')
  } catch {
    current = ''
  }
  if (current !== POSIX_PROVIDER_SUPERVISOR_SCRIPT) {
    writeFileSync(path, POSIX_PROVIDER_SUPERVISOR_SCRIPT, { mode: 0o600 })
  }
  cachedSupervisorScriptPath = path
  return path
}

function writeProviderSupervisorSpecFile(spec: unknown): string {
  const path = join(supervisorDirectory(), `spec-${randomBytes(8).toString('hex')}.json`)
  writeFileSync(path, JSON.stringify(spec), { mode: 0o600 })
  return path
}

export function isProviderSupervisorArgv(args: readonly string[] | undefined): boolean {
  return (
    typeof args?.[0] === 'string' &&
    args[0].endsWith(PROVIDER_SUPERVISOR_SCRIPT_FILENAME) &&
    typeof args[1] === 'string'
  )
}

/** Spec for a supervised launch, or null when `args` is not that launch. */
export function readProviderSupervisorSpec(
  args: readonly string[] | undefined
): Record<string, unknown> | null {
  if (!isProviderSupervisorArgv(args)) {
    return null
  }
  return JSON.parse(readFileSync(args[1], 'utf8')) as Record<string, unknown>
}

// A longer grace than the max stop allows would let recovery or close SIGKILL mid-stop.
function assertGraceWithin(name: string, graceMs: number, maxMs: number): void {
  if (!(graceMs >= 0 && graceMs <= maxMs)) {
    throw new RangeError(`Provider supervisor ${name} grace ${graceMs} ms is outside 0-${maxMs} ms`)
  }
}

// `never` makes an env-bearing launch a type error here: env is resolved before supervision.
type ProviderSupervisedCommand = Pick<ProviderProcessLaunch, 'command' | 'args' | 'cwd'> & {
  env?: never
  envToDelete?: never
}

export function supervisedPosixLaunch(
  launch: ProviderSupervisedCommand,
  childEnv: NodeJS.ProcessEnv,
  {
    cwd = launch.cwd ?? process.cwd(),
    ownerPid = process.pid,
    lifetime = 'session',
    closeRequest = 'stdin-end-and-sigterm',
    stdinEndGraceMs = PROVIDER_STDIN_END_GRACE_MS,
    sigtermGraceMs = PROVIDER_SIGTERM_GRACE_MS
  }: ProviderSupervisorOptions = {}
): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  assertGraceWithin('stdin-end', stdinEndGraceMs, PROVIDER_STDIN_END_GRACE_MS)
  assertGraceWithin('SIGTERM', sigtermGraceMs, PROVIDER_SIGTERM_GRACE_MS)
  // The spec is a mode-0600 file, not an environment value. Linux caps one env string,
  // and a command-line scan must not see the supervisor source or the spec.
  const supervisorEnv = { ...childEnv }
  const nodeEnv: Record<string, string> = {}
  for (const key of PROVIDER_ONLY_NODE_ENV_KEYS) {
    const value = supervisorEnv[key]
    delete supervisorEnv[key]
    if (value !== undefined) {
      nodeEnv[key] = value
    }
  }
  const specPath = writeProviderSupervisorSpecFile({
    cwd,
    ownerPid,
    lifetime,
    closeRequest,
    stdinEndGraceMs,
    sigtermGraceMs,
    nodeEnv
  })
  return {
    command: process.execPath,
    args: [providerSupervisorScriptPath(), specPath, '--', launch.command, ...launch.args],
    // Electron's executable needs Node mode to run the supervisor file. The
    // marker is removed in that file so providers never inherit Electron semantics.
    env: {
      ...supervisorEnv,
      ELECTRON_RUN_AS_NODE: '1'
    }
  }
}

export function createProviderSpawnSpec(
  launch: ProviderProcessLaunch,
  baseEnv: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  { lifetime, closeRequest }: Pick<ProviderSupervisorOptions, 'lifetime' | 'closeRequest'> = {}
): {
  program: string
  args: string[]
  env: NodeJS.ProcessEnv
  cwd: string
  detached: boolean
  /** The child is the supervisor, whose SIGTERM stops the provider and then itself. */
  supervised: boolean
} {
  const childEnv = resolveProviderChildEnv(launch, baseEnv)
  const supervisor =
    platform === 'win32'
      ? null
      : supervisedPosixLaunch(
          { command: launch.command, args: launch.args, cwd: launch.cwd },
          childEnv,
          { lifetime, closeRequest }
        )
  return {
    program: supervisor?.command ?? launch.command,
    args: supervisor?.args ?? launch.args,
    env: supervisor?.env ?? childEnv,
    cwd: launch.cwd ?? process.cwd(),
    detached: platform !== 'win32',
    supervised: supervisor !== null
  }
}
