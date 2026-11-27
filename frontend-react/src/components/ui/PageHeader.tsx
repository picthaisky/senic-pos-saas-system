import type { ReactNode } from 'react'

/** Page title with optional actions (buttons, filters) on the right. */
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Message shown in place of content when a query failed, with a retry button slot. */
export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-muted">
      <p>{message}</p>
      {action}
    </div>
  )
}
