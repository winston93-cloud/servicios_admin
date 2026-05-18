'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  construirNombreCompleto,
  type AlumnoBusquedaResultado,
} from '@/lib/alumnoBusquedaServicios'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'

const STORAGE_KEY = 'servicios-alumno-ref'

interface AlumnoSeleccionadoContextValue {
  alumnoSeleccionado: AlumnoBusquedaResultado | null
  setAlumnoSeleccionado: (alumno: AlumnoBusquedaResultado | null) => void
  resolviendoCiclo: boolean
}

const AlumnoSeleccionadoContext = createContext<AlumnoSeleccionadoContextValue | null>(null)

function alumnoDesdeRegistro(
  canon: NonNullable<Awaited<ReturnType<typeof obtenerAlumnoPorRef>>>,
  prev?: AlumnoBusquedaResultado | null
): AlumnoBusquedaResultado {
  const nombre = canon.alumno_nombre ?? ''
  const app = canon.alumno_app ?? ''
  const apm = canon.alumno_apm ?? ''
  return {
    alumno_id: canon.alumno_id,
    alumno_ref: String(canon.alumno_ref),
    alumno_nombre: nombre,
    alumno_app: app,
    alumno_apm: apm,
    alumno_nivel: canon.alumno_nivel,
    alumno_grado: canon.alumno_grado != null ? String(canon.alumno_grado) : null,
    alumno_grupo: canon.alumno_grupo != null ? String(canon.alumno_grupo) : null,
    alumno_ciclo_escolar: canon.alumno_ciclo_escolar,
    alumno_status: canon.alumno_status,
    nombre_completo: construirNombreCompleto(nombre, app, apm),
    puntuacion: prev?.puntuacion ?? 0,
    campos_coincidentes: prev?.campos_coincidentes ?? ['nombre'],
  }
}

function refPersistido(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || null
  } catch {
    return null
  }
}

export function AlumnoSeleccionadoProvider({ children }: { children: ReactNode }) {
  const { cicloSeleccionado, cargando: cargandoCiclos } = useCicloEscolar()
  const [alumnoSeleccionado, setAlumnoSeleccionadoState] =
    useState<AlumnoBusquedaResultado | null>(null)
  const [resolviendoCiclo, setResolviendoCiclo] = useState(false)
  const refActivoRef = useRef<string | null>(null)

  const setAlumnoSeleccionado = useCallback((alumno: AlumnoBusquedaResultado | null) => {
    setAlumnoSeleccionadoState(alumno)
    const ref = alumno?.alumno_ref?.trim() || null
    refActivoRef.current = ref
    try {
      if (ref) sessionStorage.setItem(STORAGE_KEY, ref)
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (cargandoCiclos) return

    const ref =
      alumnoSeleccionado?.alumno_ref?.trim() || refActivoRef.current || refPersistido()

    if (!ref) {
      setAlumnoSeleccionadoState(null)
      return
    }

    refActivoRef.current = ref
    let cancelado = false
    setResolviendoCiclo(true)

    obtenerAlumnoPorRef(ref, cicloSeleccionado).then((canon) => {
      if (cancelado) return
      if (!canon) {
        setAlumnoSeleccionadoState(null)
      } else {
        setAlumnoSeleccionadoState((prev) => alumnoDesdeRegistro(canon, prev))
      }
      setResolviendoCiclo(false)
    })

    return () => {
      cancelado = true
    }
  }, [cicloSeleccionado, cargandoCiclos])

  const value = useMemo(
    () => ({
      alumnoSeleccionado,
      setAlumnoSeleccionado,
      resolviendoCiclo,
    }),
    [alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo]
  )

  return (
    <AlumnoSeleccionadoContext.Provider value={value}>
      {children}
    </AlumnoSeleccionadoContext.Provider>
  )
}

export function useAlumnoSeleccionado(): AlumnoSeleccionadoContextValue {
  const ctx = useContext(AlumnoSeleccionadoContext)
  if (!ctx) {
    throw new Error('useAlumnoSeleccionado debe usarse dentro de AlumnoSeleccionadoProvider')
  }
  return ctx
}
