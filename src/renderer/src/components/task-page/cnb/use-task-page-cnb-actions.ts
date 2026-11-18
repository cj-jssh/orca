import type { TaskPageComposerActionsModel } from '../use-task-page-composer-actions'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { createCnbIssue } from '@/lib/work-items/cnb/cnb-issue-client'
import type { LinkedWorkItemSummary } from '@/lib/workspace/creation/new-workspace'
import { getTaskPageRepoSourceContext } from '../../../lib/work-items/task-repo-source-context'
import { getCnbIssueWorkspaceSeed } from '../task-page-source-context'
import type { CnbTaskItem } from './task-page-cnb-issues'

/** The Tasks page model after the CNB composer actions are attached. */
export type TaskPageCnbActionsModel = TaskPageComposerActionsModel & TaskPageCnbActions

export type TaskPageCnbActions = {
  handleUseCnbIssue: (item: CnbTaskItem) => void
  handleCreateCnbIssue: () => Promise<void>
}

export function useTaskPageCnbActions(
  model: TaskPageComposerActionsModel
): TaskPageCnbActionsModel {
  const {
    repos,
    openModal,
    cnbNewIssue,
    setCnbNewIssue,
    cnbNewIssueSubmitting,
    setCnbNewIssueSubmitting,
    setCnbNewIssueOpen,
    cnbNewIssueTargetRepo,
    setCnbRefreshNonce
  } = model

  const handleUseCnbIssue = useCallback(
    (item: CnbTaskItem): void => {
      if (!item.repoId) {
        return
      }
      const repo = repos.find((entry) => entry.id === item.repoId) ?? null
      const linkedWorkItem: LinkedWorkItemSummary = {
        provider: 'cnb',
        type: 'issue',
        number: item.number,
        title: item.title,
        url: item.url,
        repoId: item.repoId
      }
      useAppStore.getState().recordFeatureInteraction('cnb-tasks')
      openModal('new-workspace-composer', {
        linkedWorkItem,
        taskSourceContext: getTaskPageRepoSourceContext(repo, 'cnb'),
        prefilledName: getCnbIssueWorkspaceSeed(item),
        initialRepoId: item.repoId,
        telemetrySource: 'sidebar'
      })
    },
    [openModal, repos]
  )

  const handleCreateCnbIssue = useCallback(async (): Promise<void> => {
    const targetRepo = cnbNewIssueTargetRepo
    const title = cnbNewIssue.title.trim()
    if (!targetRepo || !title || cnbNewIssueSubmitting) {
      return
    }
    setCnbNewIssueSubmitting(true)
    try {
      const result = await createCnbIssue({
        repoPath: targetRepo.path,
        title,
        ...(cnbNewIssue.body.trim() ? { body: cnbNewIssue.body } : {})
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        translate('auto.components.TaskPage.cnbIssueCreated', 'Opened issue #{{value0}}', {
          value0: result.issue.number
        }),
        {
          action: {
            label: translate('auto.components.TaskPage.9c57663908', 'View'),
            onClick: () => openAppHttpLink(result.issue.url)
          }
        }
      )
      setCnbNewIssueOpen(false)
      setCnbNewIssue({ repoId: targetRepo.id, title: '', body: '' })
      setCnbRefreshNonce((nonce) => nonce + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setCnbNewIssueSubmitting(false)
    }
  }, [
    cnbNewIssue.body,
    cnbNewIssue.title,
    cnbNewIssueSubmitting,
    cnbNewIssueTargetRepo,
    setCnbNewIssue,
    setCnbNewIssueOpen,
    setCnbNewIssueSubmitting,
    setCnbRefreshNonce
  ])

  return Object.assign(model, { handleUseCnbIssue, handleCreateCnbIssue })
}
