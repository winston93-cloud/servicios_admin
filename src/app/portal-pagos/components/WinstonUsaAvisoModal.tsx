'use client'

import { useEffect, useRef } from 'react'
import {
  ArrowRight,
  Award,
  CalendarClock,
  FileCheck2,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Info,
  X,
} from 'lucide-react'

interface WinstonUsaAvisoModalProps {
  abierto: boolean
  /** 1 = primer pago; 2/3 = pagos siguientes. */
  pago: 1 | 2 | 3
  concepto: string
  onContinuar: () => void
  onCancelar: () => void
  textoContinuar?: string
  /** Sin pago abierto todavía: solo informa (botón «Entendido»). */
  notaSinPago?: string
}

const BENEFICIOS = [
  {
    icono: Award,
    titulo: 'Doble titulación',
    texto: 'Opción del Instituto Winston Churchill.',
  },
  {
    icono: Globe2,
    titulo: 'Documentación estadounidense',
    texto: 'Reconocimiento académico de sus estudios.',
  },
  {
    icono: FileCheck2,
    titulo: 'Institución acreditada',
    texto: 'Respaldo oficial para su expediente.',
  },
] as const

export default function WinstonUsaAvisoModal({
  abierto,
  pago,
  concepto,
  onContinuar,
  onCancelar,
  textoContinuar = 'Continuar con el pago',
  notaSinPago,
}: WinstonUsaAvisoModalProps) {
  const continuarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    continuarRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto, onCancelar])

  if (!abierto) return null

  const primero = pago === 1

  return (
    <div className="portal-doc-modal-overlay" role="presentation" onClick={onCancelar}>
      <div
        className="portal-usa-aviso"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-usa-aviso-titulo"
        aria-describedby="portal-usa-aviso-texto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="portal-usa-aviso-hero">
          <div className="portal-usa-aviso-hero-fondo" aria-hidden />
          <button
            type="button"
            className="portal-usa-aviso-cerrar"
            onClick={onCancelar}
            aria-label="Cerrar aviso"
          >
            <X size={20} aria-hidden />
          </button>
          <span className="portal-usa-aviso-emblema" aria-hidden>
            <GraduationCap size={34} strokeWidth={1.8} />
          </span>
          <p className="portal-usa-aviso-eyebrow">{concepto || 'Winston USA Program'}</p>
          <h2 id="portal-usa-aviso-titulo" className="portal-usa-aviso-titulo">
            {primero ? 'Antes de continuar' : 'Pago siguiente'}
          </h2>
          <ol className="portal-usa-aviso-pasos" aria-label={`Pago ${pago} de 3`}>
            {([1, 2, 3] as const).map((n) => (
              <li
                key={n}
                className={
                  n === pago
                    ? 'is-actual'
                    : n < pago
                      ? 'is-previo'
                      : undefined
                }
                aria-current={n === pago ? 'step' : undefined}
              >
                <span>{n}</span>
                Pago {n}
              </li>
            ))}
          </ol>
        </header>

        <div id="portal-usa-aviso-texto" className="portal-usa-aviso-body">
          {primero ? (
            <>
              <p className="portal-usa-aviso-lead">
                El Programa USA es una opción de doble titulación del Instituto Winston Churchill: los
                estudios del alumno se integran a un proceso de reconocimiento académico que permite
                contar con documentación estadounidense respaldada por una institución acreditada.
              </p>
              <ul className="portal-usa-aviso-beneficios">
                {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
                  <li key={titulo}>
                    <span className="portal-usa-aviso-beneficio-icono" aria-hidden>
                      <Icono size={20} />
                    </span>
                    <span>
                      <strong>{titulo}</strong>
                      <small>{texto}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="portal-usa-aviso-callout">
                <HeartHandshake size={20} aria-hidden />
                <p>
                  <strong>No es obligatorio.</strong> Continúe solo si la familia desea participar.
                  Este primer pago confirma el interés en el programa.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="portal-usa-aviso-lead">
                El Programa USA es la opción de doble titulación con documentación académica
                estadounidense, para fortalecer el expediente del alumno con proyección internacional.
              </p>
              <div className="portal-usa-aviso-callout portal-usa-aviso-callout--fuerte">
                <Info size={20} aria-hidden />
                <p>
                  <strong>Este pago es solo para quien ya realizó el pago anterior (o los anteriores).</strong>
                </p>
              </div>
              <div className="portal-usa-aviso-callout">
                <HeartHandshake size={20} aria-hidden />
                <p>La participación sigue siendo voluntaria.</p>
              </div>
            </>
          )}
          {notaSinPago ? (
            <div className="portal-usa-aviso-fecha">
              <CalendarClock size={22} aria-hidden />
              <p>{notaSinPago}</p>
            </div>
          ) : null}
        </div>

        <footer className="portal-usa-aviso-foot">
          {notaSinPago ? (
            <button
              ref={continuarRef}
              type="button"
              className="portal-usa-aviso-btn-prim"
              onClick={onCancelar}
            >
              Entendido
            </button>
          ) : (
            <>
              <button type="button" className="portal-usa-aviso-btn-sec" onClick={onCancelar}>
                Cancelar
              </button>
              <button
                ref={continuarRef}
                type="button"
                className="portal-usa-aviso-btn-prim"
                onClick={onContinuar}
              >
                {textoContinuar}
                <ArrowRight size={18} aria-hidden />
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
