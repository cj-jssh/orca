import type { TaskPageCnbActionsModel } from './use-task-page-cnb-actions'
import { cn } from '@/lib/class-names'
import TaskProjectSourceCombobox from '@/components/task-page/source-selection/task-project-source-combobox'
import { normalizeTaskRepoSelection } from '@/components/task-page/task-page-default-repo-selection'
import { toast } from 'sonner'
import { useTranslate } from '@/i18n/use-translate'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { LoaderCircle, Plus, RefreshCw } from 'lucide-react'
import {
  getCnbIssueScopeFilters,
  getCnbIssueStateFilters
} from '@/components/task-page/task-page-localized-options'

function FilterChip({
  label,
  active,
  onSelect
}: {
  label: string
  active: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        'rounded-md border px-2 py-1 text-xs transition',
        active
          ? 'border-border/50 bg-foreground/90 text-background backdrop-blur-md'
          : 'border-border/50 bg-transparent text-foreground hover:bg-muted/50'
      )}
    >
      {label}
    </button>
  )
}

export function TaskPageCnbFilters({
  model
}: {
  model: TaskPageCnbActionsModel
}): React.JSX.Element | null {
  const t = useTranslate()
  const {
    updateSettings,
    eligibleRepos,
    repoSelection,
    setRepoSelection,
    taskPickerGroups,
    taskPickerRepos,
    getTaskPickerRepoHostLabel,
    cnbFilter,
    setCnbFilter,
    cnbScope,
    setCnbScope,
    cnbLoading,
    setCnbRefreshNonce,
    cnbEligibleRepos,
    setCnbNewIssueOpen
  } = model
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs">
          {getCnbIssueScopeFilters().map(({ id, label }) => (
            <FilterChip
              key={id}
              label={label}
              active={cnbScope === id}
              onSelect={() => setCnbScope(id)}
            />
          ))}
        </div>
        {cnbScope === 'repo' ? (
          <div className="min-w-0 w-full sm:w-[200px]">
            <TaskProjectSourceCombobox
              groups={taskPickerGroups}
              selected={repoSelection}
              getRepoHostLabel={getTaskPickerRepoHostLabel}
              onChange={(next) => {
                const normalized = normalizeTaskRepoSelection(eligibleRepos, next)
                setRepoSelection(normalized)
                void updateSettings({
                  defaultRepoSelection: [...normalized]
                }).catch(() => {
                  toast.error(
                    t('auto.components.TaskPage.dfd72673e7', 'Failed to save project selection.')
                  )
                })
              }}
              onSelectAll={() => {
                const allIds = new Set(taskPickerRepos.map((repo) => repo.id))
                setRepoSelection(allIds)
                void updateSettings({
                  defaultRepoSelection: null
                }).catch(() => {
                  toast.error(
                    t('auto.components.TaskPage.dfd72673e7', 'Failed to save project selection.')
                  )
                })
              }}
              triggerClassName="h-8 w-full rounded-md border border-border/50 bg-muted/50 px-2 text-xs font-medium shadow-sm transition hover:bg-muted/50 focus:ring-2 focus:ring-ring/20 focus:outline-none"
            />
          </div>
        ) : null}
      </div>
      <div
        className="min-w-0 rounded-md rounded-b-none border border-border/50 bg-muted/50 px-3 pt-2 pb-0 shadow-sm"
        data-contextual-tour-target="tasks-search-presets"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {getCnbIssueStateFilters().map(({ id, label }) => (
                <FilterChip
                  key={id}
                  label={label}
                  active={cnbFilter === id}
                  onSelect={() => {
                    setCnbFilter(id)
                    setCnbRefreshNonce((nonce) => nonce + 1)
                  }}
                />
              ))}
            </div>
          </div>
          <div
            className="flex shrink-0 items-center gap-2"
            data-contextual-tour-target="tasks-actions"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={cnbEligibleRepos.length === 0}
              onClick={() => setCnbNewIssueOpen(true)}
            >
              <Plus className="size-3.5" />
              {t('auto.components.TaskPage.cnbNewIssue', 'New issue')}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCnbRefreshNonce((nonce) => nonce + 1)}
                  disabled={cnbLoading}
                  aria-label={t('auto.components.TaskPage.cnbRefreshIssues', 'Refresh CNB issues')}
                >
                  {cnbLoading ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {t('auto.components.TaskPage.cnbRefreshIssues', 'Refresh CNB issues')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </>
  )
}
