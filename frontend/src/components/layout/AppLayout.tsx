import { useState } from 'react'
import { Outlet } from 'react-router'
import { useRealtime } from '@/app/realtime'
import { useOfflineSync } from '@/features/pos/offline/useOfflineSync'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  // Sends sales that were queued while offline, for as long as someone is signed in.
  useOfflineSync()
  // Live updates: new sales refresh the figures, stock alerts appear as toasts.
  useRealtime()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
