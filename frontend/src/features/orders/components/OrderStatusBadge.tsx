import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui'
import type { OrderStatus } from '@/features/pos/types'

const tones = {
  Pending: 'warning',
  Processing: 'warning',
  Completed: 'success',
  Cancelled: 'danger',
  Refunded: 'neutral',
} as const

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return <Badge tone={tones[status]}>{t(`orders.statuses.${status}`)}</Badge>
}
