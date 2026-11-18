export const CNB_WEB_BASE_URL = 'https://cnb.cool'
const CNB_HOST = 'cnb.cool'

export type CnbRemoteUrl = {
  /** Repository path without `.git`, e.g. `group/sub/repo`. */
  slug: string
  webBaseUrl: string
}

function parseSlug(pathname: string): string | null {
  const slug = pathname
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+/, '')
    .trim()
  if (!slug || slug.split('/').length < 2) {
    return null
  }
  return slug
}

/** Parse a saved CNB remote; only cnb.cool is supported, and CNB serves git over HTTPS. */
export function parseCnbRemoteUrl(remoteUrl: string): CnbRemoteUrl | null {
  const trimmed = remoteUrl.trim()
  if (!trimmed) {
    return null
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const scpLike = trimmed.match(/^(?:[^@/:]+@)?([^:\s/]+):([^\s]+?)(?:\.git)?$/)
    if (!scpLike || scpLike[1].toLowerCase() !== CNB_HOST) {
      return null
    }
    const slug = parseSlug(scpLike[2])
    return slug ? { slug, webBaseUrl: CNB_WEB_BASE_URL } : null
  }
  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:', 'ssh:', 'git+ssh:'].includes(url.protocol.toLowerCase())) {
      return null
    }
    if (url.hostname.toLowerCase() !== CNB_HOST) {
      return null
    }
    const slug = parseSlug(url.pathname)
    return slug ? { slug, webBaseUrl: CNB_WEB_BASE_URL } : null
  } catch {
    return null
  }
}
