/** CNB has a single public API host; only cnb.cool is supported. */
export const CNB_API_BASE_URL = 'https://api.cnb.cool'
export const CNB_WEB_BASE_URL = 'https://cnb.cool'

export type CnbAuthConfig = {
  token: string | null
}

export function cnbEnvValue(name: string): string | null {
  const value = process.env[name]?.trim() ?? ''
  return value.length > 0 ? value : null
}

export function getEnvCnbAuthConfig(): CnbAuthConfig {
  return { token: cnbEnvValue('ORCA_CNB_TOKEN') }
}

export function hasCnbAuth(config: CnbAuthConfig): boolean {
  return config.token !== null
}
