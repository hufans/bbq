/**
 * Node-only home paths and the one-time copy from the legacy directory.
 * The browser bundle imports product-brand and must not pull these modules in.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  explicitProductHome,
  LEGACY_HOME_DIRNAME,
  LEGACY_XDG_DIRNAME,
  nonemptyEnv,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_HOME_DIRNAME,
  productHomeEnvIsExplicit
} from './product-brand'

/** Directory for credentials and other product state. Does not create or copy. */
export function resolveProductHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  const explicit = explicitProductHome(env)
  if (explicit) {
    return explicit
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
