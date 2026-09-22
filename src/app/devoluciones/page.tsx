'use client'

import Link from 'next/link'
import { ArrowLeft, CreditCard, Undo2 } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import './devoluciones.css'

export default function DevolucionesPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <DevolucionesShell />
    </ProtectedRoute>
  )
}

function DevolucionesShell() {
  return (
    <div className="devoluciones-page pos-totality-theme admin-app-shell">
      <div className="devoluciones-bg" aria-hidden />
      <header className="devoluciones-top">
        <Link href="/dashboard" className="devoluciones-back">
          <ArrowLeft size={18} aria-hidden />
          Dashboard
        </Link>
        <ThemeToggle />
      </header>

      <main className="devoluciones-main">
        <p className="devoluciones-kicker">Pagos · Empleados Winston</p>
        <h1 className="devoluciones-title">
          <Undo2 size={36} strokeWidth={1.6} aria-hidden />
          Devoluciones
        </h1>
        <p className="devoluciones-lead">
          Módulo para reembolsar cuando el papá se arrepiente de haber pagado con tarjeta una
          inscripción, colegiatura u otro concepto.
        </p>

        <div className="devoluciones-panel" role="status">
          <span className="devoluciones-panel-icon" aria-hidden>
            <CreditCard size={28} strokeWidth={1.5} />
          </span>
          <div>
            <h2>Listo para armar el flujo</h2>
            <p>
              La tarjeta ya está en el dashboard. En cuanto definas el proceso (búsqueda del pago,
              autorización, cargo inverso, etc.), lo implementamos aquí.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
