import { RuntimeClientError } from '../../runtime-client'

const COMPATIBILITY_CLI_COMMANDS = ['bbq', 'bbq-dev', 'orca', 'orca-ide', 'orca-dev'] as const
const WINDOWS_COMPATIBILITY_COMMANDS = ['bbq', 'orca', 'orca-ide'] as const

export type CompatibilityCliCommand = (typeof COMPATIBILITY_CLI_COMMANDS)[number]
export type WindowsCompatibilityCommand = (typeof WINDOWS_COMPATIBILITY_COMMANDS)[number]

function isCompatibilityCliCommand(value: string): value is CompatibilityCliCommand {
  return (COMPATIBILITY_CLI_COMMANDS as readonly string[]).includes(value)
}

function isWindowsCompatibilityCommand(value: string): value is WindowsCompatibilityCommand {
  return (WINDOWS_COMPATIBILITY_COMMANDS as readonly string[]).includes(value)
}

export function resolveCompatibilityCliCommand(): CompatibilityCliCommand {
  const configured = process.env.BBQ_CLI_COMMAND ?? process.env.ORCA_CLI_COMMAND
  if (configured && isCompatibilityCliCommand(configured)) {
    return configured
  }
  if (process.env.ORCA_DEV_REPO_ROOT || process.env.ORCA_DEV_CLI_INVOCATION === '1') {
    return 'bbq-dev'
  }
  return 'bbq'
}

export function resolvePackagedWindowsCompatibilityCommand():
  | WindowsCompatibilityCommand
  | undefined {
  if (
    process.env.BBQ_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1' &&
    process.env.ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1'
  ) {
    return undefined
  }
  const command = process.env.BBQ_CLI_COMMAND ?? process.env.ORCA_CLI_COMMAND
  if (command && isWindowsCompatibilityCommand(command)) {
    return command
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged Orca launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.ORCA_DEV_CLI_INVOCATION === '1' ||
    (process.env.BBQ_USER_DATA_PATH?.includes('orca-dev') ?? false)
  )
}
