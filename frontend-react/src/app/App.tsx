import { env } from '@/lib/env'

// Placeholder shell for Phase 1. Router, providers and the real layout arrive in Phase 2.
export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <img src="/logo.svg" alt="" className="size-12" />
        <h1 className="mt-4 text-2xl font-semibold">Senic POS</h1>
        <p className="mt-2 text-muted">React + TypeScript + Tailwind CSS + PWA</p>
        <p className="mt-6 text-sm text-muted">
          API: <code className="text-fg">{env.apiUrl}</code>
        </p>
      </section>
    </main>
  )
}
