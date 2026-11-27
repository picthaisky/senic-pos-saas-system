import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NavItem } from './navigation'

/** Stands in for a screen that has not been migrated yet (Phase 3 replaces each one). */
export function PlaceholderPage({ titleKey }: { titleKey: NavItem['labelKey'] }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <Construction className="size-12 text-muted" />
      <h1 className="text-xl font-semibold">{t(titleKey)}</h1>
      <p className="text-muted">{t('common.comingSoon')}</p>
    </div>
  )
}
