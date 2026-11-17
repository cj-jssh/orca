export type CnbIssueState = 'open' | 'closed'

/** CNB identifies issues by a string number, like its reviews. */
export type CnbIssueSummary = {
  number: number
  title: string
  state: CnbIssueState
  url: string
  repoSlug: string | null
  updatedAt: string
  labels: string[]
  priority: string | null
  assignees: string[]
  author: string | null
  commentCount: number
}

export type CnbIssueDetail = CnbIssueSummary & {
  body: string
}

/** Issues assigned to, or created by, the token's user across every CNB repository. */
export type CnbMyIssuesArgs = {
  filter: 'assigned' | 'created'
  state?: CnbIssueState
  page?: number
  pageSize?: number
}

export type CnbRepoIssuesArgs = {
  repoPath: string
  state?: CnbIssueState
  keyword?: string
  page?: number
  pageSize?: number
}

export type CnbIssueRefArgs = {
  repoPath: string
  number: number
}

export type CnbCreateIssueArgs = {
  repoPath: string
  title: string
  body?: string
  labels?: string[]
  priority?: string
  assignees?: string[]
  invisible?: boolean
}

export type CnbIssueListResult =
  | { ok: true; issues: CnbIssueSummary[] }
  | { ok: false; error: string; errorCode?: string }

export type CnbIssueDetailResult =
  | { ok: true; issue: CnbIssueDetail }
  | { ok: false; error: string; errorCode?: string }

export type CnbCreateIssueResult =
  | { ok: true; issue: CnbIssueSummary }
  | { ok: false; error: string; errorCode?: string }

/** Single markdown block a workspace can paste into an agent prompt. */
export type CnbIssueContextResult =
  | { ok: true; markdown: string; issue: CnbIssueDetail }
  | { ok: false; error: string; errorCode?: string }

export const CNB_ISSUE_FAILURE_COPY = {
  authRequired:
    'CNB is not authenticated. Next step: set ORCA_CNB_TOKEN or connect CNB in Settings > Integrations.',
  unreachable: 'Could not reach CNB. Check your connection, then try again.',
  rejected: 'CNB rejected the request. Check the repository, issue number, and token permissions.',
  titleRequired: 'Enter an issue title.'
} as const

export type CnbIssueFailureCode = keyof typeof CNB_ISSUE_FAILURE_COPY
