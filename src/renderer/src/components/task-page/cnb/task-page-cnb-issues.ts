import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { CnbIssueSummary } from '../../../../../shared/cnb/cnb-issues'
import { parseCnbRemoteUrl } from '../../../../../shared/cnb/cnb-remote-url'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { RepoBackedTaskEmptyState } from '../task-page-empty-state'

/** A CNB issue row stamped with the repo row that returned it. */
export type CnbTaskItem = CnbIssueSummary & {
  /** Null when the issue's repository is not one of Orca's projects. */
  repoId: string | null
  repoHostId?: ExecutionHostId
  repoPath: string | null
}

/** Only cnb.cool projects can answer the CNB issue API. */
export function getCnbEligibleRepos(repos: readonly Repo[]): Repo[] {
  return repos.filter((repo) => parseCnbRemoteUrl(repo.gitRemoteIdentity?.remoteUrl ?? '') !== null)
}

/** CNB reports a repository path; map it back to the project row that owns it. */
export function getCnbRepoBySlug(repos: readonly Repo[]): Map<string, Repo> {
  const bySlug = new Map<string, Repo>()
  for (const repo of repos) {
    const parsed = parseCnbRemoteUrl(repo.gitRemoteIdentity?.remoteUrl ?? '')
    if (parsed) {
      bySlug.set(parsed.slug, repo)
    }
  }
  return bySlug
}

/** CNB rows can be empty for two very different reasons, so name which one the user can fix. */
export function getCnbTaskEmptyState(
  args: { selectedRepoCount: number; eligibleRepoCount: number },
  t: Translate = translate
): RepoBackedTaskEmptyState {
  if (args.eligibleRepoCount === 0) {
    return args.selectedRepoCount === 0
      ? {
          title: t(
            'auto.components.taskPageEmptyState.noProjectSourcesTitle',
            'No project sources selected'
          ),
          description: t(
            'auto.components.taskPageEmptyState.noProjectSourcesDescription',
            'Select at least one project source so Orca knows which host/account to fetch tasks from.'
          )
        }
      : {
          title: t('auto.components.taskPageEmptyState.noCnbRepoTitle', 'No cnb.cool project'),
          description: t(
            'auto.components.taskPageEmptyState.noCnbRepoDescription',
            'CNB tasks read issues from cnb.cool repositories. Select one of those projects to see its issues.'
          )
        }
  }
  return {
    title: t('auto.components.taskPageEmptyState.noCnbIssuesTitle', 'No CNB issues'),
    description: t(
      'auto.components.taskPageEmptyState.noCnbIssuesDescription',
      'No CNB issues match this filter in the selected cnb.cool repositories.'
    )
  }
}
