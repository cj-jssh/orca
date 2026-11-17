import type {
  CheckStatus,
  PRMergeableState
} from '../../shared/github/pull-requests/pull-request-types'

type RawCnbPullRef = {
  ref?: string | null
  sha?: string | null
}

export type RawCnbPull = {
  /** CNB identifies a review by a string number. */
  number?: string | number | null
  title?: string | null
  state?: string | null
  is_merged?: boolean | null
  is_wip?: boolean | null
  mergeable_state?: string | null
  body?: string | null
  head?: RawCnbPullRef | null
  base?: RawCnbPullRef | null
  created_at?: string | null
  closed_at?: string | null
  /** Only the list endpoint reports activity timestamps. */
  last_acted_at?: string | null
}

export type CnbPullRequestInfo = {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged' | 'draft'
  url: string
  status: CheckStatus
  updatedAt: string
  mergeable: PRMergeableState
  headSha?: string
  baseRefName?: string
}

export type RawCnbCommitStatus = {
  state?: string | null
  context?: string | null
}

export type RawCnbCommitStatuses = {
  sha?: string | null
  state?: string | null
  statuses?: RawCnbCommitStatus[] | null
}

function classifyCnbStatus(status: string | null | undefined): CheckStatus {
  switch (status?.trim().toLowerCase()) {
    case 'success':
    case 'passed':
      return 'success'
    case 'failure':
    case 'failed':
    case 'error':
    case 'canceled':
    case 'canceled_by_user':
      return 'failure'
    case 'pending':
    case 'running':
    case 'checking':
      return 'pending'
    default:
      return 'neutral'
  }
}

export function deriveCnbCommitStatus(rollup: RawCnbCommitStatuses | null): CheckStatus {
  if (!rollup) {
    return 'neutral'
  }
  const combined = classifyCnbStatus(rollup.state)
  if (combined !== 'neutral') {
    return combined
  }
  const statuses = rollup.statuses ?? []
  if (statuses.length === 0) {
    return 'neutral'
  }
  const classified = statuses.map((status) => classifyCnbStatus(status.state))
  if (classified.includes('failure')) {
    return 'failure'
  }
  if (classified.includes('pending')) {
    return 'pending'
  }
  return classified.every((state) => state === 'success') ? 'success' : 'neutral'
}

export function parseCnbPullNumber(raw: RawCnbPull): number | null {
  const value = typeof raw.number === 'number' ? raw.number : Number.parseInt(raw.number ?? '', 10)
  return Number.isInteger(value) && value > 0 ? value : null
}

export function mapCnbPullRequestState(
  raw: Pick<RawCnbPull, 'is_merged' | 'is_wip' | 'state'>
): CnbPullRequestInfo['state'] {
  if (raw.is_merged || raw.state?.trim().toLowerCase() === 'merged') {
    return 'merged'
  }
  // Closed reviewers can retain their draft flag; terminal state takes precedence.
  if (raw.state?.trim().toLowerCase() === 'closed') {
    return 'closed'
  }
  return raw.is_wip ? 'draft' : 'open'
}

export function mapCnbMergeableState(value: string | null | undefined): PRMergeableState {
  switch (value?.trim().toLowerCase()) {
    case 'mergeable':
    case 'merging':
    case 'merged':
      return 'MERGEABLE'
    case 'conflict':
    case 'no-merge-base':
      return 'CONFLICTING'
    default:
      return 'UNKNOWN'
  }
}

/** CNB reports refs as `refs/heads/<name>`; orca compares bare branch names. */
export function cnbBareRef(ref: string | null | undefined): string | null {
  const trimmed = ref?.trim() ?? ''
  if (!trimmed) {
    return null
  }
  return trimmed.replace(/^refs\/heads\//, '')
}

export function mapCnbPullRequest(
  raw: RawCnbPull,
  url: string,
  status: CheckStatus
): CnbPullRequestInfo | null {
  const number = parseCnbPullNumber(raw)
  const title = raw.title?.trim()
  if (number === null || !title || !url) {
    return null
  }
  const headSha = raw.head?.sha?.trim()
  const baseRefName = cnbBareRef(raw.base?.ref)
  return {
    number,
    title,
    state: mapCnbPullRequestState(raw),
    url,
    status,
    updatedAt: raw.last_acted_at ?? raw.closed_at ?? raw.created_at ?? '',
    mergeable: mapCnbMergeableState(raw.mergeable_state),
    ...(headSha ? { headSha } : {}),
    ...(baseRefName ? { baseRefName } : {})
  }
}
