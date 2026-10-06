'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  SITUACION_DELICADA_COMENTARIOS_MAX,
  validarSituacionDelicada,
  type SnapshotSituacionDelicada,
} from '@/lib/alumnoSituacionDelicadaService'

export type AlumnoSituacionDelicadaModalProps = {
  isOpen: boolean
  onClose: () => void
  nombreAlumno?: string
  valorInicial: SnapshotSituacionDelicada
  guardando?: boolean
  error?: string | null
  onGuardar: (snapshot: SnapshotSituacionDelicada) => Promise<boolean> | boolean
}

export default function AlumnoSituacionDelicadaModal({
  isOpen,
  onClose,
  nombreAlumno,
  valorInicial,
  guardando = false,
  error = null,
  onGuardar,
}: AlumnoSituacionDelicadaModalProps) {
  const tituloId = useId()
  const checkRef = useRef<HTMLInputElement>(null)
  const abiertoEn = useRef(0)
  const [aplica, setAplica] = useState(() => !valorInicial.noCorresponde)
  const [comentarios, setComentarios] = useState(() => valorInicial.comentarios)
  const [editado, setEditado] = useState(false)
  const [intentoGuardar, setIntentoGuardar] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setAplica(!valorInicial.noCorresponde)
    setComentarios(valorInicial.comentarios)
    setEditado(false)
    setIntentoGuardar(false)
    abiertoEn.current = Date.now()
    const t = window.setTimeout(() => checkRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [isOpen, valorInicial.noCorresponde, valorInicial.comentarios])

  if (!isOpen) return null

  const snapshot: SnapshotSituacionDelicada = {
    noCorresponde: !aplica,
    comentarios,
  }
  const errorValidacion = intentoGuardar ? validarSituacionDelicada(snapshot) : null
  const errorMostrado = errorValidacion || error

  const aplicar = async () => {
    setIntentoGuardar(true)
    if (validarSituacionDelicada(snapshot)) return false
    const ok = await onGuardar(snapshot)
    if (ok) onClose()
    return ok
  }

  const cerrarSinGuardar = () => {
    if (!guardando) onClose()
  }

  const cerrarYGuardarSiEdito = (desdeOverlay = false) => {
    if (guardando) return
    if (desdeOverlay && Date.now() - abiertoEn.current < 280) return
    if (!editado) {
      onClose()
      return
    }
    void aplicar()
  }

  return (
    <div
      className="alumno-curp-modal-overlay"
      role="presentation"
      onClick={() => cerrarYGuardarSiEdito(true)}
    >
      <div
        className="alumno-curp-modal alumno-situacion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="alumno-curp-modal-header">
          <div>
            <h2 id={tituloId} className="alumno-curp-modal-titulo">
              Situación delicada
            </h2>
            {nombreAlumno ? (
              <p className="alumno-curp-modal-subtitulo">{nombreAlumno}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="alumno-curp-modal-cerrar"
            onClick={() => cerrarYGuardarSiEdito(false)}
            disabled={guardando}
            aria-label="Cerrar"
          >
            <X size={22} aria-hidden />
          </button>
        </header>

        <div className="alumno-curp-modal-body">
          <p className="alumno-curp-modal-ayuda">
            El estado sale como <strong>No corresponde</strong>. Para cambiarlo,
            marca <strong>Aplica</strong> y escribe el comentario del expediente.
          </p>

          <label className={`alumno-situacion-check${aplica ? ' alumno-situacion-check--aplica' : ''}`}>
            <input
              ref={checkRef}
              type="checkbox"
              checked={aplica}
              onChange={(e) => {
                setEditado(true)
                setAplica(e.target.checked)
              }}
              disabled={guardando}
            />
            <span>
              <strong>Aplica</strong>
              <span className="alumno-situacion-check-hint">
                Hay una situación delicada que debe quedar registrada.
              </span>
            </span>
          </label>

          <label htmlFor="alumno_situacion_comentarios" className="alumno-form-label">
            Comentarios
          </label>
          <textarea
            id="alumno_situacion_comentarios"
            className={`alumno-situacion-textarea${errorValidacion ? ' alumno-situacion-textarea--error' : ''}`}
            value={comentarios}
            onChange={(e) => {
              setEditado(true)
              setComentarios(e.target.value)
            }}
            maxLength={SITUACION_DELICADA_COMENTARIOS_MAX}
            rows={4}
            disabled={guardando || !aplica}
            placeholder={
              aplica
                ? 'Describe la situación con el detalle necesario para el expediente'
                : 'Marca Aplica para habilitar los comentarios'
            }
          />
          <p className="alumno-curp-modal-contador" aria-live="polite">
            {comentarios.trim().length}/{SITUACION_DELICADA_COMENTARIOS_MAX} caracteres
          </p>
          {errorMostrado ? (
            <p className="alumno-curp-modal-error" role="alert">
              {errorMostrado}
            </p>
          ) : null}
        </div>

        <footer className="alumno-curp-modal-footer">
          <button
            type="button"
            className="alumno-curp-modal-btn alumno-curp-modal-btn--sec"
            onClick={cerrarSinGuardar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="alumno-curp-modal-btn alumno-curp-modal-btn--pri"
            onClick={() => void aplicar()}
            disabled={guardando}
          >
            {guardando ? (
              <Loader2 size={18} className="alumno-form-guardar-btn-icon" aria-hidden />
            ) : null}
            Guardar
          </button>
        </footer>
      </div>
    </div>
  )
}
