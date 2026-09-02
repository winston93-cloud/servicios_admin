'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { ArrowLeft, CircleDollarSign } from 'lucide-react'
import Link from 'next/link'

/**
 * Placeholder: Mario definirá el flujo de Revisión Pagados/No Pagados.
 */
export default function RevisionPagadosPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-4 py-3 backdrop-blur-md sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--primary)]"
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al dashboard
          </Link>
          <ThemeToggle />
        </header>

        <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10 sm:px-6">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300"
              aria-hidden
            >
              <CircleDollarSign size={24} strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Cobranza
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Revisión Pagados/No Pagados
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Tarjeta lista en el dashboard. El contenido del módulo se arma
                cuando definas el flujo (filtros, conceptos, ciclo y export).
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text)]">En preparación</p>
            <p className="mt-1">
              Mientras tanto, la entrada ya aparece en el dashboard de
              servicios_admin para el equipo.
            </p>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
