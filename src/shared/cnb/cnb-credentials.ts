import type { SecretAtRestProtection } from '../secure-storage/secret-at-rest-protection'

// Offer Disconnect only for in-app stored credentials.
export type CnbCredentialSource = 'environment' | 'stored' | 'none'

export type CnbConnectArgs = {
  token?: string | null
}

// Never return credential secrets over IPC to the renderer.
export type CnbConnectionStatus = {
  configured: boolean
  source: CnbCredentialSource
  account: string | null
  /** Stored-at-rest status only; environment/none write nothing and use null. */
  credentialProtection?: SecretAtRestProtection | null
}

// One English table for CNB connect failures: main builds the wire `error`, the renderer translates by code.
export const CNB_CONNECT_FAILURE_COPY = {
  tokenRequired: 'Enter a CNB access token.',
  rejected: 'CNB rejected this token. Create a new access token and try again.',
  unreachable: 'Could not reach CNB. Check your connection, then try again.'
} as const

export type CnbConnectFailureCode = keyof typeof CNB_CONNECT_FAILURE_COPY

export type CnbConnectResult =
  | { ok: true; account: string | null }
  /** `error` stays English for older clients; `errorCode` is absent from older hosts. */
  | { ok: false; error: string; errorCode?: string }

export function cnbConnectFailure(
  errorCode: CnbConnectFailureCode
): Extract<CnbConnectResult, { ok: false }> {
  return { ok: false, error: CNB_CONNECT_FAILURE_COPY[errorCode], errorCode }
}
