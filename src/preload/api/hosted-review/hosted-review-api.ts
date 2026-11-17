import type {
  BitbucketConnectArgs,
  BitbucketConnectResult,
  BitbucketConnectionStatus
} from '../../../shared/bitbucket/bitbucket-credentials'
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
import type {
  CreateHostedReviewArgs,
  CreateHostedReviewResult,
  CreateStackedHostedReviewArgs,
  CreateStackedHostedReviewResult,
  HostedReviewCreationEligibility,
  HostedReviewCreationEligibilityArgs,
  HostedReviewForBranchArgs,
  HostedReviewForBranchReply,
  HostedReviewInfo
} from '../../../shared/source-control/hosted-review/hosted-review-contracts'

export type HostedReviewApi = {
  forBranch: {
    (
      args: HostedReviewForBranchArgs & { reportReadOutcome?: false }
    ): Promise<HostedReviewInfo | null>
    (args: HostedReviewForBranchArgs): Promise<HostedReviewForBranchReply>
  }
  getCreationEligibility: (
    args: HostedReviewCreationEligibilityArgs
  ) => Promise<HostedReviewCreationEligibility>
  create: (args: CreateHostedReviewArgs) => Promise<CreateHostedReviewResult>
  createStacked: (args: CreateStackedHostedReviewArgs) => Promise<CreateStackedHostedReviewResult>
}

export type BitbucketApi = {
  connect: (args: BitbucketConnectArgs) => Promise<BitbucketConnectResult>
  disconnect: () => Promise<void>
  status: () => Promise<BitbucketConnectionStatus>
}

export type CnbApi = {
  connect: (args: CnbConnectArgs) => Promise<CnbConnectResult>
  disconnect: () => Promise<void>
  status: () => Promise<CnbConnectionStatus>
  listRepoIssues: (args: CnbRepoIssuesArgs) => Promise<CnbIssueListResult>
  listMyIssues: (args: CnbMyIssuesArgs) => Promise<CnbIssueListResult>
  getIssue: (args: { repoPath: string; number: number }) => Promise<CnbIssueDetailResult>
  issueContext: (args: { repoPath: string; number: number }) => Promise<CnbIssueContextResult>
  createIssue: (args: CnbCreateIssueArgs) => Promise<CnbCreateIssueResult>
}
