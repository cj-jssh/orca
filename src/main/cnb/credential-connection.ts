import { CNB_API_BASE_URL, getEnvCnbAuthConfig } from './cnb-auth-config'
import {
  cnbConnectFailure,
  type CnbConnectResult,
  type CnbConnectionStatus
} from '../../shared/cnb/cnb-credentials'
import { cancelUnreadResponseBody } from '../lib/unread-response-body'
import {
  clearStoredCnbCredential,
  getCnbCredentialProtection,
  getStoredCnbMetadata,
  hasStoredCnbCredential,
  saveCnbCredential
} from './credential-store'
import type { CnbConnectArgs } from '../../shared/cnb/cnb-credentials'

export type { CnbConnectArgs, CnbConnectResult, CnbConnectionStatus }

const VERIFY_TIMEOUT_MS = 6000

export type CnbUserResult =
  | { ok: true; account: string | null }
  | { ok: false; reason: 'rejected' | 'unreachable' }

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

type RawCnbUser = {
  username?: string | null
  nickname?: string | null
}

export function cnbAccountName(user: RawCnbUser | null): string | null {
  return normalize(user?.username) ?? normalize(user?.nickname)
}

export async function fetchCnbUserResult(
  token: string,
  timeoutMs: number = VERIFY_TIMEOUT_MS
): Promise<CnbUserResult> {
  try {
    const response = await fetch(`${CNB_API_BASE_URL}/user`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (response.status === 401 || response.status === 403) {
      await cancelUnreadResponseBody(response)
      return { ok: false, reason: 'rejected' }
    }
    if (!response.ok) {
      await cancelUnreadResponseBody(response)
      return { ok: false, reason: 'unreachable' }
    }
    return { ok: true, account: cnbAccountName((await response.json()) as RawCnbUser) }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

export async function connectCnb(input: CnbConnectArgs): Promise<CnbConnectResult> {
  const token = normalize(input.token)
  if (!token) {
    return cnbConnectFailure('tokenRequired')
  }
  const result = await fetchCnbUserResult(token)
  if (!result.ok) {
    return cnbConnectFailure(result.reason === 'rejected' ? 'rejected' : 'unreachable')
  }
  saveCnbCredential(token, result.account)
  return { ok: true, account: result.account }
}

export function disconnectCnb(): void {
  clearStoredCnbCredential()
}

// Status reads must avoid keychain prompts.
export function getCnbConnectionStatus(): CnbConnectionStatus {
  const env = getEnvCnbAuthConfig()
  if (env.token) {
    return {
      configured: true,
      source: 'environment',
      account: null,
      credentialProtection: null
    }
  }
  if (hasStoredCnbCredential()) {
    return {
      configured: true,
      source: 'stored',
      account: getStoredCnbMetadata()?.account ?? null,
      credentialProtection: getCnbCredentialProtection()
    }
  }
  return {
    configured: false,
    source: 'none',
    account: null,
    credentialProtection: null
  }
}
