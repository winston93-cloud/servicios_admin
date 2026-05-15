'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { obtenerDatosElementalesPorRef, type AlumnoDatosElementales } from '@/lib/alumnoDatosService'
import { CICLOS_ESCOLARES_OPCIONES, cicloEscolarPorDefecto } from '@/lib/cicloEscolar'
import { NIVELES_ESCOLARES_OPCIONES, nivelEscolarPorDefecto } from '@/lib/nivelEscolar'
import {
  gradoEscolarPorDefecto,
  gradoOpcionesPorNivel,
} from '@/lib/gradoEscolar'

interface AlumnoFormElementalesProps {
  alumno: AlumnoBusquedaResultado
}

export default function AlumnoFormElementales({ alumno }: AlumnoFormElementalesProps) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<AlumnoDatosElementales | null>(null)
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [nombre, setNombre] = useState('')
  const [clavePersonal, setClavePersonal] = useState('')
  const [cicloEscolar, setCicloEscolar] = useState<number>(
    CICLOS_ESCOLARES_OPCIONES[0].valor
  )
  const [nivelEscolar, setNivelEscolar] = useState<number>(
    NIVELES_ESCOLARES_OPCIONES[0].valor
  )
  const [gradoEscolar, setGradoEscolar] = useState<number>(1)

  const opcionesGrado = useMemo(
    () => gradoOpcionesPorNivel(nivelEscolar),
    [nivelEscolar]
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
        setApellidoPaterno(registro.alumno.alumno_app ?? '')
        setApellidoMaterno(registro.alumno.alumno_apm ?? '')
        setNombre(registro.alumno.alumno_nombre ?? '')
        setClavePersonal(registro.detalles?.alumno_clave ?? '')
        const nivel = nivelEscolarPorDefecto(registro.alumno.alumno_nivel)
        setCicloEscolar(cicloEscolarPorDefecto(registro.alumno.alumno_ciclo_escolar))
        setNivelEscolar(nivel)
        setGradoEscolar(gradoEscolarPorDefecto(nivel, registro.alumno.alumno_grado))
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
        <div className="alumno-form-flujo-nombres">
          <div className="alumno-form-field">
            <label htmlFor="alumno_app" className="alumno-form-label">
              Apellido paterno
            </label>
            <input
              id="alumno_app"
              name="alumno_app"
              type="text"
              className="alumno-form-input"
              value={apellidoPaterno}
              onChange={(e) => setApellidoPaterno(e.target.value)}
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
              value={apellidoMaterno}
              onChange={(e) => setApellidoMaterno(e.target.value)}
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
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="given-name"
            />
          </div>
        </div>

        <div className="alumno-form-flujo alumno-form-flujo--resto">
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
            <label htmlFor="alumno_clave" className="alumno-form-label">
              Clave personal
            </label>
            <input
              id="alumno_clave"
              name="alumno_clave"
              type="text"
              className="alumno-form-input"
              value={clavePersonal}
              onChange={(e) => setClavePersonal(e.target.value)}
              placeholder={detalles ? undefined : 'Sin registro en alumno_detalles'}
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

          <div className="alumno-form-field">
            <label htmlFor="alumno_nivel" className="alumno-form-label">
              Nivel
            </label>
            <select
              id="alumno_nivel"
              name="alumno_nivel"
              className="alumno-form-select"
              value={String(nivelEscolar)}
              onChange={(e) => {
                const nivel = Number(e.target.value)
                setNivelEscolar(nivel)
                setGradoEscolar((gradoActual) =>
                  gradoEscolarPorDefecto(nivel, gradoActual)
                )
              }}
            >
              {NIVELES_ESCOLARES_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="alumno-form-field">
            <label htmlFor="alumno_grado" className="alumno-form-label">
              Grado
            </label>
            <select
              id="alumno_grado"
              name="alumno_grado"
              className="alumno-form-select"
              value={String(gradoEscolar)}
              onChange={(e) => setGradoEscolar(Number(e.target.value))}
              disabled={opcionesGrado.length === 0}
            >
              {opcionesGrado.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>
    </form>
  )
}
