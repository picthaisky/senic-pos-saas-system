import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { HOME_PATH } from '@/app/navigation'

export function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <ShieldAlert className="size-12 text-warning" />
      <h1 className="text-xl font-semibold">{t('forbidden.title')}</h1>
      <p className="text-muted">{t('forbidden.message')}</p>
      <Link to={HOME_PATH} className="font-medium text-primary hover:underline">
        {t('forbidden.back')}
      </Link>
    </div>
  )
}
