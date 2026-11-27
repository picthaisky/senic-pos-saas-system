import { X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Action buttons, right-aligned under the content. */
  footer?: ReactNode
}

/** Built on the native <dialog>, which provides the focus trap, Esc to close and the backdrop. */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click that lands on the dialog element itself is a click on the backdrop.
      onClick={(event) => event.target === ref.current && onClose()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-fg shadow-xl backdrop:bg-black/50"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border py-3 pr-3 pl-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <Button variant="ghost" size="icon" aria-label={t('common.close')} onClick={onClose}>
          <X className="size-5" />
        </Button>
      </header>
      <div className="p-5">{children}</div>
      {footer && (
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {footer}
        </footer>
      )}
    </dialog>
  )
}
