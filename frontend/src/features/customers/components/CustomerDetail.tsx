import { Gift, Plus, Star } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Input, Modal, Spinner } from '@/components/ui'
import { errorMessage, getStatus } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDateTime, formatNumber } from '@/lib/format'
import { toast } from '@/stores/toast'
import { useChangePoints, useLoyaltyHistory } from '../api'
import type { Customer } from '../types'

type PointsAction = 'earn' | 'redeem'

export function CustomerDetail({ customer }: { customer: Customer }) {
  const { t } = useTranslation()
  const history = useLoyaltyHistory(customer.id)
  const [action, setAction] = useState<PointsAction | null>(null)

  return (
    <Card title={customer.fullName}>
      <div className="flex flex-col gap-4">
        {(customer.email || customer.phone || customer.address) && (
          <div className="text-sm text-muted">
            {customer.email && <p>{customer.email}</p>}
            {customer.phone && <p>{customer.phone}</p>}
            {customer.address && <p>{customer.address}</p>}
          </div>
        )}

        <div className="rounded-lg bg-primary/10 p-4 text-center">
          <Star className="mx-auto size-8 text-primary" aria-hidden="true" />
          <p className="mt-1 text-sm text-muted">{t('customers.points')}</p>
          <p className="text-4xl font-semibold tabular-nums">
            {formatNumber(customer.loyaltyPoints)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setAction('earn')}>
            <Plus className="size-5" />
            {t('customers.earn')}
          </Button>
          <Button
            variant="secondary"
            disabled={customer.loyaltyPoints === 0}
            onClick={() => setAction('redeem')}
          >
            <Gift className="size-5" />
            {t('customers.redeem')}
          </Button>
        </div>

        <section aria-label={t('customers.history')}>
          <h3 className="mb-2 font-semibold">{t('customers.history')}</h3>
          {history.isPending ? (
            <Spinner className="mx-auto my-4" />
          ) : !history.data?.length ? (
            <p className="py-4 text-center text-sm text-muted">{t('customers.noHistory')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.data.map((entry) => (
                <li key={entry.id} className="py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        entry.type === 'Earned' ? 'text-success' : 'text-danger',
                      )}
                    >
                      {entry.type === 'Earned' ? '+' : '−'}
                      {formatNumber(entry.points)}
                    </span>
                    <span className="text-xs text-muted">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted">
                    {/* A line written by a sale or a cancellation carries the bill's number. */}
                    {entry.orderId
                      ? t(
                          entry.type === 'Reversed' ? 'customers.fromCancel' : 'customers.fromSale',
                          {
                            number: entry.description,
                          },
                        )
                      : entry.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {action && (
        <PointsModal customer={customer} action={action} onClose={() => setAction(null)} />
      )}
    </Card>
  )
}

interface PointsModalProps {
  customer: Customer
  action: PointsAction
  onClose: () => void
}

function PointsModal({ customer, action, onClose }: PointsModalProps) {
  const { t } = useTranslation()
  const change = useChangePoints(customer.id)
  const [points, setPoints] = useState('')
  const [description, setDescription] = useState('')

  const amount = Number(points)
  const overBalance = action === 'redeem' && amount > customer.loyaltyPoints
  const valid = Number.isInteger(amount) && amount > 0 && !overBalance

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    const fallback =
      action === 'earn' ? t('customers.defaultEarnNote') : t('customers.defaultRedeemNote')
    change.mutate(
      { kind: action, request: { points: amount, description: description.trim() || fallback } },
      {
        onSuccess: () => {
          toast.success(t(action === 'earn' ? 'customers.earned' : 'customers.redeemed'))
          onClose()
        },
        onError: (error) =>
          toast.error(
            getStatus(error) === 409
              ? t('customers.notEnoughPoints')
              : errorMessage(error, t('common.error')),
          ),
      },
    )
  }

  const title = action === 'earn' ? t('customers.earn') : t('customers.redeem')

  return (
    <Modal open onClose={onClose} title={`${title} – ${customer.fullName}`}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('customers.points')}
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          autoFocus
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          error={overBalance ? t('customers.notEnoughPoints') : undefined}
          hint={
            action === 'redeem'
              ? t('customers.balance', { points: formatNumber(customer.loyaltyPoints) })
              : undefined
          }
        />
        <Input
          label={t('customers.note')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!valid} loading={change.isPending}>
            {title}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
