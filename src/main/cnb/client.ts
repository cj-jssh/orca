import { CNB_API_BASE_URL } from './cnb-auth-config'
import { resolveCnbToken } from './resolve-auth'
import { cancelUnreadResponseBody } from '../lib/unread-response-body'
import { shouldHideNonOpenReviewOnDefaultBranch } from '../source-control/repo-default-branch'
import {
  getHostedReviewLocalGitOptions,
  type HostedReviewExecutionOptions
} from '../source-control/hosted-review-git-options'
import {
  invalidateHostedPullRequestScan,
  scanHostedPullRequests
} from '../source-control/hosted-review-pull-request-scan'
import {
  cnbBareRef,
  deriveCnbCommitStatus,
  mapCnbPullRequest,
  mapCnbPullRequestState,
  parseCnbPullNumber,
  type CnbPullRequestInfo,
  type RawCnbCommitStatuses,
  type RawCnbPull
} from './pull-request-mappers'
import { cnbReviewUrl, getCnbRepoRef, type CnbRepoRef } from './repository-ref'

const REQUEST_TIMEOUT_MS = 5000
const PULL_REQUEST_LIST_TIMEOUT_MS = 15_000
const PULL_REQUEST_PAGE_SIZE = 50
const MAX_PULL_REQUEST_PAGES = 5

type RequestOptions = {
  searchParams?: Record<string, string | number>
  timeoutMs?: number
  // Why: only a single-resource fetch may read 404 as "absent".
  allowNotFound?: boolean
}

function authHeaders(): Record<string, string> {
  const token = resolveCnbToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function apiUrl(path: string, searchParams?: RequestOptions['searchParams']): URL {
  const url = new URL(`${CNB_API_BASE_URL}${path}`)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value))
    }
  }
  return url
}

async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
  throwOnFailure = false
): Promise<T | null> {
  try {
    const response = await fetch(apiUrl(path, options.searchParams), {
      headers: { Accept: 'application/json', ...authHeaders() },
      signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) {
      await cancelUnreadResponseBody(response)
      // Why: listing 404s still signal repository or access failures.
      if (throwOnFailure && !(options.allowNotFound && response.status === 404)) {
        throw new Error(`CNB request failed: HTTP ${response.status}`)
      }
      return null
    }
    return (await response.json()) as T
  } catch (error) {
    if (throwOnFailure) {
      throw error
    }
    return null
  }
}

function encodedRepoPath(repo: CnbRepoRef): string {
  return repo.slug
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function pullPath(repo: CnbRepoRef): string {
  return `/${encodedRepoPath(repo)}/-/pulls`
}

function cnbPullRequestScanKey(repo: CnbRepoRef): string {
  return `cnb:${repo.webBaseUrl}/${repo.slug}`
}

/** Invalidate after creation so card refreshes cannot reuse a cached miss. */
export function invalidateCnbPullRequestScanForRepo(repo: CnbRepoRef): void {
  const repoKey = cnbPullRequestScanKey(repo)
  invalidateHostedPullRequestScan(repoKey)
  invalidateHostedPullRequestScan(`${repoKey}::strict`)
}

async function getCommitStatus(
  repo: CnbRepoRef,
  pullNumber: number
): Promise<ReturnType<typeof deriveCnbCommitStatus>> {
  const data = await requestJson<RawCnbCommitStatuses>(
    `${pullPath(repo)}/${encodeURIComponent(String(pullNumber))}/commit-statuses`
  )
  return deriveCnbCommitStatus(data)
}

async function normalizePullRequest(
  repo: CnbRepoRef,
  raw: RawCnbPull
): Promise<CnbPullRequestInfo | null> {
  const number = parseCnbPullNumber(raw)
  if (number === null) {
    return null
  }
  const status = await getCommitStatus(repo, number)
  return mapCnbPullRequest(raw, cnbReviewUrl(repo, number), status)
}

function matchesBranch(raw: RawCnbPull, branchName: string): boolean {
  return cnbBareRef(raw.head?.ref) === branchName
}

export async function getCnbPullRequest(
  repoPath: string,
  prNumber: number,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<CnbPullRequestInfo | null> {
  const repo = await getCnbRepoRef(repoPath, connectionId, getHostedReviewLocalGitOptions(options))
  if (!repo) {
    return null
  }
  const raw = await requestJson<RawCnbPull>(
    `${pullPath(repo)}/${encodeURIComponent(String(prNumber))}`
  )
  return raw ? normalizePullRequest(repo, raw) : null
}

export async function getCnbPullRequestForBranch(
  repoPath: string,
  branch: string,
  linkedPRNumber?: number | null,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {},
  throwOnFailure = false
): Promise<CnbPullRequestInfo | null> {
  const branchName = cnbBareRef(branch) ?? ''
  if (!branchName && linkedPRNumber == null) {
    return null
  }

  const repo = await getCnbRepoRef(repoPath, connectionId, getHostedReviewLocalGitOptions(options))
  if (!repo) {
    return null
  }

  if (branchName) {
    const pullRequests = await scanHostedPullRequests<RawCnbPull>(
      // Strict scans must not inherit an empty result produced by a failed lenient scan.
      throwOnFailure ? `${cnbPullRequestScanKey(repo)}::strict` : cnbPullRequestScanKey(repo),
      (page) =>
        requestJson<RawCnbPull[]>(
          pullPath(repo),
          {
            searchParams: {
              state: 'all',
              order_by: '-updated_at',
              page,
              page_size: PULL_REQUEST_PAGE_SIZE
            },
            timeoutMs: PULL_REQUEST_LIST_TIMEOUT_MS
          },
          throwOnFailure
        ),
      PULL_REQUEST_PAGE_SIZE,
      MAX_PULL_REQUEST_PAGES
    )
    const raw = pullRequests.find((item) => matchesBranch(item, branchName))
    if (raw) {
      const hideOnDefaultBranch = await shouldHideNonOpenReviewOnDefaultBranch({
        state: mapCnbPullRequestState(raw),
        reviewNumber: parseCnbPullNumber(raw),
        linkedReviewNumber: linkedPRNumber,
        branchName,
        repoPath,
        connectionId,
        localGitOptions: getHostedReviewLocalGitOptions(options)
      })
      if (!hideOnDefaultBranch) {
        return normalizePullRequest(repo, raw)
      }
    }
  }

  if (typeof linkedPRNumber !== 'number') {
    return null
  }
  const raw = await requestJson<RawCnbPull>(
    `${pullPath(repo)}/${encodeURIComponent(String(linkedPRNumber))}`,
    { allowNotFound: true },
    throwOnFailure
  )
  return raw ? normalizePullRequest(repo, raw) : null
}

/** Surface lookup failures as unavailable rather than a false missing review. */
export function getCnbPullRequestForBranchOrThrow(
  repoPath: string,
  branch: string,
  linkedPRNumber?: number | null,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<CnbPullRequestInfo | null> {
  return getCnbPullRequestForBranch(repoPath, branch, linkedPRNumber, connectionId, options, true)
}

export async function getCnbRepoSlug(
  repoPath: string,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<CnbRepoRef | null> {
  return getCnbRepoRef(repoPath, connectionId, getHostedReviewLocalGitOptions(options))
}
