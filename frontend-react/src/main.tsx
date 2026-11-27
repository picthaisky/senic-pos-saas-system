import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { api } from '@/lib/api'
import { env } from '@/lib/env'
import '@/i18n'
import '@/styles/index.css'

async function start() {
  // Must be installed before <App> mounts, because App refreshes the session on mount.
  if (env.useMocks) {
    const { installMockApi } = await import('@/mocks/mock-api')
    installMockApi(api)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
