import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  /** Buttons or filters shown on the right of the header. */
  actions?: ReactNode
}

export function Card({ title, actions, className, children, ...props }: CardProps) {
  return (
    <section
      className={cn('rounded-xl border border-border bg-surface shadow-sm', className)}
      {...props}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}
