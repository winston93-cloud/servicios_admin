'use client'

import { useEffect, useState } from 'react'
import { CalendarRange, Check } from 'lucide-react'

export type PlanMesesOpcion = 1 | 2

interface PortalPlanPagosModalProps {
  abierto: boolean
  planActual: PlanMesesOpcion
  cicloNombre?: string | null
  /** Texto adaptado: NI elige; reinscrito confirma/cambia el que ya trae. */
  esNuevoIngreso?: boolean
  puedeCambiar?: boolean
  guardando?: boolean
  error?: string | null
  onConfirmar: (plan: PlanMesesOpcion) => void
}

const OPCIONES: {
  valor: PlanMesesOpcion
  titulo: string
  detalle: string
}[] = [
  {
    valor: 1,
    titulo: '10 meses',
    detalle:
      '10 colegiaturas: de septiembre a junio. No incluye la colegiatura de julio. La Cuota de Inicio de Curso (agosto) se paga aparte y no cuenta como colegiatura.',
  },
  {
    valor: 2,
    titulo: '11 meses',
    detalle:
      '11 colegiaturas: de septiembre a julio (sí incluye la colegiatura de julio). La Cuota de Inicio de Curso (agosto) se paga aparte y no cuenta como colegiatura.',
  },
]

export default function PortalPlanPagosModal({
  abierto,
  planActual,
  cicloNombre,
  esNuevoIngreso = false,
  puedeCambiar = true,
  guardando = false,
  error = null,
  onConfirmar,
}: PortalPlanPagosModalProps) {
  const [seleccion, setSeleccion] = useState<PlanMesesOpcion>(planActual)

  useEffect(() => {
    if (abierto) setSeleccion(planActual)
  }, [abierto, planActual])

  useEffect(() => {
    if (!abierto) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [abierto])

  if (!abierto) return null

  const cicloTxt = cicloNombre?.trim() ? ` ${cicloNombre.trim()}` : ''

  return (
    <div className="portal-plan-modal-overlay" role="presentation">
      <div
        className="portal-plan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-plan-modal-title"
      >
        <div className="portal-plan-modal-icono" aria-hidden>
          <CalendarRange size={28} />
        </div>
        <h2 id="portal-plan-modal-title" className="portal-plan-modal-title">
          Plan de pagos del ciclo{cicloTxt}
        </h2>
        <p className="portal-plan-modal-sub">
          {esNuevoIngreso
            ? 'Antes de ver las colegiaturas, elige el plan de pagos del alumno (10 u 11 meses). De eso dependen las mensualidades.'
            : 'Antes de ver las colegiaturas, confirma si mantienes o cambias el plan que ya trae el reinscrito (10 u 11 meses). De eso dependen las mensualidades.'}
        </p>

        <div className="portal-plan-modal-opciones" role="radiogroup" aria-label="Plan de pagos">
          {OPCIONES.map((op) => {
            const activo = seleccion === op.valor
            const esActual = planActual === op.valor
            const deshabilitado = !puedeCambiar && !esActual
            return (
              <button
                key={op.valor}
                type="button"
                role="radio"
                aria-checked={activo}
                disabled={guardando || deshabilitado}
                className={
                  'portal-plan-modal-opcion' +
                  (activo ? ' portal-plan-modal-opcion--activa' : '') +
                  (esActual ? ' portal-plan-modal-opcion--actual' : '')
                }
                onClick={() => {
                  if (!deshabilitado) setSeleccion(op.valor)
                }}
              >
                <span className="portal-plan-modal-opcion-check" aria-hidden>
                  {activo ? <Check size={16} /> : null}
                </span>
                <span className="portal-plan-modal-opcion-texto">
                  <span className="portal-plan-modal-opcion-titulo">
                    {op.titulo}
                    {esActual ? (
                      <span className="portal-plan-modal-opcion-tag">Actual</span>
                    ) : null}
                  </span>
                  <span className="portal-plan-modal-opcion-detalle">{op.detalle}</span>
                </span>
              </button>
            )
          })}
        </div>

        {!puedeCambiar && (
          <p className="portal-plan-modal-aviso" role="note">
            Ya hay pagos de colegiatura en este ciclo; solo puedes confirmar el plan actual.
          </p>
        )}

        {error && (
          <p className="portal-plan-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="portal-plan-modal-acciones">
          <button
            type="button"
            className="portal-plan-modal-btn"
            disabled={guardando}
            onClick={() => onConfirmar(seleccion)}
          >
            {guardando
              ? 'Guardando…'
              : seleccion === planActual
                ? 'Mantener este plan'
                : 'Cambiar a este plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
