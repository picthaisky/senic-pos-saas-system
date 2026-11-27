import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <LoaderCircle
      role="status"
      aria-label={t('common.loading')}
      className={cn('size-5 animate-spin', className)}
    />
  )
}

/** Centred spinner for a page or panel that is still loading. */
export function PageSpinner() {
  return (
    <div className="flex min-h-64 flex-1 items-center justify-center">
      <Spinner className="size-8 text-primary" />
    </div>
  )
}
