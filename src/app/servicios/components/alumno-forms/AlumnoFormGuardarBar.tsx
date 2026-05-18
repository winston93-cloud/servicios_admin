'use client'

import { Check, Loader2, Save } from 'lucide-react'

export type VarianteBotonGuardar = 'idle' | 'dirty' | 'saved' | 'guardando'

interface AlumnoFormGuardarBarProps {
  etiqueta: string
  variante: VarianteBotonGuardar
  modificado: boolean
  guardando: boolean
  mensaje: string | null
  errorGuardar: boolean
  onGuardar: () => void
}

export default function AlumnoFormGuardarBar({
  etiqueta,
  variante,
  modificado,
  guardando,
  mensaje,
  errorGuardar,
  onGuardar,
}: AlumnoFormGuardarBarProps) {
  return (
    <footer className="alumno-form-guardar">
      {mensaje && (
        <p
          className={`alumno-form-guardar-msg ${errorGuardar ? 'alumno-form-guardar-msg--error' : 'alumno-form-guardar-msg--ok'}`}
          role={errorGuardar ? 'alert' : 'status'}
        >
          {mensaje}
        </p>
      )}
      <button
        type="button"
        className={`alumno-form-guardar-btn alumno-form-guardar-btn--${variante}`}
        disabled={guardando || !modificado}
        onClick={onGuardar}
      >
        {guardando ? (
          <Loader2 size={20} className="alumno-form-guardar-btn-icon" aria-hidden />
        ) : variante === 'saved' && !modificado ? (
          <Check size={20} className="alumno-form-guardar-btn-icon" aria-hidden />
        ) : (
          <Save size={20} className="alumno-form-guardar-btn-icon" aria-hidden />
        )}
        {etiqueta}
      </button>
    </footer>
  )
}
