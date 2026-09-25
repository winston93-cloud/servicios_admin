'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'

type FiltroHistorial = 'todos' | 'familiar' | 'comunicados' | 'autorizados' | 'emergencia'

interface EventoHistorial {
  id: number
  created_at: string
  actor_tipo: string
  actor_label: string
  accion: string
  resumen: string
}

interface AlumnoHistorialContactosProps {
  alumno: AlumnoBusquedaResultado
}

const FILTROS: { id: FiltroHistorial; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'familiar', label: 'Familiares' },
  { id: 'comunicados', label: 'Comunicados' },
  { id: 'autorizados', label: 'Quién recoge' },
  { id: 'emergencia', label: 'Emergencia' },
]

function formatearFecha(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

/** 2026-09-25: timeline solo lectura — altas/cambios de contactos y quién recoge. */
export default function AlumnoHistorialContactos({ alumno }: AlumnoHistorialContactosProps) {
  const { cicloSeleccionado } = useCicloEscolar()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [filtro, setFiltro] = useState<FiltroHistorial>('todos')
  const [eventos, setEventos] = useState<EventoHistorial[]>([])

  const cargar = useCallback(
    async (id: number, f: FiltroHistorial) => {
      setCargando(true)
      setError(null)
      try {
        const params = new URLSearchParams({ alumnoId: String(id) })
        if (f !== 'todos') params.set('filtro', f)
        const res = await fetch(`/api/servicios/alumno-contacto-auditoria?${params}`, {
          headers: { ...portalSessionFetchHeaders() },
        })
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          eventos?: EventoHistorial[]
        }
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? 'No se pudo cargar el historial.')
        }
        setEventos(json.eventos ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar historial')
        setEventos([])
      } finally {
        setCargando(false)
      }
    },
    []
  )

  useEffect(() => {
    let activo = true
    setCargando(true)
    obtenerAlumnoPorRef(alumno.alumno_ref, cicloSeleccionado).then((reg) => {
      if (!activo) return
      if (!reg) {
        setError('No se pudo cargar el alumno para este ciclo.')
        setAlumnoId(null)
        setCargando(false)
        return
      }
      setAlumnoId(reg.alumno_id)
      void cargar(reg.alumno_id, filtro)
    })
    return () => {
      activo = false
    }
  }, [alumno.alumno_ref, alumno.alumno_id, cicloSeleccionado, filtro, cargar])

  return (
    <div className="alumno-historial">
      <header className="alumno-historial-cabecera">
        <h3 className="alumno-contactos-titulo">
          <History size={18} aria-hidden /> Historial de contactos
        </h3>
        <p className="alumno-historial-ayuda">
          Altas, cambios de correos informativos y personas autorizadas a recoger al alumno.
          Solo registros desde que se activó el historial.
        </p>
      </header>

      <div className="alumno-historial-filtros" role="tablist" aria-label="Filtrar historial">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filtro === f.id}
            className={`alumno-historial-filtro ${filtro === f.id ? 'alumno-historial-filtro--activo' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="alumno-form-loading">
          <Loader2 size={24} className="alumno-form-loading-icon" aria-hidden />
          <span>Cargando historial…</span>
        </div>
      ) : error ? (
        <p className="alumno-form-error" role="alert">
          {error}
        </p>
      ) : eventos.length === 0 ? (
        <p className="alumno-contactos-vacio">
          {alumnoId == null
            ? 'Sin alumno.'
            : 'Aún no hay eventos en el historial para este alumno.'}
        </p>
      ) : (
        <ol className="alumno-historial-lista">
          {eventos.map((ev) => (
            <li key={ev.id} className="alumno-historial-item">
              <time className="alumno-historial-fecha" dateTime={ev.created_at}>
                {formatearFecha(ev.created_at)}
              </time>
              <div className="alumno-historial-cuerpo">
                <p className="alumno-historial-resumen">{ev.resumen}</p>
                <p className="alumno-historial-meta">
                  <span className="alumno-historial-accion">{ev.accion}</span>
                  {' · '}
                  <span>
                    {ev.actor_tipo}: {ev.actor_label || '—'}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
