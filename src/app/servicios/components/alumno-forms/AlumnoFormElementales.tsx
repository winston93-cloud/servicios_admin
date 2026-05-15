'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { obtenerAlumnoPorId, type AlumnoRegistro } from '@/lib/alumnoDatosService'

interface AlumnoFormElementalesProps {
  alumno: AlumnoBusquedaResultado
}

export default function AlumnoFormElementales({ alumno }: AlumnoFormElementalesProps) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<AlumnoRegistro | null>(null)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)

    obtenerAlumnoPorId(alumno.alumno_id).then((registro) => {
      if (!activo) return
      if (!registro) {
        setError('No se pudo cargar la información del alumno.')
        setDatos(null)
      } else {
        setDatos(registro)
      }
      setCargando(false)
    })

    return () => {
      activo = false
    }
  }, [alumno.alumno_id])

  if (cargando) {
    return (
      <div className="alumno-form-loading">
        <Loader2 size={24} className="alumno-form-loading-icon" aria-hidden />
        <span>Cargando datos del alumno…</span>
      </div>
    )
  }

  if (error || !datos) {
    return (
      <p className="alumno-form-error" role="alert">
        {error ?? 'Sin datos disponibles.'}
      </p>
    )
  }

  return (
    <form className="alumno-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <fieldset className="alumno-form-fieldset">
        <legend className="alumno-form-legend">Nombre del alumno</legend>
        <div className="alumno-form-grid alumno-form-grid--3">
          <div className="alumno-form-field">
            <label htmlFor="alumno_app" className="alumno-form-label">
              Apellido paterno
            </label>
            <input
              id="alumno_app"
              name="alumno_app"
              type="text"
              className="alumno-form-input"
              value={datos.alumno_app ?? ''}
              readOnly
              autoComplete="family-name"
            />
          </div>
          <div className="alumno-form-field">
            <label htmlFor="alumno_apm" className="alumno-form-label">
              Apellido materno
            </label>
            <input
              id="alumno_apm"
              name="alumno_apm"
              type="text"
              className="alumno-form-input"
              value={datos.alumno_apm ?? ''}
              readOnly
              autoComplete="family-name"
            />
          </div>
          <div className="alumno-form-field">
            <label htmlFor="alumno_nombre" className="alumno-form-label">
              Nombre(s)
            </label>
            <input
              id="alumno_nombre"
              name="alumno_nombre"
              type="text"
              className="alumno-form-input"
              value={datos.alumno_nombre ?? ''}
              readOnly
              autoComplete="given-name"
            />
          </div>
        </div>
      </fieldset>
    </form>
  )
}
