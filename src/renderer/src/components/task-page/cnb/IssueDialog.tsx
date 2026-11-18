import type { TaskPageCnbActionsModel } from './use-task-page-cnb-actions'
import { useTranslate } from '@/i18n/use-translate'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LoaderCircle } from 'lucide-react'
import { isScreenSubmitShortcut } from '@/lib/keyboard/screen-submit-shortcut'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'

export function TaskPageCnbIssueDialog({
  model
}: {
  model: TaskPageCnbActionsModel
}): React.JSX.Element | null {
  const t = useTranslate()
  const {
    cnbNewIssueOpen,
    setCnbNewIssueOpen,
    cnbNewIssue,
    setCnbNewIssue,
    cnbNewIssueSubmitting,
    cnbNewIssueTargetRepo,
    cnbEligibleRepos,
    handleCreateCnbIssue
  } = model
  return (
    <Dialog
      open={cnbNewIssueOpen}
      onOpenChange={(open) => {
        if (!cnbNewIssueSubmitting) {
          setCnbNewIssueOpen(open)
        }
      }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        onKeyDown={(event) => {
          if (isScreenSubmitShortcut(event)) {
            event.preventDefault()
            void handleCreateCnbIssue()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t('auto.components.TaskPage.cnbNewIssueTitle', 'New CNB issue')}
          </DialogTitle>
          <DialogDescription>
            {cnbNewIssueTargetRepo
              ? t('auto.components.TaskPage.filingInTarget', 'Filing in {{target}}', {
                  target: cnbNewIssueTargetRepo.displayName
                })
              : t(
                  'auto.components.TaskPage.cnbNoRepository',
                  'Select a cnb.cool project to file this issue.'
                )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {cnbEligibleRepos.length > 1 ? (
            <Select
              value={cnbNewIssueTargetRepo?.id ?? ''}
              onValueChange={(repoId) => setCnbNewIssue((current) => ({ ...current, repoId }))}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cnbEligibleRepos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Input
            autoFocus
            value={cnbNewIssue.title}
            onChange={(event) =>
              setCnbNewIssue((current) => ({ ...current, title: event.target.value }))
            }
            placeholder={t('auto.components.TaskPage.cnbIssueTitlePlaceholder', 'Issue title')}
            aria-label={t('auto.components.TaskPage.cnbIssueTitlePlaceholder', 'Issue title')}
          />
          <Textarea
            value={cnbNewIssue.body}
            onChange={(event) =>
              setCnbNewIssue((current) => ({ ...current, body: event.target.value }))
            }
            placeholder={t(
              'auto.components.TaskPage.cnbIssueBodyPlaceholder',
              'Describe the issue (Markdown)'
            )}
            aria-label={t('auto.components.TaskPage.cnbIssueBodyLabel', 'Describe the issue')}
            className="min-h-40"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={cnbNewIssueSubmitting}
            onClick={() => setCnbNewIssueOpen(false)}
          >
            {t('auto.components.TaskPage.cnbCancel', 'Cancel')}
          </Button>
          <Button
            size="sm"
            disabled={
              cnbNewIssueSubmitting ||
              cnbNewIssueTargetRepo === null ||
              cnbNewIssue.title.trim().length === 0
            }
            onClick={() => void handleCreateCnbIssue()}
          >
            {cnbNewIssueSubmitting ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            {t('auto.components.TaskPage.cnbCreateIssue', 'Create issue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
