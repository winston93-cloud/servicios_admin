'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  History,
  Loader2,
  Mail,
  MailX,
  Pencil,
  PhoneCall,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import type {
  CategoriaHistorial,
  VistaEventoHistorial,
} from '@/lib/alumnoContactoHistorialVista'

/**
 * 2026-10-02: rediseño del Historial de contactos para que se entienda sin capacitación:
 * - Filtros por tipo de persona con contador.
 * - Cambios agrupados por día, con "antes → ahora" y quién lo hizo.
 * - La foto inicial (baseline) se muestra como lista de contactos, no como eventos.
 */

type Filtro = 'todos' | 'padres' | 'recoge' | 'emergencia'

const FILTROS: { id: Filtro; label: string; icon: LucideIcon }[] = [
  { id: 'todos', label: 'Todos', icon: History },
  { id: 'padres', label: 'Familia', icon: Users },
  { id: 'recoge', label: 'Pueden recoger', icon: ShieldCheck },
  { id: 'emergencia', label: 'Emergencia', icon: PhoneCall },
]

const GRUPO_DE_CATEGORIA: Record<CategoriaHistorial, Exclude<Filtro, 'todos'>> = {
  mama: 'padres',
  papa: 'padres',
  familiar: 'padres',
  recoge: 'recoge',
  emergencia: 'emergencia',
}

const ETIQUETA_CATEGORIA: Record<CategoriaHistorial, string> = {
  mama: 'Mamá',
  papa: 'Papá',
  familiar: 'Otro familiar',
  recoge: 'Puede recoger',
  emergencia: 'Emergencia',
}

const ORDEN_CATEGORIA: CategoriaHistorial[] = ['mama', 'papa', 'familiar', 'recoge', 'emergencia']

interface EventoApi {
  id: number
  vista: VistaEventoHistorial
}

interface AlumnoHistorialContactosProps {
  alumno: AlumnoBusquedaResultado
}

