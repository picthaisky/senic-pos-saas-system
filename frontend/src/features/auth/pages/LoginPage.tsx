import { Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router'
import { HOME_PATH } from '@/app/navigation'
import { Button, Input } from '@/components/ui'
import { getStatus } from '@/lib/api'
import { env } from '@/lib/env'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '../api'

const TENANT_KEY = 'senic.tenantId'
const MIN_PASSWORD_LENGTH = 6

/** Only same-origin paths are accepted, so a crafted link cannot redirect off-site after login. */
function safeReturnUrl(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : HOME_PATH
}

export function LoginPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const status = useAuthStore((state) => state.status)
  const setSession = useAuthStore((state) => state.setSession)

  // The tenant rarely changes on a given device, so remember it between visits.
  const [tenantId, setTenantId] = useState(() => localStorage.getItem(TENANT_KEY) ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authenticated') {
    return <Navigate to={safeReturnUrl(searchParams.get('returnUrl'))} replace />
  }

  const passwordError =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? t('auth.passwordTooShort')
      : undefined

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (passwordError) return
    setSubmitting(true)
    setError(null)
    try {
      const session = await authApi.login({
        tenantId: tenantId.trim(),
        email: email.trim(),
        password,
      })
      localStorage.setItem(TENANT_KEY, tenantId.trim())
      setSession(session) // re-renders into the <Navigate> above
    } catch (err) {
      // 400 = the tenant id or email is malformed; to the user that is the same mistake as a 401.
      const status = getStatus(err)
      setError(status === 401 || status === 400 ? t('auth.invalidCredentials') : t('common.error'))
      setSubmitting(false)
    }
  }

  const PasswordIcon = showPassword ? EyeOff : Eye

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo.svg" alt="" className="size-14" />
          <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
          <p className="text-sm text-muted">{t('app.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label={t('auth.title')}>
          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Input
            label={t('auth.tenantId')}
            name="tenantId"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            autoComplete="organization"
            required
          />
          <Input
            label={t('auth.email')}
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
          <Input
            label={t('auth.password')}
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            error={passwordError}
            required
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                aria-pressed={showPassword}
                className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted hover:text-fg"
              >
                <PasswordIcon className="size-5" />
              </button>
            }
          />
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            {t('auth.submit')}
          </Button>
        </form>

        {env.useMocks && (
          <p className="mt-6 rounded-lg bg-warning/10 px-3 py-2 text-xs text-muted">
            {t('auth.mockHint')}
          </p>
        )}
      </div>
    </main>
  )
}
