import { createRemoteRefProbeCache } from '../git/remotes/remote-ref-probe-cache'
import { CNB_WEB_BASE_URL } from './cnb-auth-config'

export type CnbRepoRef = {
  host: string
  /** CNB API path parameter: the repository path without `.git`, e.g. `group/sub/repo`. */
  slug: string
  webBaseUrl: string
}

type LocalGitExecOptions = {
  wslDistro?: string
}

const repoRefProbeCache = createRemoteRefProbeCache(parseCnbRepoRef)

/** @internal - exposed for tests only */
export function _resetCnbRepoRefCache(): void {
  repoRefProbeCache.clear()
}

/** CNB serves git over HTTPS only, so every remote form maps onto its web origin. */
const CNB_HOST = 'cnb.cool'

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

export function parseCnbRepoRef(remoteUrl: string): CnbRepoRef | null {
  const trimmed = remoteUrl.trim()
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const scpLike = trimmed.match(/^(?:[^@/:]+@)?([^:\s/]+):([^\s]+?)(?:\.git)?$/)
    if (!scpLike) {
      return null
    }
    const host = scpLike[1].toLowerCase()
    const slug = host === CNB_HOST ? parseSlug(scpLike[2]) : null
    return slug ? { host, slug, webBaseUrl: CNB_WEB_BASE_URL } : null
  }

  try {
    const url = new URL(trimmed)
    const protocol = url.protocol.toLowerCase()
    if (!['http:', 'https:', 'ssh:', 'git+ssh:'].includes(protocol)) {
      return null
    }
    const host = url.hostname.toLowerCase()
    if (host !== CNB_HOST) {
      return null
    }
    const slug = parseSlug(url.pathname)
    return slug ? { host, slug, webBaseUrl: CNB_WEB_BASE_URL } : null
  } catch {
    return null
  }
}

export async function getCnbRepoRefForRemote(
  repoPath: string,
  remoteName: string,
  connectionId?: string | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<CnbRepoRef | null> {
  return repoRefProbeCache.get(repoPath, remoteName, connectionId, localGitOptions)
}

export async function getCnbRepoRef(
  repoPath: string,
  connectionId?: string | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<CnbRepoRef | null> {
  return getCnbRepoRefForRemote(repoPath, 'origin', connectionId, localGitOptions)
}

/** Web URL of a review, matching the host the repository was cloned from. */
export function cnbReviewUrl(repo: CnbRepoRef, number: number): string {
  return `${repo.webBaseUrl}/${repo.slug}/-/pulls/${number}`
}
