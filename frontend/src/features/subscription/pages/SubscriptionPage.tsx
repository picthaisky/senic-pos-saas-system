import { CalendarClock, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, ErrorState, PageHeader, PageSpinner } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/format'
import { type SubscriptionStatus, useSubscription } from '../api'

const statusTone = {
  Active: 'success',
  Inactive: 'neutral',
  Suspended: 'warning',
  Cancelled: 'danger',
  Expired: 'danger',
} as const satisfies Record<SubscriptionStatus, string>

/** From this many days before the end date, the page says the end is near. */
const EXPIRING_SOON_DAYS = 14

/** Read-only: what the shop is subscribed to and until when. */
export function SubscriptionPage() {
  const { t } = useTranslation()
  const subscription = useSubscription()

  return (
    <>
      <PageHeader title={t('nav.subscription')} />

      {subscription.isPending ? (
        <PageSpinner />
      ) : subscription.isError ? (
        <Card>
          <ErrorState
            message={t('common.loadFailed')}
            action={
              <Button variant="secondary" onClick={() => void subscription.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        </Card>
      ) : subscription.data === null ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted">
            <CalendarClock className="size-12" aria-hidden="true" />
            <p>{t('subscription.none')}</p>
          </div>
        </Card>
      ) : (
        <SubscriptionCard subscription={subscription.data} />
      )}
    </>
  )
}

function SubscriptionCard({
  subscription,
}: {
  subscription: NonNullable<ReturnType<typeof useSubscription>['data']>
}) {
  const { t } = useTranslation()
  const days = subscription.daysUntilExpiry
  const ended = days < 0
  const endingSoon = !ended && days <= EXPIRING_SOON_DAYS

  return (
    <Card title={subscription.tenantName}>
      {(ended || endingSoon) && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm"
        >
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
          {ended ? t('subscription.ended') : t('subscription.endingSoon', { count: days })}
        </p>
      )}

      <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-3">
        <dt className="text-muted">{t('subscription.plan')}</dt>
        <dd className="font-semibold">{t(`subscription.plans.${subscription.plan}`)}</dd>

        <dt className="text-muted">{t('subscription.status')}</dt>
        <dd>
          <Badge tone={statusTone[subscription.status]}>
            {t(`subscription.statuses.${subscription.status}`)}
          </Badge>
        </dd>

        <dt className="text-muted">{t('subscription.period')}</dt>
        <dd>
          {formatDate(subscription.startDate)} – {formatDate(subscription.endDate)}
        </dd>

        <dt className="text-muted">{t('subscription.daysLeft')}</dt>
        <dd className="tabular-nums">{ended ? '–' : t('subscription.days', { count: days })}</dd>

        <dt className="text-muted">{t('subscription.monthlyFee')}</dt>
        <dd className="tabular-nums">{formatCurrency(subscription.monthlyFee)}</dd>

        <dt className="text-muted">{t('subscription.autoRenew')}</dt>
        <dd>{t(subscription.autoRenew ? 'subscription.on' : 'subscription.off')}</dd>
      </dl>

      <p className="mt-4 text-sm text-muted">{t('subscription.contact')}</p>
    </Card>
  )
}
