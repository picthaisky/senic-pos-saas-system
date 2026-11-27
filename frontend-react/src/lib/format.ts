import i18n from '@/i18n'

// Formatters follow the UI language. Components that call them already re-render on a
// language change because they use useTranslation().
const locale = () => (i18n.language === 'en' ? 'en-US' : 'th-TH')

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'THB' }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale()).format(value)
}

/** Short money for chart axes, e.g. ฿12K. */
export function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'THB',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** Day and month only, for chart ticks. Accepts a `YYYY-MM-DD` date. */
export function formatDay(isoDate: string): string {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(
    new Date(`${isoDate}T00:00:00`),
  )
}
