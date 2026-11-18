import type { TaskPageCnbActionsModel } from './use-task-page-cnb-actions'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { ArrowRight, ExternalLink, TriangleAlert } from 'lucide-react'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { formatRelativeTime } from '../task-page-source-context'

const CNB_TASK_GRID_CLASS = 'grid-cols-[80px_minmax(0,3fr)_150px_110px_72px]'

export function TaskPageCnbItemList({
  model
}: {
  model: TaskPageCnbActionsModel
}): React.JSX.Element | null {
  const t = useTranslate()
  const { cnbItems, cnbLoading, cnbError, cnbEmptyState, handleUseCnbIssue } = model
  return (
    <div className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-muted/50 shadow-sm">
      <div
        className={`flex-none grid ${CNB_TASK_GRID_CLASS} gap-3 border-b border-border/50 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground`}
      >
        <span>{t('auto.components.TaskPage.eb10c32872', 'ID')}</span>
        <span>{t('auto.components.TaskPage.16cba35bee', 'Title')}</span>
        <span>{t('auto.components.TaskPage.cnbColumnRepository', 'Repository')}</span>
        <span>{t('auto.components.TaskPage.f362667d55', 'Updated')}</span>
        <span />
      </div>
      <div
        className="min-h-0 flex-initial overflow-y-auto scrollbar-sleek"
        style={{
          scrollbarGutter: 'stable'
        }}
      >
        {cnbError ? (
          <div className="flex items-start gap-2 border-b border-border px-4 py-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{cnbError}</span>
          </div>
        ) : null}
        {cnbLoading && cnbItems.length === 0 ? (
          // Fill the viewport with shimmer rows to prevent a loading height jump.
          <div className="divide-y divide-border/50">
            {Array.from({
              length: 10
            }).map((_, index) => (
              <div key={index} className={`grid w-full ${CNB_TASK_GRID_CLASS} gap-3 px-3 py-2`}>
                <div className="h-4 w-12 animate-pulse rounded bg-muted/70" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-muted/70" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted/60" />
                <div />
              </div>
            ))}
          </div>
        ) : null}
        {!cnbLoading && cnbItems.length === 0 && !cnbError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-base font-medium text-foreground">{cnbEmptyState.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{cnbEmptyState.description}</p>
          </div>
        ) : null}
        <div className="divide-y divide-border/50">
          {cnbItems.map((item) => (
            // Why: div role="button" not a <button> — it nests an open-in-browser button, and button-in-button is invalid HTML.
            <div
              role="button"
              tabIndex={0}
              key={`${item.repoSlug ?? ''}:${item.number}`}
              onClick={() => {
                useAppStore.getState().recordFeatureInteraction('cnb-tasks')
                openAppHttpLink(item.url)
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  useAppStore.getState().recordFeatureInteraction('cnb-tasks')
                  openAppHttpLink(item.url)
                }
              }}
              className={`grid w-full cursor-pointer ${CNB_TASK_GRID_CLASS} gap-3 px-3 py-2 text-left hover:bg-muted/50`}
            >
              <span className="font-mono text-xs text-muted-foreground">#{item.number}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-sm">{item.title}</span>
                {item.state === 'closed' ? (
                  <span className="shrink-0 rounded border border-border/60 px-1 text-[10px] text-muted-foreground">
                    {t('auto.components.TaskPage.d09bf34db7', 'Closed')}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                {item.repoSlug ?? '—'}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.updatedAt ? formatRelativeTime(item.updatedAt) : ''}
              </span>
              <div className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      data-contextual-tour-target="tasks-start-workspace"
                      disabled={item.repoId === null}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleUseCnbIssue(item)
                      }}
                      aria-label={t(
                        'auto.components.TaskPage.startWorkspaceFromIssue',
                        'Start workspace from issue {{number}}',
                        { number: item.number }
                      )}
                    >
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {item.repoId === null
                      ? t(
                          'auto.components.TaskPage.cnbStartWorkspaceUnlinked',
                          'Add this repository to Orca to start a workspace'
                        )
                      : t('auto.components.TaskPage.9497f2787c', 'Start workspace')}
                  </TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    openAppHttpLink(item.url, { event })
                  }}
                  aria-label={t('auto.components.TaskPage.cnbOpenInCnb', 'Open in CNB')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
