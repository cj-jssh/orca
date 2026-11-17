import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken,
  writeCredentialFileAtomic,
  writeEncryptedCredential
} from '../credentials/integration-credential-file'
import { readCredentialFileProtection } from '../credentials/credential-file-protection'
import type { SecretAtRestProtection } from '../../shared/secure-storage/secret-at-rest-protection'

// Plaintext display metadata lets status reads avoid keychain prompts.
export type CnbStoredMetadata = {
  version: 1
  account: string | null
  updatedAt: string
}

export type CnbStoredSecret = {
  token: string | null
}

let cachedMetadata: CnbStoredMetadata | null = null
let metadataLoadedFromDisk = false
let cachedSecret: CnbStoredSecret | null = null
let credentialError: string | null = null

function getOrcaDir(): string {
  return join(homedir(), '.orca')
}

function getMetadataPath(): string {
  return join(getOrcaDir(), 'cnb-credential.json')
}

export function getSecretPath(): string {
  return join(getOrcaDir(), 'cnb-credential.enc')
}

function ensureOrcaDir(): void {
  const dir = getOrcaDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readMetadataFromDisk(): CnbStoredMetadata | null {
  const path = getMetadataPath()
  if (!existsSync(path)) {
    return null
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<CnbStoredMetadata>
    return {
      version: 1,
      account: asOptionalString(parsed.account),
      updatedAt: asOptionalString(parsed.updatedAt) ?? ''
    }
  } catch {
    return null
  }
}

export function getStoredCnbMetadata(): CnbStoredMetadata | null {
  if (!metadataLoadedFromDisk) {
    cachedMetadata = readMetadataFromDisk()
    metadataLoadedFromDisk = true
  }
  return cachedMetadata
}

// Presence checks must avoid keychain prompts.
export function hasStoredCnbCredential(): boolean {
  return getStoredCnbMetadata() !== null && credentialFileHasContent(getSecretPath())
}

export function getStoredCnbCredentialError(): string | null {
  return credentialError
}

// Without force, read memory only; forced decryption can throw CredentialDecryptionError.
export function loadStoredCnbSecret(options: { force?: boolean } = {}): CnbStoredSecret | null {
  if (cachedSecret !== null) {
    return cachedSecret
  }
  if (!options.force) {
    return null
  }
  const path = getSecretPath()
  if (!existsSync(path)) {
    return null
  }
  try {
    const token = readStoredCredentialToken('CNB', readFileSync(path))
    if (!token) {
      return null
    }
    const parsed = JSON.parse(token) as Partial<CnbStoredSecret>
    cachedSecret = { token: asOptionalString(parsed.token) }
    credentialError = null
    return cachedSecret
  } catch (error) {
    if (error instanceof CredentialDecryptionError) {
      credentialError = error.message
      throw error
    }
    return null
  }
}

export function getCnbCredentialProtection(): SecretAtRestProtection | null {
  return readCredentialFileProtection(getSecretPath())
}

export function saveCnbCredential(token: string, account: string | null): void {
  ensureOrcaDir()
  const secret: CnbStoredSecret = { token }
  writeEncryptedCredential('CNB', getSecretPath(), JSON.stringify(secret))
  const metadata: CnbStoredMetadata = {
    version: 1,
    account,
    updatedAt: new Date().toISOString()
  }
  writeCredentialFileAtomic(
    getMetadataPath(),
    Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8')
  )
  cachedMetadata = metadata
  metadataLoadedFromDisk = true
  cachedSecret = secret
  credentialError = null
}

// Surface failed deletes so credentials cannot silently reappear on relaunch.
export function clearStoredCnbCredential(): void {
  try {
    for (const path of [getSecretPath(), getMetadataPath()]) {
      try {
        unlinkSync(path)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    }
  } finally {
    // Clear cached credentials even when deletion only partly succeeds.
    cachedMetadata = null
    metadataLoadedFromDisk = true
    cachedSecret = null
    credentialError = null
  }
}
