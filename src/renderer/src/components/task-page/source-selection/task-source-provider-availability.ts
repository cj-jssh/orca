import { parseExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { TaskProvider } from '../../../../../shared/work-items/task-providers'
import type { PreflightStatus } from '../../../../../preload/api/preflight/preflight-api'
import type { TaskSourceContext } from '../../../../../shared/work-items/task-source-context'
import type { TaskSourceHostAvailability } from './task-source-context-summary'

type ProviderToolStatus = {
  installed: boolean
  authenticated: boolean
}

type ProviderAvailabilityStatus = ProviderToolStatus | 'unsupported'

export type RuntimeProviderPreflightStatus = {
  checked: boolean
  status: PreflightStatus | null
}

function isDesktopOwnedHost(hostId: TaskSourceContext['hostId']): boolean {
  const parsed = parseExecutionHostId(hostId)
  return parsed?.kind !== 'runtime'
}

function getRepoBackedProviderToolStatus(
  provider: Extract<TaskProvider, 'github' | 'gitlab' | 'cnb'>,
  preflightStatus: PreflightStatus | null
): ProviderAvailabilityStatus | null {
  if (!preflightStatus) {
    return null
  }
  if (provider === 'github') {
    return preflightStatus.gh
  }
  if (provider === 'cnb') {
    // Older servers lack CNB preflight; report a capability gap instead of a missing install.
    if (!Object.hasOwn(preflightStatus, 'cnb')) {
      return 'unsupported'
    }
    // CNB issues need only its token, so configured is its "installed".
    const cnb = preflightStatus.cnb
    return { installed: cnb?.configured === true, authenticated: cnb?.authenticated === true }
  }
  // Older servers can lack GitLab preflight; report a capability gap instead of a fixable missing glab install.
  return Object.hasOwn(preflightStatus, 'glab')
    ? (preflightStatus.glab ?? { installed: false, authenticated: false })
    : 'unsupported'
}

function getProviderReason(
  status: ProviderAvailabilityStatus
): TaskSourceHostAvailability['reason'] | null {
  if (status === 'unsupported') {
    return 'unsupported-provider'
  }
  if (!status.installed) {
    return 'unavailable-source-tool'
  }
  if (!status.authenticated) {
    return 'missing-provider-auth'
  }
  return null
}

export function getRepoBackedProviderAvailability(args: {
  provider: Extract<TaskProvider, 'github' | 'gitlab' | 'cnb'>
  contexts: readonly TaskSourceContext[]
  preflightStatus: PreflightStatus | null
  preflightReady: boolean
  runtimePreflightStatusByHostId?: ReadonlyMap<
    TaskSourceContext['hostId'],
    RuntimeProviderPreflightStatus
  >
}): TaskSourceHostAvailability[] {
  return args.contexts.flatMap((context) => {
    const desktopOwned = isDesktopOwnedHost(context.hostId)
    // CNB reads its token in the desktop process, so a remote host can never answer its list.
    if (args.provider === 'cnb' && !desktopOwned) {
      return [{ hostId: context.hostId, reason: 'unsupported-provider' }]
    }
    const hostPreflight = desktopOwned
      ? { checked: args.preflightReady, status: args.preflightStatus }
      : args.runtimePreflightStatusByHostId?.get(context.hostId)
    if (!hostPreflight?.checked) {
      return []
    }
    const status = getRepoBackedProviderToolStatus(args.provider, hostPreflight.status)
    const reason = status ? getProviderReason(status) : null
    return reason ? [{ hostId: context.hostId, reason }] : []
  })
}
