import { getCnbPullRequest, getCnbPullRequestForBranchOrThrow, getCnbRepoSlug } from '../cnb/client'
import { createCnbPullRequest } from '../cnb/pull-request-creation'
import type { ForgeProvider } from './forge-provider'
import { forgeConnectionId, hostedReviewExecutionArgs } from './forge-provider-context'
import { mapCnbReview } from './forge-review-mappers'

export const cnbForgeProvider = {
  id: 'cnb',
  supportsReviewCreation: true,
  resolveRepository: (context) =>
    getCnbRepoSlug(
      context.repoPath,
      forgeConnectionId(context),
      ...hostedReviewExecutionArgs(context)
    ),
  async getReviewForBranch(input) {
    // Lookup failure is unavailable, never proof no review exists.
    const pr = await getCnbPullRequestForBranchOrThrow(
      input.repoPath,
      input.branch,
      input.linkedReviewNumber ?? null,
      forgeConnectionId(input),
      ...hostedReviewExecutionArgs(input)
    )
    return pr ? mapCnbReview(pr) : null
  },
  async getReviewByNumber(input) {
    const pr = await getCnbPullRequest(
      input.repoPath,
      input.number,
      forgeConnectionId(input),
      ...hostedReviewExecutionArgs(input)
    )
    return pr ? mapCnbReview(pr) : null
  },
  createReview: createCnbPullRequest
} satisfies ForgeProvider
