'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  CURP_LONGITUD,
  SEGMENTOS_CURP,
  normalizarCurp,
  segmentoCurp,
  validarFormatoCurp,
} from '@/lib/curp'

export interface AlumnoCurpModalProps {
  isOpen: boolean
  onClose: () => void
  valorInicial: string
  onAplicar: (curp: string) => void
  nombreAlumno?: string
  fechaNacimiento?: string | null
  sexoRegistrado?: string | null
}

function formatearFechaReferencia(fecha: string | null | undefined): string | null {
  if (!fecha) return null
  const solo = fecha.slice(0, 10)
  const [y, m, d] = solo.split('-')
  if (!y || !m || !d) return fecha
  return `${d}/${m}/${y}`
}

function etiquetaSexo(sexo: string | null | undefined): string | null {
  if (!sexo || sexo === '0') return null
  const s = sexo.toUpperCase()
  if (s === 'H') return 'Hombre (H en CURP)'
  if (s === 'M') return 'Mujer (M en CURP)'
  return `Sexo registrado: ${sexo}`
}

export default function AlumnoCurpModal({
  isOpen,
  onClose,
  valorInicial,
  onAplicar,
  nombreAlumno,
  fechaNacimiento,
  sexoRegistrado,
}: AlumnoCurpModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [borrador, setBorrador] = useState('')
  const [intentoAplicar, setIntentoAplicar] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setBorrador(normalizarCurp(valorInicial))
    setIntentoAplicar(false)
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [isOpen, valorInicial])

  const curpNormalizado = useMemo(() => normalizarCurp(borrador), [borrador])
  const validacion = useMemo(() => validarFormatoCurp(curpNormalizado), [curpNormalizado])
  const mostrarError = intentoAplicar && !validacion.valido

  const fechaRef = formatearFechaReferencia(fechaNacimiento)
  const sexoRef = etiquetaSexo(sexoRegistrado)

  if (!isOpen) return null

  const aplicar = () => {
    setIntentoAplicar(true)
    if (!validacion.valido) return
    onAplicar(curpNormalizado)
    onClose()
  }

  return (
    <div
      className="alumno-curp-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="alumno-curp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alumno-curp-modal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="alumno-curp-modal-header">
          <div>
            <h2 id="alumno-curp-modal-titulo" className="alumno-curp-modal-titulo">
              Corregir CURP
            </h2>
            {nombreAlumno ? (
              <p className="alumno-curp-modal-subtitulo">{nombreAlumno}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="alumno-curp-modal-cerrar"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={22} aria-hidden />
          </button>
        </header>

        <div className="alumno-curp-modal-body">
          <p className="alumno-curp-modal-ayuda">
            Revise letra por letra el CURP capturado por el padre. Use mayúsculas; el
            formato son 18 caracteres sin espacios ni guiones.
          </p>

          {(fechaRef || sexoRef) && (
            <div className="alumno-curp-modal-referencia" role="note">
              <span className="alumno-curp-modal-referencia-titulo">Datos en expediente</span>
              <ul>
                {fechaRef ? <li>Fecha de nacimiento: {fechaRef}</li> : null}
                {sexoRef ? <li>{sexoRef}</li> : null}
              </ul>
            </div>
          )}

          <label htmlFor="alumno_curp_modal" className="alumno-form-label">
            CURP
          </label>
          <input
            ref={inputRef}
            id="alumno_curp_modal"
            type="text"
            className={`alumno-curp-modal-input${mostrarError ? ' alumno-curp-modal-input--error' : ''}`}
            value={borrador}
            onChange={(e) => setBorrador(normalizarCurp(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                aplicar()
              }
            }}
            maxLength={CURP_LONGITUD}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Ej. AAAA000000HDFXXX00"
          />
          <p className="alumno-curp-modal-contador" aria-live="polite">
            {curpNormalizado.length}/{CURP_LONGITUD} caracteres
          </p>
          {mostrarError && validacion.mensaje ? (
            <p className="alumno-curp-modal-error" role="alert">
              {validacion.mensaje}
            </p>
          ) : null}

          <div className="alumno-curp-modal-segmentos" aria-label="Desglose del CURP">
            {SEGMENTOS_CURP.map((seg) => (
              <div key={seg.etiqueta} className="alumno-curp-modal-segmento">
                <span className="alumno-curp-modal-segmento-etiqueta">{seg.etiqueta}</span>
                <code className="alumno-curp-modal-segmento-valor">
                  {segmentoCurp(curpNormalizado, seg.inicio, seg.fin)}
                </code>
              </div>
            ))}
          </div>
        </div>

        <footer className="alumno-curp-modal-footer">
          <button
            type="button"
            className="alumno-curp-modal-btn alumno-curp-modal-btn--sec"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="alumno-curp-modal-btn alumno-curp-modal-btn--pri"
            onClick={aplicar}
          >
            Aplicar CURP
          </button>
        </footer>
      </div>
    </div>
  )
}
