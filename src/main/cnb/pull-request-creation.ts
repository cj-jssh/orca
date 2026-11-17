import type { ExecutionHostId } from '../../shared/execution-host/execution-host'
import type {
  CreateHostedReviewInput,
  CreateHostedReviewResult
} from '../../shared/source-control/hosted-review/hosted-review-contracts'
import {
  normalizeHostedReviewBaseRef,
  normalizeHostedReviewHeadRef
} from '../../shared/source-control/hosted-review/hosted-review-refs'
import {
  HostedReviewApiRequestError,
  requestHostedReviewJson
} from '../source-control/hosted-review-api-request'
import { readHostedPullRequestTemplate } from '../source-control/pull-request-template'
import { hostedReviewSshConnectionId } from '../source-control/hosted-review-execution-host'
import { CNB_API_BASE_URL } from './cnb-auth-config'
import { resolveCnbToken } from './resolve-auth'
import { getCnbPullRequestForBranch, invalidateCnbPullRequestScanForRepo } from './client'
import { cnbReviewUrl, getCnbRepoRef, type CnbRepoRef } from './repository-ref'
import type { RawCnbPull } from './pull-request-mappers'

const CREATE_REQUEST_TIMEOUT_MS = 60_000

export function isCnbReviewCreationAuthenticated(): boolean {
  return resolveCnbToken() !== null
}

function authHeaders(): Record<string, string> {
  const token = resolveCnbToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function apiUrl(repo: CnbRepoRef): URL {
  return new URL(`${CNB_API_BASE_URL}/${repo.slug}/-/pulls`)
}

function apiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function classifyCreateError(error: unknown): CreateHostedReviewResult {
  const message = apiErrorMessage(error)
  if (message) {
    console.warn('createCnbPullRequest failed:', message)
  }
  const lower = message.toLowerCase()
  const status = error instanceof HostedReviewApiRequestError ? error.status : null
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('not logged in')
  ) {
    return {
      ok: false,
      code: 'auth_required',
      error:
        'Create PR failed: CNB is not authenticated. Next step: set ORCA_CNB_TOKEN or connect CNB in Settings > Integrations.',
      reason: 'auth_required'
    }
  }
  if (status === 409 || lower.includes('already exists') || lower.includes('already open')) {
    return {
      ok: false,
      code: 'already_exists',
      error: 'A pull request already exists for this branch.',
      reason: 'existing_review'
    }
  }
  if (error instanceof HostedReviewApiRequestError && error.timedOut) {
    return {
      ok: false,
      code: 'unknown_completion',
      error: 'PR creation may have completed. Refreshing branch review state...',
      reason: 'creation_unconfirmed'
    }
  }
  if (status === 400 || status === 422 || lower.includes('validation')) {
    return {
      ok: false,
      code: 'validation',
      error:
        'Create PR failed: CNB rejected the pull request. Check the base branch and branch state, then try again.',
      reason: 'rejected'
    }
  }
  return {
    ok: false,
    code: 'unknown',
    error: 'Create PR failed: CNB could not create the pull request. Try again in a moment.',
    reason: 'create_failed'
  }
}

async function findExistingPullRequest(
  repoPath: string,
  head: string,
  connectionId?: string | null
): Promise<{ number: number; url: string } | null> {
  // A create attempt may already have mutated the remote; discard pre-POST listings.
  const repo = await getCnbRepoRef(repoPath, connectionId)
  if (repo) {
    invalidateCnbPullRequestScanForRepo(repo)
  }
  const existing = await getCnbPullRequestForBranch(repoPath, head, null, connectionId)
  return existing ? { number: existing.number, url: existing.url } : null
}

export async function createCnbPullRequest(
  repoPath: string,
  input: CreateHostedReviewInput,
  executionHostId: ExecutionHostId
): Promise<CreateHostedReviewResult> {
  if (input.provider !== 'cnb') {
    return {
      ok: false,
      code: 'unsupported_provider',
      error: 'Creating reviews for this provider is not supported yet.',
      reason: 'provider_not_supported'
    }
  }

  // The CNB REST calls run on this client; only the git reads under them are routed.
  const connectionId = hostedReviewSshConnectionId(executionHostId)

  const repo = await getCnbRepoRef(repoPath, connectionId)
  if (!repo) {
    return {
      ok: false,
      code: 'unsupported_provider',
      error: 'Creating pull requests requires a cnb.cool remote.',
      reason: 'unsupported_provider'
    }
  }

  const base = normalizeHostedReviewBaseRef(input.base)
  const head = input.head ? normalizeHostedReviewHeadRef(input.head) : ''
  const title = input.title.trim()
  if (!base || !head || !title) {
    return {
      ok: false,
      code: 'validation',
      error: 'Create PR failed: base branch, head branch, and title are required.',
      reason: 'base_head_title_required'
    }
  }
  if (head.toLowerCase() === base.toLowerCase()) {
    return {
      ok: false,
      code: 'validation',
      error: 'Create PR failed: choose a different base branch before creating a pull request.',
      reason: 'same_base_branch'
    }
  }

  const body =
    input.useTemplate && !input.body?.trim()
      ? await readHostedPullRequestTemplate(repoPath, connectionId)
      : (input.body ?? '')
  // CNB has no draft flag on creation; drafts are the WIP title convention.
  const requestBody = {
    base,
    head,
    title: input.draft ? `WIP: ${title}` : title,
    body
  }

  try {
    const raw = await requestHostedReviewJson<RawCnbPull>(
      apiUrl(repo),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify(requestBody)
      },
      CREATE_REQUEST_TIMEOUT_MS
    )
    const number = raw.number === undefined ? null : Number.parseInt(String(raw.number), 10)
    if (number !== null && Number.isInteger(number) && number > 0) {
      invalidateCnbPullRequestScanForRepo(repo)
      return { ok: true, number, url: cnbReviewUrl(repo, number) }
    }
    const found = await findExistingPullRequest(repoPath, head, connectionId).catch(() => null)
    return found
      ? { ok: true, ...found }
      : {
          ok: false,
          code: 'unknown_completion',
          error: 'PR creation may have completed. Refreshing branch review state...',
          reason: 'creation_unconfirmed'
        }
  } catch (error) {
    const classified = classifyCreateError(error)
    if (
      !classified.ok &&
      (classified.code === 'already_exists' || classified.code === 'unknown_completion')
    ) {
      const existing = await findExistingPullRequest(repoPath, head, connectionId).catch(() => null)
      if (existing) {
        return {
          ok: false,
          code: 'already_exists',
          error: 'A pull request already exists for this branch.',
          reason: 'existing_review',
          existingReview: existing
        }
      }
    }
    return classified
  }
}
