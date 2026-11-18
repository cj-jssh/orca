import type {
  CnbCreateIssueArgs,
  CnbCreateIssueResult,
  CnbIssueState,
  CnbIssueSummary
} from '../../../../../shared/cnb/cnb-issues'

export type CnbIssueListScope = {
  /** Repository paths to fan out over; ignored when `mine` is set. */
  repoPaths: readonly string[]
  /** Undefined lists both open and closed issues. */
  state: CnbIssueState | undefined
  /** Assigned-to-me across every repository, instead of per-repository lists. */
  mine: boolean
  keyword?: string
}

export type CnbIssueListResult = {
  issues: CnbIssueSummary[]
  /** Null when at least one repository answered, or when nothing failed. */
  error: string | null
}

/**
 * CNB lists issues one repository at a time, so a multi-project selection fans out.
 * A failure in one repository must not hide the rows the others returned.
 */
export async function listCnbIssues(scope: CnbIssueListScope): Promise<CnbIssueListResult> {
  if (scope.mine) {
    const result = await window.api.cnb.listMyIssues({
      filter: 'assigned',
      state: scope.state,
      pageSize: 50
    })
    return result.ok ? { issues: result.issues, error: null } : { issues: [], error: result.error }
  }
  if (scope.repoPaths.length === 0) {
    return { issues: [], error: null }
  }
  const settled = await Promise.allSettled(
    scope.repoPaths.map((repoPath) =>
      window.api.cnb.listRepoIssues({
        repoPath,
        state: scope.state,
        pageSize: 50,
        ...(scope.keyword?.trim() ? { keyword: scope.keyword.trim() } : {})
      })
    )
  )
  const issues: CnbIssueSummary[] = []
  let error: string | null = null
  for (const result of settled) {
    if (result.status === 'rejected') {
      error ??= result.reason instanceof Error ? result.reason.message : String(result.reason)
    } else if (!result.value.ok) {
      error ??= result.value.error
    } else {
      issues.push(...result.value.issues)
    }
  }
  issues.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { issues, error: issues.length > 0 ? null : error }
}

export function createCnbIssue(args: CnbCreateIssueArgs): Promise<CnbCreateIssueResult> {
  return window.api.cnb.createIssue(args)
}
