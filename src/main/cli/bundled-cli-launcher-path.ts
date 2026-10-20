import { join } from 'node:path'
import { PRODUCT_COMMAND } from '../../shared/product-brand'

// `bbq` does not collide with GNOME Orca's /usr/bin/orca, so Linux uses the same command.
export const LINUX_CLI_COMMAND_NAME = PRODUCT_COMMAND

/** Absolute path of the CLI launcher this app ships in its own resources bundle.
 *  Lives apart from cli-installer so callers that only need the path (PTY env
 *  assembly) don't pull in the installer's `electron` dependency. */
export function getBundledLauncherPath(
  platform: NodeJS.Platform,
  resourcesPath: string
): string | null {
  if (platform === 'darwin' || platform === 'linux') {
    return join(resourcesPath, 'bin', PRODUCT_COMMAND)
  }
  if (platform === 'win32') {
    return join(resourcesPath, 'bin', `${PRODUCT_COMMAND}.exe`)
  }
  return null
}
