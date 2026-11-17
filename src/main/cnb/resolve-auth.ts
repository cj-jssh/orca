import { getEnvCnbAuthConfig } from './cnb-auth-config'
import { loadStoredCnbSecret } from './credential-store'

// Environment auth wins; stored settings are decrypted only for API calls.
export function resolveCnbToken(): string | null {
  const env = getEnvCnbAuthConfig()
  if (env.token) {
    return env.token
  }
  try {
    return loadStoredCnbSecret({ force: true })?.token ?? null
  } catch {
    return null
  }
}
