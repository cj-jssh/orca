import { CNB_API_BASE_URL } from './cnb-auth-config'
import { resolveCnbToken } from './resolve-auth'
import { cancelUnreadResponseBody } from '../lib/unread-response-body'
import type { HostedReviewExecutionOptions } from '../source-control/hosted-review-git-options'
import { getCnbRepoRef, type CnbRepoRef } from './repository-ref'
import {
  mapCnbIssueSummary,
  mapIssueDetail,
  userName,
  type RawCnbIssue,
  type RawCnbIssueComment
} from './issue-mappers'
import {
  CNB_ISSUE_FAILURE_COPY,
  type CnbCreateIssueArgs,
  type CnbCreateIssueResult,
  type CnbIssueDetailResult,
  type CnbIssueListResult,
  type CnbIssueState,
  type CnbIssueSummary,
  type CnbIssueContextResult,
  type CnbMyIssuesArgs,
  type CnbRepoIssuesArgs
} from '../../shared/cnb/cnb-issues'

const REQUEST_TIMEOUT_MS = 8000
const DEFAULT_PAGE_SIZE = 30

type CnbIssueRequestError = {
  status: number | null
  message: string
}

function authHeaders(): Record<string, string> | null {
  const token = resolveCnbToken()
  return token ? { Accept: 'application/json', Authorization: `Bearer ${token}` } : null
}

function apiUrl(path: string, searchParams?: Record<string, string | number>): URL {
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
  init: { method?: string; searchParams?: Record<string, string | number>; body?: unknown } = {}
): Promise<{ ok: true; data: T } | { ok: false; error: CnbIssueRequestError }> {
  const headers = authHeaders()
  if (!headers) {
    return { ok: false, error: { status: 401, message: CNB_ISSUE_FAILURE_COPY.authRequired } }
  }
  try {
    const response = await fetch(apiUrl(path, init.searchParams), {
      method: init.method ?? 'GET',
      headers:
        init.body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) {
      await cancelUnreadResponseBody(response)
      return { ok: false, error: { status: response.status, message: `HTTP ${response.status}` } }
    }
    return { ok: true, data: (await response.json()) as T }
  } catch (error) {
    return {
      ok: false,
      error: { status: null, message: error instanceof Error ? error.message : String(error) }
    }
  }
}

function failure(error: CnbIssueRequestError): {
  ok: false
  error: string
  errorCode: keyof typeof CNB_ISSUE_FAILURE_COPY
} {
  const errorCode: keyof typeof CNB_ISSUE_FAILURE_COPY =
    error.status === 401 || error.status === 403
      ? 'authRequired'
      : error.status === null
        ? 'unreachable'
        : 'rejected'
  return { ok: false, error: CNB_ISSUE_FAILURE_COPY[errorCode], errorCode }
}

function encodedRepoPath(repo: CnbRepoRef): string {
  return repo.slug
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function listSearchParams(args: {
  state?: CnbIssueState
  keyword?: string
  page?: number
  pageSize?: number
}): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: Math.max(1, args.page ?? 1),
    page_size: Math.max(1, args.pageSize ?? DEFAULT_PAGE_SIZE)
  }
  if (args.state) {
    params.state = args.state
  }
  if (args.keyword?.trim()) {
    params.keyword = args.keyword.trim()
  }
  return params
}

