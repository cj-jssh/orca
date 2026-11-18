import type { TaskPageSourceAvailabilityModel } from './use-task-page-source-availability'
import { useRef, useState, useEffect, useMemo } from 'react'
import { resolveVisibleTaskProvider } from '../../../../shared/work-items/task-providers'
import type {
  CnbIssueFilter,
  CnbIssueScope,
  GitLabTaskFilter,
  GitLabIssueFilter
} from '@/components/task-page/task-page-localized-options'
import type {
  GitLabMRInvolvement,
  GitLabWorkItem,
  GitLabTodo
} from '../../../../shared/gitlab/gitlab-types'
import { getRepoBackedTaskEmptyState } from './task-page-empty-state'
import { isGitLabIssueFilter, isGitLabMRFilter } from './task-page-source-context'
import type { CnbTaskItem } from './cnb/task-page-cnb-issues'
import { getCnbEligibleRepos, getCnbTaskEmptyState } from './cnb/task-page-cnb-issues'

export type TaskPageCnbNewIssueDraft = {
  repoId: string | null
  title: string
  body: string
}
export function useTaskPageProviderState(model: TaskPageSourceAvailabilityModel) {
  const {
    settings,
    pageData,
    selectedRepos,
    visibleTaskProviders,
    preferredTaskSource,
    taskSource,
    setTaskSource
  } = model
  const taskSourceManuallyChangedRef = useRef(false)
  const lastPageTaskSourceRef = useRef(pageData.taskSource)
  const taskResumeAppliedRef = useRef(false)
  const githubSearchPersistReadyRef = useRef(false)
  const linearSearchPersistReadyRef = useRef(false)
  const linearViewPersistReadyRef = useRef(false)
  const jiraSearchPersistReadyRef = useRef(false)
  const [taskResumeApplied, setTaskResumeApplied] = useState(false)

  // Sidebar source clicks change pageData after mount; synchronize beyond useState’s initial value.
  useEffect(() => {
    const pageTaskSourceChanged = lastPageTaskSourceRef.current !== pageData.taskSource
    lastPageTaskSourceRef.current = pageData.taskSource
    if (pageData.taskSource) {
      if (pageTaskSourceChanged) {
        taskSourceManuallyChangedRef.current = false
      } else if (taskSourceManuallyChangedRef.current) {
        return
      }
      setTaskSource(resolveVisibleTaskProvider(pageData.taskSource, visibleTaskProviders))
    }
  }, [pageData.taskSource, visibleTaskProviders, setTaskSource])
  useEffect(() => {
    if (taskSourceManuallyChangedRef.current) {
      return
    }
    // Why: GitLab/Linear availability hydrates after mount; restore the saved default once its provider check proves it can be shown.
    if (visibleTaskProviders.includes(preferredTaskSource) && taskSource !== preferredTaskSource) {
      setTaskSource(preferredTaskSource)
    }
  }, [preferredTaskSource, taskSource, visibleTaskProviders, setTaskSource])
  useEffect(() => {
    if (!visibleTaskProviders.includes(taskSource)) {
      setTaskSource(resolveVisibleTaskProvider(settings?.defaultTaskSource, visibleTaskProviders))
    }
  }, [settings?.defaultTaskSource, taskSource, visibleTaskProviders, setTaskSource])

  const projectModeVisible = taskSource === 'github'
  const [githubMode, setGithubMode] = useState<'items' | 'project'>('items')

  // Like Linear, fetch GitLab directly for the primary repo without GitHub’s workItemsCache/aggregation path.
  const [gitlabFilter, setGitlabFilter] = useState<GitLabTaskFilter | GitLabIssueFilter>('opened')
  const [gitlabMRInvolvement, setGitlabMRInvolvement] = useState<GitLabMRInvolvement | null>(null)
  const [gitlabItems, setGitlabItems] = useState<GitLabWorkItem[]>([])
  const [gitlabListQueryKey, setGitlabListQueryKey] = useState<string | null>(null)
  const [gitlabLoading, setGitlabLoading] = useState(false)
  const [gitlabError, setGitlabError] = useState<string | null>(null)
  const [gitlabRefreshNonce, setGitlabRefreshNonce] = useState(0)
  // Keep dialog targets outside the list so filtering/refresh cannot remove their context.
  const [gitlabDialogItem, setGitlabDialogItem] = useState<GitLabWorkItem | null>(null)

  const [cnbFilter, setCnbFilter] = useState<CnbIssueFilter>('open')
  const [cnbScope, setCnbScope] = useState<CnbIssueScope>('repo')
  const [cnbItems, setCnbItems] = useState<CnbTaskItem[]>([])
  const [cnbLoading, setCnbLoading] = useState(false)
  const [cnbError, setCnbError] = useState<string | null>(null)
  const [cnbRefreshNonce, setCnbRefreshNonce] = useState(0)
  const [cnbNewIssueOpen, setCnbNewIssueOpen] = useState(false)
  const [cnbNewIssueSubmitting, setCnbNewIssueSubmitting] = useState(false)
  const [cnbNewIssue, setCnbNewIssue] = useState<TaskPageCnbNewIssueDraft>({
    repoId: null,
    title: '',
    body: ''
  })
  // CNB answers one repository at a time, so only cnb.cool projects may join the fan-out.
  const cnbEligibleRepos = useMemo(() => getCnbEligibleRepos(selectedRepos), [selectedRepos])
  const cnbNewIssueTargetRepo = useMemo(() => {
    const preferred = cnbEligibleRepos.find((repo) => repo.id === cnbNewIssue.repoId)
    return preferred ?? cnbEligibleRepos[0] ?? null
  }, [cnbEligibleRepos, cnbNewIssue.repoId])
  const cnbEmptyState = useMemo(
    () =>
      getCnbTaskEmptyState({
        selectedRepoCount: selectedRepos.length,
        eligibleRepoCount: cnbEligibleRepos.length
      }),
    [cnbEligibleRepos.length, selectedRepos.length]
  )

  const [gitlabView, setGitlabView] = useState<'issues' | 'mrs' | 'todos'>('mrs')
  const [gitlabTodos, setGitlabTodos] = useState<GitLabTodo[]>([])
  const [gitlabTodosLoading, setGitlabTodosLoading] = useState(false)
  const gitlabEmptyState = useMemo(
    () =>
      getRepoBackedTaskEmptyState({
        provider: 'gitlab',
        selectedRepoCount: selectedRepos.length,
        gitlabView
      }),
    [gitlabView, selectedRepos.length]
  )
  const gitlabFilterIsValid =
    gitlabView === 'issues'
      ? isGitLabIssueFilter(gitlabFilter)
      : gitlabView === 'mrs'
        ? isGitLabMRFilter(gitlabFilter)
        : true
  const activeGitlabFilter = gitlabFilterIsValid ? gitlabFilter : 'opened'
  // Why: Issues and MRs expose different filter sets; repair before commit so fetch effects never run glab with a stale filter from the other view.
  if (!gitlabFilterIsValid) {
    setGitlabFilter('opened')
  }
  const displayedGitLabItems = useMemo(() => {
    if (gitlabView === 'issues') {
      return gitlabItems.filter((item) => item.type === 'issue')
    }
    if (gitlabView === 'mrs') {
      return gitlabItems.filter((item) => item.type === 'mr')
    }
    return gitlabItems
  }, [gitlabItems, gitlabView])
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: every added field is assigned below before the model is returned.
  const nextModel = model as typeof model & {
    taskSourceManuallyChangedRef: typeof taskSourceManuallyChangedRef
    lastPageTaskSourceRef: typeof lastPageTaskSourceRef
    taskResumeAppliedRef: typeof taskResumeAppliedRef
    githubSearchPersistReadyRef: typeof githubSearchPersistReadyRef
    linearSearchPersistReadyRef: typeof linearSearchPersistReadyRef
    linearViewPersistReadyRef: typeof linearViewPersistReadyRef
    jiraSearchPersistReadyRef: typeof jiraSearchPersistReadyRef
    taskResumeApplied: typeof taskResumeApplied
    setTaskResumeApplied: typeof setTaskResumeApplied
    projectModeVisible: typeof projectModeVisible
    githubMode: typeof githubMode
    setGithubMode: typeof setGithubMode
    gitlabFilter: typeof gitlabFilter
    setGitlabFilter: typeof setGitlabFilter
    gitlabMRInvolvement: typeof gitlabMRInvolvement
    setGitlabMRInvolvement: typeof setGitlabMRInvolvement
    gitlabItems: typeof gitlabItems
    setGitlabItems: typeof setGitlabItems
    gitlabListQueryKey: typeof gitlabListQueryKey
    setGitlabListQueryKey: typeof setGitlabListQueryKey
    gitlabLoading: typeof gitlabLoading
    setGitlabLoading: typeof setGitlabLoading
    gitlabError: typeof gitlabError
    setGitlabError: typeof setGitlabError
    gitlabRefreshNonce: typeof gitlabRefreshNonce
    setGitlabRefreshNonce: typeof setGitlabRefreshNonce
    gitlabDialogItem: typeof gitlabDialogItem
    setGitlabDialogItem: typeof setGitlabDialogItem
    gitlabView: typeof gitlabView
    setGitlabView: typeof setGitlabView
    gitlabTodos: typeof gitlabTodos
    setGitlabTodos: typeof setGitlabTodos
    gitlabTodosLoading: typeof gitlabTodosLoading
    setGitlabTodosLoading: typeof setGitlabTodosLoading
    cnbFilter: typeof cnbFilter
    setCnbFilter: typeof setCnbFilter
    cnbScope: typeof cnbScope
    setCnbScope: typeof setCnbScope
    cnbItems: typeof cnbItems
    setCnbItems: typeof setCnbItems
    cnbLoading: typeof cnbLoading
    setCnbLoading: typeof setCnbLoading
    cnbError: typeof cnbError
    setCnbError: typeof setCnbError
    cnbRefreshNonce: typeof cnbRefreshNonce
    setCnbRefreshNonce: typeof setCnbRefreshNonce
    cnbNewIssueOpen: typeof cnbNewIssueOpen
    setCnbNewIssueOpen: typeof setCnbNewIssueOpen
    cnbNewIssueSubmitting: typeof cnbNewIssueSubmitting
    setCnbNewIssueSubmitting: typeof setCnbNewIssueSubmitting
    cnbNewIssue: typeof cnbNewIssue
    setCnbNewIssue: typeof setCnbNewIssue
    cnbEligibleRepos: typeof cnbEligibleRepos
    cnbNewIssueTargetRepo: typeof cnbNewIssueTargetRepo
    cnbEmptyState: typeof cnbEmptyState
    gitlabEmptyState: typeof gitlabEmptyState
    gitlabFilterIsValid: typeof gitlabFilterIsValid
    activeGitlabFilter: typeof activeGitlabFilter
    displayedGitLabItems: typeof displayedGitLabItems
  }
  nextModel.taskSourceManuallyChangedRef = taskSourceManuallyChangedRef
  nextModel.lastPageTaskSourceRef = lastPageTaskSourceRef
  nextModel.taskResumeAppliedRef = taskResumeAppliedRef
  nextModel.githubSearchPersistReadyRef = githubSearchPersistReadyRef
  nextModel.linearSearchPersistReadyRef = linearSearchPersistReadyRef
  nextModel.linearViewPersistReadyRef = linearViewPersistReadyRef
  nextModel.jiraSearchPersistReadyRef = jiraSearchPersistReadyRef
  nextModel.taskResumeApplied = taskResumeApplied
  nextModel.setTaskResumeApplied = setTaskResumeApplied
  nextModel.projectModeVisible = projectModeVisible
  nextModel.githubMode = githubMode
  nextModel.setGithubMode = setGithubMode
  nextModel.gitlabFilter = gitlabFilter
  nextModel.setGitlabFilter = setGitlabFilter
  nextModel.gitlabMRInvolvement = gitlabMRInvolvement
  nextModel.setGitlabMRInvolvement = setGitlabMRInvolvement
  nextModel.gitlabItems = gitlabItems
  nextModel.setGitlabItems = setGitlabItems
  nextModel.gitlabListQueryKey = gitlabListQueryKey
  nextModel.setGitlabListQueryKey = setGitlabListQueryKey
  nextModel.gitlabLoading = gitlabLoading
  nextModel.setGitlabLoading = setGitlabLoading
  nextModel.gitlabError = gitlabError
  nextModel.setGitlabError = setGitlabError
  nextModel.gitlabRefreshNonce = gitlabRefreshNonce
  nextModel.setGitlabRefreshNonce = setGitlabRefreshNonce
  nextModel.gitlabDialogItem = gitlabDialogItem
  nextModel.setGitlabDialogItem = setGitlabDialogItem
  nextModel.gitlabView = gitlabView
  nextModel.setGitlabView = setGitlabView
  nextModel.gitlabTodos = gitlabTodos
  nextModel.setGitlabTodos = setGitlabTodos
  nextModel.gitlabTodosLoading = gitlabTodosLoading
  nextModel.setGitlabTodosLoading = setGitlabTodosLoading
  nextModel.cnbFilter = cnbFilter
  nextModel.setCnbFilter = setCnbFilter
  nextModel.cnbScope = cnbScope
  nextModel.setCnbScope = setCnbScope
  nextModel.cnbItems = cnbItems
  nextModel.setCnbItems = setCnbItems
  nextModel.cnbLoading = cnbLoading
  nextModel.setCnbLoading = setCnbLoading
  nextModel.cnbError = cnbError
  nextModel.setCnbError = setCnbError
  nextModel.cnbRefreshNonce = cnbRefreshNonce
  nextModel.setCnbRefreshNonce = setCnbRefreshNonce
  nextModel.cnbNewIssueOpen = cnbNewIssueOpen
  nextModel.setCnbNewIssueOpen = setCnbNewIssueOpen
  nextModel.cnbNewIssueSubmitting = cnbNewIssueSubmitting
  nextModel.setCnbNewIssueSubmitting = setCnbNewIssueSubmitting
  nextModel.cnbNewIssue = cnbNewIssue
  nextModel.setCnbNewIssue = setCnbNewIssue
  nextModel.cnbEligibleRepos = cnbEligibleRepos
  nextModel.cnbNewIssueTargetRepo = cnbNewIssueTargetRepo
  nextModel.cnbEmptyState = cnbEmptyState
  nextModel.gitlabEmptyState = gitlabEmptyState
  nextModel.gitlabFilterIsValid = gitlabFilterIsValid
  nextModel.activeGitlabFilter = activeGitlabFilter
  nextModel.displayedGitLabItems = displayedGitLabItems
  return nextModel
}
export type TaskPageProviderStateModel = ReturnType<typeof useTaskPageProviderState>
