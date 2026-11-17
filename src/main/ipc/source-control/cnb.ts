import { ipcMain } from 'electron'
import { connectCnb, disconnectCnb, getCnbConnectionStatus } from '../../cnb/credential-connection'
import {
  buildCnbIssueContext,
  createCnbIssue,
  getCnbIssue,
  listCnbMyIssues,
  listCnbRepoIssues
} from '../../cnb/issues'
import { _resetPreflightCache } from '../../preflight/agent-detection'
import {
  cnbConnectFailure,
  type CnbConnectArgs,
  type CnbConnectResult,
  type CnbConnectionStatus
} from '../../../shared/cnb/cnb-credentials'
import {
  CNB_ISSUE_FAILURE_COPY,
  type CnbCreateIssueArgs,
  type CnbCreateIssueResult,
  type CnbIssueContextResult,
  type CnbIssueDetailResult,
  type CnbIssueListResult,
  type CnbMyIssuesArgs,
  type CnbRepoIssuesArgs
} from '../../../shared/cnb/cnb-issues'

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : undefined
}

function issueState(value: unknown): 'open' | 'closed' | undefined {
  return value === 'open' || value === 'closed' ? value : undefined
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function normalizeConnectInput(value: unknown): CnbConnectArgs | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  return { token: optionalString((value as Record<string, unknown>).token) }
}

function normalizeRepoIssuesArgs(value: unknown): CnbRepoIssuesArgs | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const raw = value as Record<string, unknown>
  const repoPath = optionalString(raw.repoPath)
  if (!repoPath) {
    return null
  }
  return {
    repoPath,
    ...(issueState(raw.state) ? { state: issueState(raw.state) } : {}),
    ...(optionalString(raw.keyword) ? { keyword: optionalString(raw.keyword)! } : {}),
    ...(positiveInt(raw.page) ? { page: positiveInt(raw.page) } : {}),
    ...(positiveInt(raw.pageSize) ? { pageSize: positiveInt(raw.pageSize) } : {})
  }
}

function normalizeMyIssuesArgs(value: unknown): CnbMyIssuesArgs {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    filter: raw.filter === 'created' ? 'created' : 'assigned',
    ...(issueState(raw.state) ? { state: issueState(raw.state) } : {}),
    ...(positiveInt(raw.page) ? { page: positiveInt(raw.page) } : {}),
    ...(positiveInt(raw.pageSize) ? { pageSize: positiveInt(raw.pageSize) } : {})
  }
}

function normalizeIssueRef(value: unknown): { repoPath: string; number: number } | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const raw = value as Record<string, unknown>
  const repoPath = optionalString(raw.repoPath)
  const number = positiveInt(raw.number)
  return repoPath && number ? { repoPath, number } : null
}

function normalizeCreateIssueArgs(value: unknown): CnbCreateIssueArgs | null {
  const ref = normalizeIssueRef({ ...(value as object), number: 1 })
  if (!ref || !value || typeof value !== 'object') {
    return null
  }
  const raw = value as Record<string, unknown>
  const title = optionalString(raw.title)?.trim() ?? ''
  if (!title) {
    return null
  }
  return {
    repoPath: ref.repoPath,
    title,
    ...(optionalString(raw.body) ? { body: optionalString(raw.body)! } : {}),
    ...(stringList(raw.labels) ? { labels: stringList(raw.labels) } : {}),
    ...(optionalString(raw.priority) ? { priority: optionalString(raw.priority)! } : {}),
    ...(stringList(raw.assignees) ? { assignees: stringList(raw.assignees) } : {}),
    ...(raw.invisible === true ? { invisible: true } : {})
  }
}

export function registerCnbHandlers(): void {
  ipcMain.handle('cnb:connect', async (_event, args: unknown): Promise<CnbConnectResult> => {
    const input = normalizeConnectInput(args)
    if (!input) {
      return cnbConnectFailure('tokenRequired')
    }
    const result = await connectCnb(input)
    if (result.ok) {
      // Refresh cached source-control preflight so reconnection needs no relaunch.
      _resetPreflightCache()
    }
    return result
  })

  ipcMain.handle('cnb:disconnect', async (): Promise<void> => {
    disconnectCnb()
    _resetPreflightCache()
  })

  ipcMain.handle('cnb:status', async (): Promise<CnbConnectionStatus> => {
    return getCnbConnectionStatus()
  })

  ipcMain.handle('cnb:issues:repo', async (_event, args: unknown): Promise<CnbIssueListResult> => {
    const input = normalizeRepoIssuesArgs(args)
    if (!input) {
      return { ok: false, error: CNB_ISSUE_FAILURE_COPY.rejected, errorCode: 'rejected' }
    }
    return listCnbRepoIssues(input)
  })

  ipcMain.handle('cnb:issues:mine', async (_event, args: unknown): Promise<CnbIssueListResult> => {
    return listCnbMyIssues(normalizeMyIssuesArgs(args))
  })

  ipcMain.handle('cnb:issue:get', async (_event, args: unknown): Promise<CnbIssueDetailResult> => {
    const input = normalizeIssueRef(args)
    if (!input) {
      return { ok: false, error: CNB_ISSUE_FAILURE_COPY.rejected, errorCode: 'rejected' }
    }
    return getCnbIssue(input)
  })

  ipcMain.handle(
    'cnb:issue:context',
    async (_event, args: unknown): Promise<CnbIssueContextResult> => {
      const input = normalizeIssueRef(args)
      if (!input) {
        return { ok: false, error: CNB_ISSUE_FAILURE_COPY.rejected, errorCode: 'rejected' }
      }
      return buildCnbIssueContext(input)
    }
  )

  ipcMain.handle(
    'cnb:issue:create',
    async (_event, args: unknown): Promise<CnbCreateIssueResult> => {
      const input = normalizeCreateIssueArgs(args)
      if (!input) {
        return {
          ok: false,
          error: CNB_ISSUE_FAILURE_COPY.titleRequired,
          errorCode: 'titleRequired'
        }
      }
      return createCnbIssue(input)
    }
  )
}
