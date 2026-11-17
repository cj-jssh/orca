import { CNB_WEB_BASE_URL } from './cnb-auth-config'
import type { CnbIssueDetail, CnbIssueSummary } from '../../shared/cnb/cnb-issues'

export type RawCnbLabel = { name?: string | null } | string

export type RawCnbUser = {
  username?: string | null
  nickname?: string | null
}

export type RawCnbRepoInfo = {
  path?: string | null
  name?: string | null
  web_url?: string | null
}

export type RawCnbIssue = {
  number?: string | number | null
  title?: string | null
  state?: string | null
  body?: string | null
  labels?: RawCnbLabel[] | null
  priority?: string | null
  assignees?: RawCnbUser[] | null
  author?: RawCnbUser | null
  comment_count?: number | null
  updated_at?: string | null
  last_acted_at?: string | null
  repo?: RawCnbRepoInfo | null
}

export type RawCnbIssueComment = {
  author?: RawCnbUser | null
  body?: string | null
  created_at?: string | null
}

function labelNames(labels: RawCnbLabel[] | null | undefined): string[] {
  return (labels ?? [])
    .map((label) => (typeof label === 'string' ? label : (label.name ?? '')))
    .filter((name) => name.length > 0)
}

function userNames(users: RawCnbUser[] | null | undefined): string[] {
  return (users ?? [])
    .map((user) => user.username?.trim() || user.nickname?.trim() || '')
    .filter((name) => name.length > 0)
}

export function userName(user: RawCnbUser | null | undefined): string | null {
  return user?.username?.trim() || user?.nickname?.trim() || null
}

/** CNB identifies issues by a string number. */
export function parseIssueNumber(raw: RawCnbIssue): number | null {
  const value = typeof raw.number === 'number' ? raw.number : Number.parseInt(raw.number ?? '', 10)
  return Number.isInteger(value) && value > 0 ? value : null
}

function issueUrl(slug: string | null, number: number): string {
  return slug ? `${CNB_WEB_BASE_URL}/${slug}/-/issues/${number}` : CNB_WEB_BASE_URL
}

export function mapCnbIssueSummary(
  raw: RawCnbIssue,
  fallbackSlug: string | null
): CnbIssueSummary | null {
  const number = parseIssueNumber(raw)
  const title = raw.title?.trim()
  if (number === null || !title) {
    return null
  }
  const slug = raw.repo?.path?.trim() || fallbackSlug
  const webUrl = raw.repo?.web_url?.trim()
  return {
    number,
    title,
    state: raw.state?.trim().toLowerCase() === 'closed' ? 'closed' : 'open',
    url: webUrl ? `${webUrl.replace(/\/+$/, '')}/-/issues/${number}` : issueUrl(slug, number),
    repoSlug: slug ?? null,
    updatedAt: raw.last_acted_at ?? raw.updated_at ?? '',
    labels: labelNames(raw.labels),
    priority: raw.priority?.trim() || null,
    assignees: userNames(raw.assignees),
    author: userName(raw.author),
    commentCount: typeof raw.comment_count === 'number' ? raw.comment_count : 0
  }
}

export function mapIssueDetail(raw: RawCnbIssue, slug: string | null): CnbIssueDetail | null {
  const summary = mapCnbIssueSummary(raw, slug)
  return summary ? { ...summary, body: raw.body ?? '' } : null
}
