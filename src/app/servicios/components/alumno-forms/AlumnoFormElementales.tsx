'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { obtenerDatosElementalesPorRef, type AlumnoDatosElementales } from '@/lib/alumnoDatosService'
import { CICLOS_ESCOLARES_OPCIONES, cicloEscolarPorDefecto } from '@/lib/cicloEscolar'

interface AlumnoFormElementalesProps {
  alumno: AlumnoBusquedaResultado
}

export default function AlumnoFormElementales({ alumno }: AlumnoFormElementalesProps) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<AlumnoDatosElementales | null>(null)
  const [cicloEscolar, setCicloEscolar] = useState<number>(
    CICLOS_ESCOLARES_OPCIONES[0].valor
  )

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)

    obtenerDatosElementalesPorRef(alumno.alumno_ref).then((registro) => {
      if (!activo) return
      if (!registro) {
        setError('No se pudo cargar la información del alumno.')
        setDatos(null)
      } else {
        setDatos(registro)
        setCicloEscolar(cicloEscolarPorDefecto(registro.alumno.alumno_ciclo_escolar))
      }
      setCargando(false)
    })

    return () => {
      activo = false
    }
  }, [alumno.alumno_ref, alumno.alumno_id])

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

  const { alumno: a, detalles } = datos

  return (
    <form className="alumno-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <fieldset className="alumno-form-fieldset">
        <div className="alumno-form-grid alumno-form-grid--3">
          <div className="alumno-form-field">
            <label htmlFor="alumno_id" className="alumno-form-label">
              ID
            </label>
            <input
              id="alumno_id"
              name="alumno_id"
              type="text"
              className="alumno-form-input"
              value={String(a.alumno_id)}
              readOnly
            />
          </div>
          <div className="alumno-form-field">
            <label htmlFor="alumno_ref" className="alumno-form-label">
              No. de control
            </label>
            <input
              id="alumno_ref"
              name="alumno_ref"
              type="text"
              className="alumno-form-input"
              value={a.alumno_ref ?? ''}
              readOnly
            />
          </div>
          <div className="alumno-form-field">
            <label htmlFor="alumno_ciclo_escolar" className="alumno-form-label">
              Ciclo escolar
            </label>
            <select
              id="alumno_ciclo_escolar"
              name="alumno_ciclo_escolar"
              className="alumno-form-select"
              value={String(cicloEscolar)}
              onChange={(e) => setCicloEscolar(Number(e.target.value))}
            >
              {CICLOS_ESCOLARES_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="alumno-form-fieldset alumno-form-fieldset--spaced">
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
              value={a.alumno_app ?? ''}
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
              value={a.alumno_apm ?? ''}
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
              value={a.alumno_nombre ?? ''}
              readOnly
              autoComplete="given-name"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="alumno-form-fieldset alumno-form-fieldset--spaced">
        <div className="alumno-form-grid alumno-form-grid--1">
          <div className="alumno-form-field alumno-form-field--narrow">
            <label htmlFor="alumno_clave" className="alumno-form-label">
              Clave personal
            </label>
            <input
              id="alumno_clave"
              name="alumno_clave"
              type="text"
              className="alumno-form-input"
              value={detalles?.alumno_clave ?? ''}
              readOnly
              placeholder={detalles ? undefined : 'Sin registro en alumno_detalles'}
            />
          </div>
        </div>
      </fieldset>
    </form>
  )
}
