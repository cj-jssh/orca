import {
  hostedPullRequestScanCacheSize,
  invalidateHostedPullRequestScan,
  resetHostedPullRequestScanCache,
  scanHostedPullRequests
} from '../source-control/hosted-review-pull-request-scan'
import type { RawGiteaPullRequest } from './pull-request-mappers'

export type GiteaPullRequestPageFetcher = (page: number) => Promise<RawGiteaPullRequest[] | null>

/** Gitea/Forgejo lacks head-branch filtering; share pagination so card bursts cannot overload self-hosted servers. */
export function scanGiteaPullRequests(
  repoKey: string,
  fetchPage: GiteaPullRequestPageFetcher,
  pageLimit: number,
  maxPages: number
): Promise<RawGiteaPullRequest[]> {
  return scanHostedPullRequests(repoKey, fetchPage, pageLimit, maxPages)
}

/** Invalidate after creation so card refreshes cannot reuse a cached miss. */
export function invalidateGiteaPullRequestScan(repoKey: string): void {
  invalidateHostedPullRequestScan(repoKey)
}

export function _resetGiteaPullRequestScanCache(): void {
  resetHostedPullRequestScanCache()
}

export function _getGiteaPullRequestScanCacheSize(): number {
  return hostedPullRequestScanCacheSize()
}
