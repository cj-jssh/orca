import { createRemoteRefProbeCache } from '../git/remotes/remote-ref-probe-cache'
import { CNB_WEB_BASE_URL } from './cnb-auth-config'
import { parseCnbRemoteUrl } from '../../shared/cnb/cnb-remote-url'

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

export function parseCnbRepoRef(remoteUrl: string): CnbRepoRef | null {
  const parsed = parseCnbRemoteUrl(remoteUrl)
  // CNB serves git over HTTPS only, so every remote form maps onto its web origin.
  return parsed ? { host: 'cnb.cool', ...parsed, webBaseUrl: CNB_WEB_BASE_URL } : null
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
