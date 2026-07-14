'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { ArrowLeft, Coffee, NotebookPen, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import './proximamente.css'

type ModuloProximamente = 'desayunos' | 'boletas' | 'general'

const MODULOS: Record<
  ModuloProximamente,
  {
    titulo: string
    kicker: string
    lead: string
    accent: 'amber' | 'indigo'
    bullets: string[]
  }
> = {
  desayunos: {
    titulo: 'Desayunos, Estancias y Comidas',
    kicker: 'Cafetería escolar',
    lead: 'El menú digital, pedidos y estancias escolares llegan pronto a este mismo portal.',
    accent: 'amber',
    bullets: [
      'Consulta de servicios de alimentación',
      'Pedidos y seguimiento en línea',
      'Todo desde tu cuenta familiar Winston',
    ],
  },
  boletas: {
    titulo: 'Boletas',
    kicker: 'Calificaciones',
    lead: 'La consulta de boletas y calificaciones se integra aquí con la misma experiencia del dashboard.',
    accent: 'indigo',
    bullets: [
      'Boletas por periodo escolar',
      'Vista clara para mamá, papá o tutor',
      'Acceso seguro con tu número de control',
    ],
  },
  general: {
    titulo: 'Módulo en preparación',
    kicker: 'Winston digital',
    lead: 'Estamos terminando los últimos detalles para abrirte una experiencia más cómoda.',
    accent: 'amber',
    bullets: [
      'Diseño unificado con el resto del portal',
      'Acceso familiar con la misma sesión',
      'Pronto disponible en este dashboard',
    ],
  },
}

function ProximamenteContent() {
  const params = useSearchParams()
  const raw = (params.get('m') || params.get('modulo') || '').toLowerCase()
  const key: ModuloProximamente =
    raw === 'desayunos' || raw === 'boletas' ? raw : 'general'
  const mod = MODULOS[key]
  const Icon = key === 'boletas' ? NotebookPen : Coffee

  return (
    <div className="proximamente-page" data-accent={mod.accent}>
      <div className="proximamente-bg" aria-hidden>
        <span className="proximamente-orb proximamente-orb--a" />
        <span className="proximamente-orb proximamente-orb--b" />
        <span className="proximamente-grid" />
      </div>

      <header className="proximamente-top">
        <Link href="/dashboard" className="proximamente-back">
          <ArrowLeft size={16} aria-hidden />
          Volver al inicio
        </Link>
        <ThemeToggle />
      </header>

      <main className="proximamente-main">
        <section className="proximamente-card" aria-labelledby="proximamente-title">
          <div className="proximamente-badge">
            <Sparkles size={14} aria-hidden />
            Próximamente
          </div>

          <div className="proximamente-icon-wrap" aria-hidden>
            <Icon size={34} strokeWidth={1.6} />
            <span className="proximamente-icon-ring" />
          </div>

          <p className="proximamente-kicker">{mod.kicker}</p>
          <h1 id="proximamente-title">{mod.titulo}</h1>
          <p className="proximamente-lead">{mod.lead}</p>

          <ul className="proximamente-list">
            {mod.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="proximamente-ticker" aria-hidden>
            <div className="proximamente-ticker-track">
              <span>Estamos afilando los detalles</span>
              <span>·</span>
              <span>Misma calidad Winston</span>
              <span>·</span>
              <span>Muy pronto en tu dashboard</span>
              <span>·</span>
              <span>Estamos afilando los detalles</span>
              <span>·</span>
              <span>Misma calidad Winston</span>
              <span>·</span>
              <span>Muy pronto en tu dashboard</span>
              <span>·</span>
            </div>
          </div>

          <div className="proximamente-actions">
            <Link href="/dashboard" className="proximamente-cta">
              Regresar al dashboard
            </Link>
            <p className="proximamente-footnote">
              Mientras tanto puedes usar Inscripciones, Alta de Facturación y Becas.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default function ProximamentePage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <Suspense
        fallback={
          <div className="proximamente-page">
            <p className="proximamente-loading">Cargando…</p>
          </div>
        }
      >
        <ProximamenteContent />
      </Suspense>
    </ProtectedRoute>
  )
}
