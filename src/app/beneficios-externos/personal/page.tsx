'use client'

/**
 * 2026-10-10 — Beneficios externos · módulo del personal (solo ruben, mario y alan).
 * Todavía no hay respuestas guardadas: la tarjeta de alumnos no está publicada para familias.
 * No lee ni escribe tablas de becas.
 */

import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, ExternalLink, Eye, Inbox } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import GuardiaBeneficiosExternos from '../GuardiaBeneficiosExternos'
import { urlRevisionBecaSep } from '@/lib/beneficiosExternos/config'
import '../beneficios-externos.css'

const PREGUNTAS = [
  '¿El alumno ha aplicado a alguna beca externa? (Sí / No)',
  '¿A cuál? Beca SEP u otra (la familia escribe el nombre).',
  '¿Ya recibió el beneficio?',
  'Si ya lo recibió: Beca SEP → portal de becas para subir la autorización; otra → entregar copia en Control Escolar.',
]

export default function BeneficiosExternosPersonalPage() {
  return (
    <GuardiaBeneficiosExternos>
      <div className="bx-page">
        <header className="bx-top">
          <Link href="/dashboard" className="bx-back">
            <ArrowLeft size={16} aria-hidden />
            Volver al inicio
          </Link>
          <ThemeToggle />
        </header>

        <main className="bx-main bx-main--ancho">
          <section className="bx-card" aria-labelledby="bx-personal-titulo">
            <div className="bx-card-head">
              <span className="bx-icono" aria-hidden>
                <ClipboardCheck size={22} strokeWidth={1.75} />
              </span>
              <div>
                <p className="bx-kicker">Nuevo módulo · personal</p>
                <h1 id="bx-personal-titulo">Beneficios externos</h1>
              </div>
            </div>

            <div className="bx-vacio">
              <Inbox size={26} strokeWidth={1.5} aria-hidden />
              <div>
                <strong>Sin respuestas de familias</strong>
                <p>
                  La tarjeta del alumno todavía no está publicada para familias. Cuando se publique, aquí
                  aparecerá quién aplicó a una beca externa, a cuál y si ya subió su documento.
                </p>
              </div>
            </div>

            <h2 className="bx-subtitulo">Qué se le pregunta a la familia</h2>
            <ol className="bx-lista">
              {PREGUNTAS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>

            <div className="bx-acciones bx-acciones--inicio">
              <Link href="/beneficios-externos" className="bx-btn bx-btn--ghost">
                <Eye size={16} aria-hidden />
                Ver la tarjeta como alumno
              </Link>
              <a className="bx-btn" href={urlRevisionBecaSep()} target="_blank" rel="noopener noreferrer">
                Revisar documentos de Beca SEP
                <ExternalLink size={15} aria-hidden />
              </a>
            </div>
          </section>
        </main>
      </div>
    </GuardiaBeneficiosExternos>
  )
}
