'use client'

/**
 * 2026-10-10 — Beneficios externos · vista del alumno (vista previa para ruben, mario y alan).
 * El cuestionario vive en ./Cuestionario (también se abre como popup desde el dashboard).
 * No guarda respuestas ni toca el módulo de Becas.
 */

import Link from 'next/link'
import { ArrowLeft, Eye } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import GuardiaBeneficiosExternos from './GuardiaBeneficiosExternos'
import Cuestionario from './Cuestionario'
import './beneficios-externos.css'

export default function BeneficiosExternosAlumnoPage() {
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
        <main className="bx-main">
          <p className="bx-preview" role="note">
            <Eye size={15} aria-hidden />
            Vista previa del alumno · solo Rubén, Mario y Alan. Las respuestas no se guardan.
          </p>
          <Cuestionario />
        </main>
      </div>
    </GuardiaBeneficiosExternos>
  )
}
