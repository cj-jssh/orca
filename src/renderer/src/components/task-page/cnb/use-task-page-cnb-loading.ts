import type { TaskPageProviderMetadataModel } from '../use-task-page-provider-metadata'
import { useEffect, useMemo, useRef } from 'react'
import { listCnbIssues } from '@/lib/work-items/cnb/cnb-issue-client'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import { getCnbRepoBySlug, type CnbTaskItem } from './task-page-cnb-issues'

type CnbLoadingInput = Pick<
  TaskPageProviderMetadataModel,
  | 'taskSource'
  | 'selectedReposKey'
  | 'cnbEligibleRepos'
  | 'cnbFilter'
  | 'cnbScope'
  | 'cnbRefreshNonce'
  | 'setCnbItems'
  | 'setCnbLoading'
  | 'setCnbError'
>

export function useTaskPageCnbLoading<Model extends CnbLoadingInput>(model: Model): Model {
  const {
    taskSource,
    selectedReposKey,
    cnbEligibleRepos,
    cnbFilter,
    cnbScope,
    cnbRefreshNonce,
    setCnbItems,
    setCnbLoading,
    setCnbError
  } = model
  // Why the key: the fetched paths are the query, so the array identity must not restart the effect.
  const cnbRepoPathsKey = useMemo(
    () => cnbEligibleRepos.map((repo) => repo.path).join('\u0000'),
    [cnbEligibleRepos]
  )
  const cnbReposRef = useRef<readonly Repo[]>(cnbEligibleRepos)
  cnbReposRef.current = cnbEligibleRepos

  useEffect(() => {
    if (taskSource !== 'cnb') {
      return
    }
    const repos = cnbReposRef.current
    // Why: a personal issue list is token-scoped, so it needs no selected project to answer.
    if (cnbScope === 'repo' && repos.length === 0) {
      setCnbItems([])
      setCnbLoading(false)
      setCnbError(null)
      return
    }
    let stale = false
    setCnbLoading(true)
    setCnbError(null)
    const bySlug = getCnbRepoBySlug(repos)
    void listCnbIssues({
      repoPaths: cnbScope === 'repo' ? repos.map((repo) => repo.path) : [],
      state: cnbFilter === 'all' ? undefined : cnbFilter,
      mine: cnbScope === 'mine'
    })
      .then((result) => {
        if (stale) {
          return
        }
        const items: CnbTaskItem[] = result.issues.map((issue) => {
          // Why the slug: a personal list spans repositories, so each row names its own project.
          const repo = issue.repoSlug ? bySlug.get(issue.repoSlug) : undefined
          return {
            ...issue,
            repoId: repo?.id ?? null,
            ...(repo ? { repoHostId: getRepoExecutionHostId(repo) } : {}),
            repoPath: repo?.path ?? null
          }
        })
        setCnbItems(items)
        setCnbError(result.error)
      })
      .catch((error: unknown) => {
        if (!stale) {
          setCnbItems([])
          setCnbError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!stale) {
          setCnbLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [
    taskSource,
    selectedReposKey,
    cnbRepoPathsKey,
    cnbFilter,
    cnbScope,
    cnbRefreshNonce,
    setCnbItems,
    setCnbError,
    setCnbLoading
  ])

  return model
}
export type TaskPageCnbLoadingModel = ReturnType<
  typeof useTaskPageCnbLoading<TaskPageProviderMetadataModel>
>
