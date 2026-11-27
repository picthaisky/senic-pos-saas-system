import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { type ToastKind, useToastStore } from '@/stores/toast'

const icons = { success: CircleCheck, error: CircleAlert, info: Info }

const iconClass: Record<ToastKind, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-primary',
}

/** Renders the toasts raised with `toast.success/error/info`. Mounted once in Providers. */
export function Toaster() {
  const { t } = useTranslation()
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((item) => {
        const Icon = icons[item.kind]
        return (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg"
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', iconClass[item.kind])} />
            <p className="flex-1 text-sm">{item.message}</p>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => dismiss(item.id)}
              className="cursor-pointer rounded text-muted hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
