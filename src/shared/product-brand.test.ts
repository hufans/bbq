import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  formatProductVersion,
  PRODUCT_COMMAND,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_HOME_DIRNAME,
  stripLegacyExportedProductEnv
} from './product-brand'
import { migrateProductHome, resolveProductHomeDir } from './product-home'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const root = mkdtempSync(join(tmpdir(), 'bbq-home-'))
  roots.push(root)
  return root
}

describe('resolveProductHomeDir', () => {
  it('prefers BBQ_HOME, then ORCA_HOME, then the user-data aliases', () => {
    const home = tempHome()
    expect(resolveProductHomeDir({ BBQ_HOME: '/new', ORCA_HOME: '/old' }, home)).toBe('/new')
    expect(resolveProductHomeDir({ BBQ_HOME: '', ORCA_HOME: '/old' }, home)).toBe('/old')
    expect(resolveProductHomeDir({ ORCA_USER_DATA: '/explicit' }, home)).toBe('/explicit')
    expect(resolveProductHomeDir({ BBQ_USER_DATA: '/bbq', ORCA_USER_DATA: '/orca' }, home)).toBe(
      '/bbq'
    )
  })

  it('uses XDG then the default dot directory when no home env is set', () => {
    const home = tempHome()
    expect(resolveProductHomeDir({ XDG_DATA_HOME: '/xdg' }, home)).toBe(
      join('/xdg', PRODUCT_DISPLAY_NAME)
    )
    expect(resolveProductHomeDir({ XDG_DATA_HOME: '' }, home)).toBe(
      join(home, PRODUCT_HOME_DIRNAME)
    )
    expect(resolveProductHomeDir({}, home)).toBe(join(home, PRODUCT_HOME_DIRNAME))
  })
})

describe('stripLegacyExportedProductEnv', () => {
  it('moves a legacy home onto the new name and drops the old one', () => {
    const env: Record<string, string | undefined> = {
      BBQ_HOME: '',
      ORCA_HOME: '/old-home',
      ORCA_USER_DATA: '/old-data',
      ORCA_CODEX_HOME: '/codex'
    }
    stripLegacyExportedProductEnv(env)
    expect(env).toMatchObject({
      BBQ_HOME: '/old-home',
      BBQ_USER_DATA: '/old-data',
      BBQ_CODEX_HOME: '/codex'
    })
    expect(env).not.toHaveProperty('ORCA_HOME')
    expect(env).not.toHaveProperty('ORCA_USER_DATA')
    expect(env).not.toHaveProperty('ORCA_CODEX_HOME')
    expect(resolveProductHomeDir(env, '/home/ann')).toBe('/old-home')
  })

  it('moves process-scanned legacy names onto BBQ_ and drops the old names', () => {
    const env: Record<string, string | undefined> = {
      ORCA_SERVE_RUNTIME: 'electron',
      ORCA_ANTIGRAVITY_EVENT: 'login',
      ORCA_REAL_GIT: '/usr/bin/git',
      BBQ_SHELL_PATH_PROBE: 'kept',
      ORCA_CLAUDE_AGENT_STATUS_SETTINGS: '/stale.json'
    }
    stripLegacyExportedProductEnv(env)
    expect(env).toMatchObject({
      BBQ_SERVE_RUNTIME: 'electron',
      BBQ_ANTIGRAVITY_EVENT: 'login',
      BBQ_REAL_GIT: '/usr/bin/git',
      BBQ_SHELL_PATH_PROBE: 'kept',
      ORCA_CLAUDE_AGENT_STATUS_SETTINGS: '/stale.json'
    })
    expect(env).not.toHaveProperty('ORCA_SERVE_RUNTIME')
    expect(env).not.toHaveProperty('ORCA_ANTIGRAVITY_EVENT')
    expect(env).not.toHaveProperty('ORCA_REAL_GIT')
    expect(env).not.toHaveProperty('BBQ_CLAUDE_AGENT_STATUS_SETTINGS')
  })

  it('keeps a non-empty BBQ_HOME when the legacy home is also set', () => {
    const env: Record<string, string | undefined> = { BBQ_HOME: '/new', ORCA_HOME: '/old' }
    stripLegacyExportedProductEnv(env)
    expect(env.BBQ_HOME).toBe('/new')
    expect(env).not.toHaveProperty('ORCA_HOME')
  })
})

describe('formatProductVersion', () => {
  it('prefixes the version with the command name', () => {
    expect(formatProductVersion('1.4.214')).toBe(`${PRODUCT_COMMAND} 1.4.214`)
  })
})

describe('migrateProductHome', () => {
  it('copies a legacy home once and does not overwrite the new file', () => {
    const home = tempHome()
    const legacy = join(home, '.orca')
    mkdirSync(legacy)
    writeFileSync(join(legacy, 'token.enc'), 'from-legacy')

    const first = migrateProductHome({ env: {}, home })
    expect(first).toEqual([join(home, '.bbq', 'token.enc')])
    expect(readFileSync(join(home, '.bbq', 'token.enc'), 'utf8')).toBe('from-legacy')

    writeFileSync(join(home, '.bbq', 'token.enc'), 'edited')
    writeFileSync(join(legacy, 'token.enc'), 'changed-legacy')
    expect(migrateProductHome({ env: {}, home })).toEqual([])
    expect(readFileSync(join(home, '.bbq', 'token.enc'), 'utf8')).toBe('edited')
  })

  it('does not copy when a home env var is set', () => {
    const home = tempHome()
    mkdirSync(join(home, '.orca'))
    writeFileSync(join(home, '.orca', 'token.enc'), 'from-legacy')
    expect(migrateProductHome({ env: { BBQ_HOME: join(home, 'explicit') }, home })).toEqual([])
  })

  it('does not copy a symlink out of the legacy home', () => {
    const home = tempHome()
    const legacy = join(home, '.orca')
    mkdirSync(legacy)
    const outside = join(home, 'outside-secret')
    writeFileSync(outside, 'secret')
    symlinkSync(outside, join(legacy, 'linked'))
    writeFileSync(join(legacy, 'plain'), 'ok')
    expect(migrateProductHome({ env: {}, home })).toEqual([join(home, '.bbq', 'plain')])
    expect(existsSync(join(home, '.bbq', 'linked'))).toBe(false)
    expect(readFileSync(outside, 'utf8')).toBe('secret')
  })
})
