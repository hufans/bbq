import type { ProjectExecutionRuntimeResolution } from '../../../shared/project-execution-runtime'
import { getAppEnvironment, hasAppEnvironment } from '../../../shared/app-environment'
import { PRODUCT_COMMAND, PRODUCT_DEV_COMMAND } from '../../../shared/product-brand'

export type OrchestrationCliCommand = 'bbq' | 'bbq-dev' | 'orca' | 'orca-dev' | 'orca-ide'

/** Dev builds run the CLI as `bbq-dev`; a packaged app, or a process with no app, must not advertise it. */
export function runtimeOrchestrationCliCommand(): OrchestrationCliCommand | undefined {
  return hasAppEnvironment() && !getAppEnvironment().isPackaged() ? PRODUCT_DEV_COMMAND : undefined
}

/** What a local, non-WSL terminal is told to run; a structured session is always one. */
export function localOrchestrationCliCommand(): OrchestrationCliCommand {
  return runtimeOrchestrationCliCommand() ?? PRODUCT_COMMAND
}

export function resolveTerminalOrchestrationCliCommand(args: {
  connectionId: string | null
  isWsl: boolean | null | undefined
  worktreeId: string
  projectRuntime?: ProjectExecutionRuntimeResolution
  runtimeCliCommand?: OrchestrationCliCommand
}): OrchestrationCliCommand {
  // Remote installs of this fork put `bbq` on PATH. An old remote that only has `orca`
  // has to be redeployed before this command succeeds.
  if (args.connectionId) {
    return PRODUCT_COMMAND
  }
  if (args.runtimeCliCommand) {
    return args.runtimeCliCommand
  }
  return PRODUCT_COMMAND
}