export async function listCnbRepoIssues(
  args: CnbRepoIssuesArgs,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<CnbIssueListResult> {
  const repo = await getCnbRepoRef(args.repoPath, connectionId, options.localGitExecOptions ?? {})
  if (!repo) {
    return { ok: false, error: CNB_ISSUE_FAILURE_COPY.rejected, errorCode: 'rejected' }
  }
  const result = await requestJson<RawCnbIssue[]>(`/${encodedRepoPath(repo)}/-/issues`, {
    searchParams: listSearchParams(args)
  })
  if (!result.ok) {
    return failure(result.error)
  }
  return {
    ok: true,
    issues: result.data
      .map((raw) => mapCnbIssueSummary(raw, repo.slug))
      .filter((issue): issue is CnbIssueSummary => issue !== null)
  }
}

export async function listCnbMyIssues(args: CnbMyIssuesArgs): Promise<CnbIssueListResult> {
  const params: Record<string, string | number> = {
    filter: args.filter,
    page: Math.max(1, args.page ?? 1),
    page_size: Math.max(1, args.pageSize ?? DEFAULT_PAGE_SIZE)
  }
  if (args.state) {
    params.state = args.state
  }
  const result = await requestJson<RawCnbIssue[]>('/user/issues', { searchParams: params })
  if (!result.ok) {
    return failure(result.error)
  }
  return {
    ok: true,
    issues: result.data
      .map((raw) => mapCnbIssueSummary(raw, raw.repo?.path?.trim() || null))
      .filter((issue): issue is CnbIssueSummary => issue !== null)
  }
}

export async function getCnbIssue(
  args: { repoPath: string; number: number },
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<CnbIssueDetailResult> {
  const repo = await getCnbRepoRef(args.repoPath, connectionId, options.localGitExecOptions ?? {})
  if (!repo) {
    return { ok: false, error: CNB_ISSUE_FAILURE_COPY.rejected, errorCode: 'rejected' }
  }
  const result = await requestJson<RawCnbIssue>(
    `/${encodedRepoPath(repo)}/-/issues/${encodeURIComponent(String(args.number))}`
  )
  if (!result.ok) {
    return failure(result.error)
  }
  const issue = mapIssueDetail(result.data, repo.slug)
  return issue
    ? { ok: true, issue }
    : { ok: false, error: CNB_ISSUE_FAILURE_COPY.rejected, errorCode: 'rejected' }
}

export async function createCnbIssue(
  args: CnbCreateIssueArgs,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<CnbCreateIssueResult> {
  const title = args.title.trim()
  if (!title) {
    return { ok: false, error: CNB_ISSUE_FAILURE_COPY.titleRequired, errorCode: 'titleRequired' }
  }
  const repo = await getCnbRepoRef(args.repoPath, connectionId, options.localGitExecOptions ?? {})
  if (!repo) {
    return { ok: false, error: CNB_ISSUE_FAILURE_COPY.rejected, errorCode: 'rejected' }
  }
  const body: Record<string, unknown> = { title }
  if (args.body?.trim()) {
    body.body = args.body
  }
  if (args.labels?.length) {
    body.labels = args.labels
  }
  if (args.priority) {
    body.priority = args.priority
  }
  if (args.assignees?.length) {
    body.assignees = args.assignees
  }
  if (args.invisible === true) {
    body.invisible = true
  }
  const result = await requestJson<RawCnbIssue>(`/${encodedRepoPath(repo)}/-/issues`, {
    method: 'POST',
    body
  })
  if (!result.ok) {
    return failure(result.error)
  }
  const issue = mapCnbIssueSummary(result.data, repo.slug)
  return issue
    ? { ok: true, issue }
    : { ok: false, error: CNB_ISSUE_FAILURE_COPY.rejected, errorCode: 'rejected' }
}

/**
 * Stitches the issue and its comments into one markdown block, so starting a
 * workspace from a CNB issue gives the agent the same context as a GitHub one.
 */
export async function buildCnbIssueContext(
  args: { repoPath: string; number: number },
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<CnbIssueContextResult> {
  const detail = await getCnbIssue(args, connectionId, options)
  if (!detail.ok) {
    return detail
  }
  const repo = await getCnbRepoRef(args.repoPath, connectionId, options.localGitExecOptions ?? {})
  const comments = repo
    ? await requestJson<RawCnbIssueComment[]>(
        `/${encodedRepoPath(repo)}/-/issues/${encodeURIComponent(String(args.number))}/comments`,
        { searchParams: { page: 1, page_size: 50 } }
      )
    : null

  const issue = detail.issue
  const lines = [
    `# CNB issue #${issue.number}: ${issue.title}`,
    '',
    `- URL: ${issue.url}`,
    `- State: ${issue.state}`,
    ...(issue.priority ? [`- Priority: ${issue.priority}`] : []),
    ...(issue.labels.length > 0 ? [`- Labels: ${issue.labels.join(', ')}`] : []),
    ...(issue.assignees.length > 0 ? [`- Assignees: ${issue.assignees.join(', ')}`] : []),
    ...(issue.author ? [`- Author: ${issue.author}`] : []),
    '',
    '## Description',
    '',
    issue.body.trim() || '_(empty)_'
  ]
  if (comments?.ok && comments.data.length > 0) {
    lines.push('', '## Comments', '')
    for (const comment of comments.data) {
      const author = userName(comment.author) ?? 'unknown'
      lines.push(`### ${author}${comment.created_at ? ` · ${comment.created_at}` : ''}`, '')
      lines.push(comment.body?.trim() || '_(empty)_', '')
    }
  }
  return { ok: true, markdown: lines.join('\n'), issue }
}
