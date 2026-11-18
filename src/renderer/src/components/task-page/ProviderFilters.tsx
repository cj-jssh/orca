import type { TaskPageCnbActionsModel } from './cnb/use-task-page-cnb-actions'
import { TaskPageGitHubFilters } from './github/listing/Filters'
import { TaskPageLinearFilters } from './linear/Filters'
import { TaskPageJiraFilters } from './jira/Filters'
import { TaskPageGitLabFilters } from './gitlab/Filters'
import { TaskPageCnbFilters } from './cnb/Filters'
export function TaskPageProviderFilters({
  model
}: {
  model: TaskPageCnbActionsModel
}): React.JSX.Element | null {
  const { linearConnected, jiraConnected, taskSource, githubMode } = model
  return taskSource === 'github' && githubMode === 'items' ? (
    // Join the filter chrome to the table shell below.
    <TaskPageGitHubFilters model={model} />
  ) : taskSource === 'linear' && linearConnected ? (
    <TaskPageLinearFilters model={model} />
  ) : taskSource === 'jira' && jiraConnected ? (
    <TaskPageJiraFilters model={model} />
  ) : taskSource === 'gitlab' ? (
    <TaskPageGitLabFilters model={model} />
  ) : taskSource === 'cnb' ? (
    <TaskPageCnbFilters model={model} />
  ) : null
}
