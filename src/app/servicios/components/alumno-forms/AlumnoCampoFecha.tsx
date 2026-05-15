'use client'

import { useRef } from 'react'
import { Calendar } from 'lucide-react'
import {
  fechaNacAMostrar,
  fechaNacDesdeTexto,
} from '@/lib/fechaNacimiento'

interface AlumnoCampoFechaProps {
  id: string
  name: string
  label: string
  iso: string
  texto: string
  onIsoChange: (iso: string) => void
  onTextoChange: (texto: string) => void
  soloLectura?: boolean
  placeholder?: string
}

export default function AlumnoCampoFecha({
  id,
  name,
  label,
  iso,
  texto,
  onIsoChange,
  onTextoChange,
  soloLectura = false,
  placeholder = 'DD/MM/AAAA',
}: AlumnoCampoFechaProps) {
  const calRef = useRef<HTMLInputElement>(null)

  const aplicarIso = (valor: string) => {
    onIsoChange(valor)
    onTextoChange(fechaNacAMostrar(valor))
  }

  const abrirCalendario = () => {
    const el = calRef.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
  }

  const valorMostrado = soloLectura ? fechaNacAMostrar(iso) || '' : texto

  return (
    <div className="alumno-form-field">
      <label htmlFor={id} className="alumno-form-label">
        {label}
      </label>
      <div className={`alumno-form-fecha-fila${soloLectura ? ' alumno-form-fecha-fila--solo-lectura' : ''}`}>
        <input
          id={id}
          name={name}
          type="text"
          className="alumno-form-input alumno-form-input--fecha"
          value={valorMostrado}
          onChange={(e) => !soloLectura && onTextoChange(e.target.value)}
          onBlur={() => {
            if (soloLectura) return
            const parsed = fechaNacDesdeTexto(texto)
            if (parsed === null && texto.trim()) {
              onTextoChange(fechaNacAMostrar(iso))
              return
            }
            if (parsed !== null) aplicarIso(parsed)
          }}
          placeholder={placeholder}
          inputMode={soloLectura ? undefined : 'numeric'}
          autoComplete="off"
          readOnly={soloLectura}
        />
        {!soloLectura && (
          <>
            <input
              ref={calRef}
              type="date"
              className="alumno-form-fecha-cal"
              value={iso}
              onChange={(e) => aplicarIso(e.target.value)}
              aria-label={`Elegir ${label} en calendario`}
              tabIndex={-1}
            />
            <button
              type="button"
              className="alumno-form-fecha-btn"
              onClick={abrirCalendario}
              aria-label={`Abrir calendario de ${label}`}
            >
              <Calendar size={18} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
