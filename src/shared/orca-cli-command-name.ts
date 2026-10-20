import { PRODUCT_COMMAND } from './product-brand'

/** Shell command this app tells agents to run. The function name keeps the upstream spelling. */
export function getOrcaCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  if (platform === 'win32') {
    return `${PRODUCT_COMMAND}.cmd`
  }
  return PRODUCT_COMMAND
}
