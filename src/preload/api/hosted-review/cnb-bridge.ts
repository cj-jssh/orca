import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../../api-types'
import type {
  CnbConnectArgs,
  CnbConnectResult,
  CnbConnectionStatus
} from '../../../shared/cnb/cnb-credentials'
import type {
  CnbCreateIssueArgs,
  CnbCreateIssueResult,
  CnbIssueContextResult,
  CnbIssueDetailResult,
  CnbIssueListResult,
  CnbMyIssuesArgs,
  CnbRepoIssuesArgs
} from '../../../shared/cnb/cnb-issues'

export const cnbApi = {
  connect: (args: CnbConnectArgs): Promise<CnbConnectResult> =>
    ipcRenderer.invoke('cnb:connect', args),

  disconnect: (): Promise<void> => ipcRenderer.invoke('cnb:disconnect'),

  status: (): Promise<CnbConnectionStatus> => ipcRenderer.invoke('cnb:status'),

  listRepoIssues: (args: CnbRepoIssuesArgs): Promise<CnbIssueListResult> =>
    ipcRenderer.invoke('cnb:issues:repo', args),

  listMyIssues: (args: CnbMyIssuesArgs): Promise<CnbIssueListResult> =>
    ipcRenderer.invoke('cnb:issues:mine', args),

  getIssue: (args: { repoPath: string; number: number }): Promise<CnbIssueDetailResult> =>
    ipcRenderer.invoke('cnb:issue:get', args),

  issueContext: (args: { repoPath: string; number: number }): Promise<CnbIssueContextResult> =>
    ipcRenderer.invoke('cnb:issue:context', args),

  createIssue: (args: CnbCreateIssueArgs): Promise<CnbCreateIssueResult> =>
    ipcRenderer.invoke('cnb:issue:create', args)
} satisfies PreloadApi['cnb']
