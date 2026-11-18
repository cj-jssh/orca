import { useEffect, useState } from 'react'
import { GitPullRequestArrow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  IntegrationCardDetails,
  IntegrationCardShell
} from '../presentation/integration-card-shell'
import { useTranslate } from '@/i18n/use-translate'
import { isIntegrationCredentialDecryptionError } from '../../../../../shared/secure-storage/integration-credential-errors'
import { useAppStore } from '@/store'
import {
  normalizeVisibleTaskProviders,
  resolveVisibleTaskProvider
} from '../../../../../shared/work-items/task-providers'
import type { CnbConnectionStatus } from '../../../../../shared/cnb/cnb-credentials'

export function CnbIntegrationCard(): React.JSX.Element {
  const t = useTranslate()
  const [status, setStatus] = useState<CnbConnectionStatus | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.cnb
      .status()
      .then((next) => {
        if (!cancelled) {
          setStatus(next)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            isIntegrationCredentialDecryptionError(cause)
              ? t(
                  'auto.components.settings.integrations.cnb.decryptFailed',
                  'Could not decrypt the saved CNB token. Reconnect CNB.'
                )
              : t(
                  'auto.components.settings.integrations.cnb.statusFailed',
                  'Could not read the CNB connection status.'
                )
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [t])

  // A fresh connection is the one act that opts CNB into Tasks; hiding it later still sticks.
  async function revealCnbTaskSource(): Promise<void> {
    const state = useAppStore.getState()
    const visible = normalizeVisibleTaskProviders(state.settings?.visibleTaskProviders)
    if (visible.includes('cnb')) {
      return
    }
    const nextVisible = [...visible, 'cnb' as const]
    await state.updateSettings({
      visibleTaskProviders: nextVisible,
      defaultTaskSource: resolveVisibleTaskProvider(state.settings?.defaultTaskSource, nextVisible)
    })
  }

  const configured = status?.configured === true
  const stored = status?.source === 'stored'

  async function connect(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.cnb.connect({ token })
      if (result.ok) {
        setToken('')
        setStatus(await window.api.cnb.status())
        // Publishing the new credential shows the CNB task source without a relaunch.
        void useAppStore.getState().refreshPreflightStatus({ force: true })
        await revealCnbTaskSource()
      } else {
        setError(result.error)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function disconnect(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await window.api.cnb.disconnect()
      setStatus(await window.api.cnb.status())
      void useAppStore.getState().refreshPreflightStatus({ force: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="CNB"
      description={
        configured
          ? status?.account
            ? t(
                'auto.components.settings.integrations.cnb.connectedAccount',
                '{{value0}} · Pull requests, commit statuses, and issues',
                { value0: status.account }
              )
            : t(
                'auto.components.settings.integrations.cnb.connected',
                'Pull requests, commit statuses, and issues for cnb.cool repositories'
              )
          : t(
              'auto.components.settings.integrations.cnb.disconnected',
              'Pull requests, commit statuses, and issues via the CNB OpenAPI.'
            )
      }
      checking={status === null && error === null}
      statusTone={configured ? 'connected' : 'attention'}
      statusLabel={
        configured
          ? status?.source === 'environment'
            ? t('auto.components.settings.integrations.cnb.envStatus', 'Connected via env')
            : t('auto.components.settings.integrations.cnb.storedStatus', 'Connected')
          : t('auto.components.settings.integrations.cnb.notConfiguredStatus', 'Not connected')
      }
      actions={
        stored ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void disconnect()}>
            {t('auto.components.settings.integrations.cnb.disconnect', 'Disconnect')}
          </Button>
        ) : undefined
      }
    >
      {!configured || error ? (
        <IntegrationCardDetails>
          <p className="text-xs text-muted-foreground">
            {t(
              'auto.components.settings.integrations.cnb.instructions',
              'Create an access token in cnb.cool (个人设置 → 访问令牌), then paste it here. Set'
            )}{' '}
            <span className="font-mono text-[11px]">
              {t('auto.components.settings.integrations.cnb.tokenEnvName', 'ORCA_CNB_TOKEN')}
            </span>{' '}
            {t(
              'auto.components.settings.integrations.cnb.instructionsEnv',
              'instead to share one token with every Orca window.'
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={t(
                'auto.components.settings.integrations.cnb.tokenPlaceholder',
                'CNB access token'
              )}
              className="h-8 max-w-xs"
              aria-label={t(
                'auto.components.settings.integrations.cnb.tokenLabel',
                'CNB access token'
              )}
            />
            <Button
              size="sm"
              disabled={busy || token.trim().length === 0}
              onClick={() => void connect()}
            >
              {t('auto.components.settings.integrations.cnb.connect', 'Connect')}
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </IntegrationCardDetails>
      ) : null}
    </IntegrationCardShell>
  )
}
