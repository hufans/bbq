// The Antigravity server opens its Google sign-in page through BROWSER. BBQ points that at a
// small program run by its own executable in Node mode, which prints the link on error output
// instead: the link is captured either way, and no browser opens on the host.
// The program is a file. An inline `-e` script would put the source on the command line and in
// the BROWSER environment the server executes.

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { quotePosixShellDoubleQuotedApostrophe } from '../../shared/shell-argument-quoting'
import { runProcess } from '@orca/process-host'

export const ANTIGRAVITY_BROWSER_MARKER = '__BBQ_ANTIGRAVITY_AUTH_URL__'
export const ANTIGRAVITY_BROWSER_SCRIPT_DIR = 'bbq-antigravity-browser'
export const ANTIGRAVITY_BROWSER_SCRIPT_FILENAME = 'bbq-antigravity-browser.cjs'

// EPIPE still exits 0, or Python falls back to a real browser once nothing reads the output.
// `node script -- url` puts the link after `--`. `-e` used to put it at argv[1].
const HELPER_SOURCE =
  `const i=process.argv.indexOf("--");` +
  `process.stderr.on("error",()=>process.exit(0)).write(` +
  `"${ANTIGRAVITY_BROWSER_MARKER}"+JSON.stringify(i<0?"":process.argv[i+1])+"\\n",()=>process.exit(0))\n`
const PREFLIGHT_URL = 'https://example.invalid/bbq-antigravity-browser-preflight'

function encodePrintfPath(path: string): string {
  return path.replaceAll('\\', '\\\\').replaceAll(':', '\\072')
}

/** On-disk helper. Rewritten when its source changes. Mode 0600. */
export function antigravityBrowserScriptPath(): string {
  const dir = join(tmpdir(), ANTIGRAVITY_BROWSER_SCRIPT_DIR)
  const path = join(dir, ANTIGRAVITY_BROWSER_SCRIPT_FILENAME)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  let current = ''
  try {
    current = readFileSync(path, 'utf8')
  } catch {
    current = ''
  }
  if (current !== HELPER_SOURCE) {
    writeFileSync(path, HELPER_SOURCE, { mode: 0o600 })
  }
  chmodSync(path, 0o600)
  return path
}

// Python splits BROWSER with shlex.

// Node mode is set in the command itself: the provider supervisor strips ELECTRON_RUN_AS_NODE from
// the server, which keeps it out of the agent's own tools.
const executable = encodePrintfPath(process.execPath)
const script = encodePrintfPath(antigravityBrowserScriptPath())
const shell = `exec /usr/bin/env ELECTRON_RUN_AS_NODE=1 "$(printf %b ${quotePosixShellDoubleQuotedApostrophe(executable)})" "$(printf %b ${quotePosixShellDoubleQuotedApostrophe(script)})" -- "$1"`
const BROWSER_ARGV = ['/bin/sh', '-c', shell, '--', '%s']
export const ANTIGRAVITY_BROWSER_COMMAND = BROWSER_ARGV.map(
  quotePosixShellDoubleQuotedApostrophe
).join(' ')
const usable = !/[\r\n\0]|%s/.test(process.execPath)

/** The exact template the server's Python browser controller executes. */
export const antigravityBrowserArgv = (link: string): string[] =>
  BROWSER_ARGV.map((arg) => (arg === '%s' ? link : arg))

/** Runs the helper once as the server would; checked before every server start, since a broken
 *  helper would let the server open a browser on this host. */
export async function antigravityBrowserHelperWorks(): Promise<boolean> {
  if (!usable) {
    return false
  }
  const [program = '', ...args] = antigravityBrowserArgv(PREFLIGHT_URL)
  const spec = { program, args, timeoutMs: 5_000, maxOutputBytes: 4_096 }
  const result = await runProcess(spec).catch(() => null)
  return (
    result?.code === 0 &&
    result.stdout === '' &&
    result.stderr === `${ANTIGRAVITY_BROWSER_MARKER}${JSON.stringify(PREFLIGHT_URL)}\n`
  )
}
