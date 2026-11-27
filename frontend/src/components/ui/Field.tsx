import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useId } from 'react'
import { cn } from '@/lib/cn'

const controlClass =
  'h-10 w-full rounded-lg border bg-surface px-3 text-fg placeholder:text-muted ' +
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

interface FieldProps {
  label: string
  /** Validation message; also marks the control as invalid. */
  error?: string
  hint?: string
}

interface FieldShellProps extends FieldProps {
  id: string
  children: ReactNode
}

function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className="text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {
  /** Element rendered inside the right edge of the input, e.g. a show-password button. */
  trailing?: ReactNode
}

export function Input({ label, error, hint, trailing, className, id, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint}>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${inputId}-message` : undefined}
          className={cn(
            controlClass,
            error ? 'border-danger' : 'border-border',
            trailing ? 'pr-11' : null,
            className,
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
    </FieldShell>
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}

export function Select({ label, error, hint, className, id, children, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <FieldShell id={selectId} label={label} error={error} hint={hint}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${selectId}-message` : undefined}
        className={cn(controlClass, error ? 'border-danger' : 'border-border', className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}