function claveDia(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function etiquetaDia(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(hoy.getDate() - 1)
  if (claveDia(iso) === claveDia(hoy.toISOString())) return 'Hoy'
  if (claveDia(iso) === claveDia(ayer.toISOString())) return 'Ayer'
  const txt = d.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
}

function accionVisible(v: VistaEventoHistorial): { texto: string; icon: LucideIcon; tono: string } {
  switch (v.tipo) {
    case 'agregado':
      return { texto: 'Se agregó', icon: Plus, tono: 'verde' }
    case 'quitado':
      return { texto: 'Se quitó', icon: Trash2, tono: 'rojo' }
    case 'comunicados':
      return v.recibeComunicados
        ? { texto: 'Ahora recibe comunicados', icon: Mail, tono: 'azul' }
        : { texto: 'Ya no recibe comunicados', icon: MailX, tono: 'rojo' }
    default:
      return { texto: 'Se modificó', icon: Pencil, tono: 'ambar' }
  }
}

function EventoCambio({ v }: { v: VistaEventoHistorial }) {
  const accion = accionVisible(v)
  const Icono = accion.icon
  const mostrarParentesco =
    v.parentesco && v.parentesco.toLowerCase() !== ETIQUETA_CATEGORIA[v.categoria].toLowerCase()

  return (
    <li className={`ahc-evento ahc-tono-${accion.tono}`}>
      <span className="ahc-evento-icono" aria-hidden>
        <Icono size={16} />
      </span>
      <div className="ahc-evento-cuerpo">
        <p className="ahc-evento-titulo">
          <span className="ahc-evento-accion">{accion.texto}</span>
          <strong className="ahc-evento-persona">{v.persona}</strong>
        </p>
        <p className="ahc-evento-etiquetas">
          <span className={`ahc-chip ahc-chip--${GRUPO_DE_CATEGORIA[v.categoria]}`}>
            {ETIQUETA_CATEGORIA[v.categoria]}
          </span>
          {mostrarParentesco ? <span className="ahc-chip">{v.parentesco}</span> : null}
        </p>

        {v.cambios.length > 0 ? (
          <dl className="ahc-cambios">
            {v.cambios.map((c) => (
              <div key={c.campo} className="ahc-cambio">
                <dt>{c.campo}</dt>
                <dd>
                  <span className="ahc-antes">{c.antes || 'Vacío'}</span>
                  <ArrowRight size={14} aria-label="cambió a" />
                  <span className="ahc-despues">{c.despues || 'Vacío'}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div className="ahc-evento-quien">
        <time dateTime={v.fecha}>{hora(v.fecha)}</time>
        {v.hechoPor ? <span>{v.hechoPor}</span> : null}
      </div>
    </li>
  )
}

function ContactosIniciales({
  eventos,
  abiertoPorDefecto,
}: {
  eventos: VistaEventoHistorial[]
  abiertoPorDefecto: boolean
}) {
  const fecha = eventos[0]?.fecha
  const porCategoria = ORDEN_CATEGORIA.map((cat) => ({
    cat,
    personas: eventos.filter((e) => e.categoria === cat),
  })).filter((g) => g.personas.length > 0)

  return (
    <details className="ahc-inicial" open={abiertoPorDefecto}>
      <summary className="ahc-inicial-resumen">
        <span>
          Contactos registrados al {fecha ? fechaCorta(fecha) : '—'}
          <span className="ahc-contador">{eventos.length}</span>
        </span>
        <ChevronDown size={18} className="ahc-inicial-flecha" aria-hidden />
      </summary>
      <div className="ahc-inicial-grupos">
        {porCategoria.map(({ cat, personas }) => (
          <section key={cat} className="ahc-inicial-grupo">
            <h5 className={`ahc-chip ahc-chip--${GRUPO_DE_CATEGORIA[cat]}`}>
              {ETIQUETA_CATEGORIA[cat]}
            </h5>
            <ul>
              {personas.map((p) => (
                <li key={p.id} className="ahc-persona">
                  <span className="ahc-persona-nombre">{p.persona}</span>
                  <span className="ahc-persona-datos">
                    {[cat === 'recoge' || cat === 'emergencia' ? p.parentesco : '', p.telefono]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  )
}

export default function AlumnoHistorialContactos({ alumno }: AlumnoHistorialContactosProps) {
  const { cicloSeleccionado } = useCicloEscolar()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [eventos, setEventos] = useState<VistaEventoHistorial[]>([])

  const cargar = useCallback(async (id: number) => {
    setCargando(true)
    setError(null)
    try {
      const params = new URLSearchParams({ alumnoId: String(id) })
      const res = await fetch(`/api/servicios/alumno-contacto-auditoria?${params}`, {
        headers: { ...portalSessionFetchHeaders() },
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        eventos?: EventoApi[]
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'No se pudo cargar el historial.')
      }
      setEventos((json.eventos ?? []).map((e) => e.vista).filter(Boolean))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar historial')
      setEventos([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let activo = true
    setCargando(true)
    obtenerAlumnoPorRef(alumno.alumno_ref, cicloSeleccionado).then((reg) => {
      if (!activo) return
      if (!reg) {
        setError('No se pudo cargar el alumno para este ciclo.')
        setCargando(false)
        return
      }
      void cargar(reg.alumno_id)
    })
    return () => {
      activo = false
    }
  }, [alumno.alumno_ref, cicloSeleccionado, cargar])

  const conteo = useMemo(() => {
    const c: Record<Filtro, number> = { todos: 0, padres: 0, recoge: 0, emergencia: 0 }
    for (const e of eventos) {
      c.todos += 1
      c[GRUPO_DE_CATEGORIA[e.categoria]] += 1
    }
    return c
  }, [eventos])

  const visibles = useMemo(
    () =>
      filtro === 'todos'
        ? eventos
        : eventos.filter((e) => GRUPO_DE_CATEGORIA[e.categoria] === filtro),
    [eventos, filtro]
  )

  const cambios = visibles.filter((e) => e.tipo !== 'inicial')
  const iniciales = visibles.filter((e) => e.tipo === 'inicial')

  const cambiosPorDia = useMemo(() => {
    const grupos: { clave: string; etiqueta: string; items: VistaEventoHistorial[] }[] = []
    for (const e of cambios) {
      const clave = claveDia(e.fecha)
      const ultimo = grupos[grupos.length - 1]
      if (ultimo && ultimo.clave === clave) ultimo.items.push(e)
      else grupos.push({ clave, etiqueta: etiquetaDia(e.fecha), items: [e] })
    }
    return grupos
  }, [cambios])

  const fechaInicio = eventos.find((e) => e.tipo === 'inicial')?.fecha

  return (
    <div className="ahc">
      <h3 className="alumno-contactos-titulo ahc-titulo">
        <History size={18} aria-hidden /> Historial de contactos
      </h3>

      <div className="ahc-filtros" role="tablist" aria-label="Filtrar historial">
        {FILTROS.map((f) => {
          const Icono = f.icon
          const activo = filtro === f.id
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={activo}
              className={`ahc-filtro ${activo ? 'ahc-filtro--activo' : ''}`}
              onClick={() => setFiltro(f.id)}
            >
              <Icono size={15} aria-hidden />
              {f.label}
              <span className="ahc-contador">{conteo[f.id]}</span>
            </button>
          )
        })}
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
      ) : visibles.length === 0 ? (
        <p className="ahc-vacio">No hay contactos registrados.</p>
      ) : (
        <>
          <section className="ahc-seccion" aria-label="Cambios">
            <h4 className="ahc-seccion-titulo">Cambios</h4>
            {cambiosPorDia.length === 0 ? (
              <p className="ahc-vacio">
                Sin cambios{fechaInicio ? ` desde el ${fechaCorta(fechaInicio)}` : ''}.
              </p>
            ) : (
              cambiosPorDia.map((g) => (
                <div key={g.clave} className="ahc-dia">
                  <p className="ahc-dia-titulo">{g.etiqueta}</p>
                  <ol className="ahc-lista">
                    {g.items.map((v) => (
                      <EventoCambio key={v.id} v={v} />
                    ))}
                  </ol>
                </div>
              ))
            )}
          </section>

          {iniciales.length > 0 ? (
            <ContactosIniciales
              key={`${filtro}-${cambiosPorDia.length === 0}`}
              eventos={iniciales}
              abiertoPorDefecto={cambiosPorDia.length === 0}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
