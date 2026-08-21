'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import {
  ArrowLeft,
  ClipboardList,
  Coffee,
  Construction,
  NotebookPen,
  PenLine,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'
import './proximamente.css'

type ModuloProximamente =
  | 'desayunos'
  | 'boletas'
  | 'conducta'
  | 'firma-electronica'
  | 'general'
type Accent = 'amber' | 'indigo' | 'rose' | 'sky'

const MODULOS: Record<
  ModuloProximamente,
  {
    titulo: string
    kicker: string
    lead: string
    accent: Accent
    bullets: string[]
    icon: ReactNode
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
    icon: <Coffee size={34} strokeWidth={1.6} />,
  },
  boletas: {
    titulo: 'Boletas',
    kicker: 'Control escolar',
    lead: 'Captura, consulta y envío de boletas se integran aquí con la misma experiencia del dashboard.',
    accent: 'indigo',
    bullets: [
      'Captura y envío por periodo escolar',
      'Consulta clara para familias y personal',
      'Acceso seguro con la sesión del portal',
    ],
    icon: <NotebookPen size={34} strokeWidth={1.6} />,
  },
  conducta: {
    titulo: 'Reportes de Conducta',
    kicker: 'Seguimiento escolar',
    lead: 'La captura y el seguimiento de reportes de conducta llegan a este portal con un flujo más ágil.',
    accent: 'rose',
    bullets: [
      'Registro de incidencias por alumno',
      'Seguimiento y historial institucional',
      'Misma sesión, sin salir del dashboard',
    ],
    icon: <ClipboardList size={34} strokeWidth={1.6} />,
  },
  'firma-electronica': {
    titulo: 'Pruebas firma electrónica',
    kicker: 'Pruebas internas',
    lead: 'Espacio listo en el dashboard de empleados. Cuando Mario defina el flujo, aquí arranca la firma electrónica.',
    accent: 'sky',
    bullets: [
      'Visible solo para personal (tabla usuario)',
      'Tarjeta ya disponible en el dashboard',
      'Funcionalidad de pruebas en la siguiente definición',
    ],
    icon: <PenLine size={34} strokeWidth={1.6} />,
  },
  general: {
    titulo: 'Módulo en preparación',
    kicker: 'Winston digital',
    lead: 'Estamos terminando los últimos detalles para abrirte una experiencia más cómoda.',
    accent: 'amber',
    bullets: [
      'Diseño unificado con el resto del portal',
      'Acceso con la misma sesión',
      'Pronto disponible en este dashboard',
    ],
    icon: <Coffee size={34} strokeWidth={1.6} />,
  },
}

function ProximamenteContent() {
  const params = useSearchParams()
  const { isUsuario } = useAuth()
  const raw = (params.get('m') || params.get('modulo') || '').toLowerCase()
  const key: ModuloProximamente =
    raw === 'desayunos' ||
    raw === 'boletas' ||
    raw === 'conducta' ||
    raw === 'firma-electronica'
      ? raw
      : 'general'
  const mod = MODULOS[key]

  return (
    <div className="proximamente-page" data-accent={mod.accent}>
      <div className="proximamente-bg" aria-hidden>
        <span className="proximamente-orb proximamente-orb--a" />
        <span className="proximamente-orb proximamente-orb--b" />
        <span className="proximamente-grid" />
        <span className="proximamente-beam" />
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
          <div className="proximamente-status">
            <div className="proximamente-badge">
              <Sparkles size={14} aria-hidden />
              Próximamente
            </div>
            <div className="proximamente-build">
              <Construction size={14} aria-hidden />
              En construcción
            </div>
          </div>

          <div className="proximamente-icon-wrap" aria-hidden>
            {mod.icon}
            <span className="proximamente-icon-ring" />
          </div>

          <p className="proximamente-kicker">{mod.kicker}</p>
          <h1 id="proximamente-title">{mod.titulo}</h1>
          <p className="proximamente-lead">{mod.lead}</p>

          <div className="proximamente-progress" aria-hidden>
            <div className="proximamente-progress-bar">
              <span className="proximamente-progress-fill" />
            </div>
            <p className="proximamente-progress-label">Integración en curso</p>
          </div>

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
              {isUsuario
                ? 'Mientras tanto puedes continuar con el resto de módulos administrativos.'
                : 'Mientras tanto puedes usar Inscripciones y Alta de Facturación.'}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default function ProximamentePage() {
  return (
    <ProtectedRoute roles={['alumno', 'usuario']}>
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
