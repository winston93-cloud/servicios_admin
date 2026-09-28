'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import { etiquetaGradoAlumno, etiquetaNivel, type AlumnoBusquedaTaller } from '@/lib/talleres/talleresTypes'
import { Resaltar } from '../busqueda'

export type EvaluacionAlumno = {
  /** bloqueado: no se puede elegir (ya inscrito, choque de horario). */
  bloqueado?: string
  avisos?: string[]
  info?: ReactNode
}

const DEBOUNCE_MS = 220

export default function AlumnoBuscador({
  niveles,
  placeholder,
  evaluar,
  onElegir,
  etiquetaAccion = 'Inscribir',
  autoFocus,
}: {
  niveles: number[]
  placeholder: string
  evaluar?: (a: AlumnoBusquedaTaller) => EvaluacionAlumno
  onElegir: (a: AlumnoBusquedaTaller) => void
  etiquetaAccion?: string
  autoFocus?: boolean
}) {
  const idLista = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<AlumnoBusquedaTaller[]>([])
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(-1)
  const clave = niveles.join(',')

  useEffect(() => {
    const limpia = q.trim()
    if (limpia.length < 2) {
      setResultados([])
      setCargando(false)
      return
    }
    const ctrl = new AbortController()
    setCargando(true)
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/talleres/inscripciones?q=${encodeURIComponent(limpia)}&niveles=${clave}`,
          { headers: portalSessionFetchHeaders(), signal: ctrl.signal, cache: 'no-store' }
        )
        const json = await res.json()
        if (!ctrl.signal.aborted) {
          setResultados(res.ok ? ((json.alumnos ?? []) as AlumnoBusquedaTaller[]) : [])
          setActiva(-1)
        }
      } catch {
        if (!ctrl.signal.aborted) setResultados([])
      } finally {
        if (!ctrl.signal.aborted) setCargando(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [q, clave])

  useEffect(() => {
    if (activa >= 0) document.getElementById(`${idLista}-${activa}`)?.scrollIntoView({ block: 'nearest' })
  }, [activa, idLista])

  const evaluados = resultados.map((a) => ({ a, ev: evaluar?.(a) ?? {} }))
  const mostrar = abierto && q.trim().length >= 2

  const elegir = (i: number) => {
    const item = evaluados[i]
    if (!item || item.ev.bloqueado) return
    onElegir(item.a)
    setQ('')
    setResultados([])
    setAbierto(false)
    setActiva(-1)
  }

  const mover = (delta: number) => {
    if (!evaluados.length) return
    setAbierto(true)
    setActiva((i) => {
      let n = i
      for (let k = 0; k < evaluados.length; k++) {
        n = (n + delta + evaluados.length) % evaluados.length
        if (!evaluados[n].ev.bloqueado) return n
      }
      return i
    })
  }

  return (
    <div className="tl-combo tl-alumno-buscador">
      <div className="tl-search">
        <Search size={16} aria-hidden />
        <input
          ref={inputRef}
          className="tl-input"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={mostrar && activa >= 0 ? `${idLista}-${activa}` : undefined}
          aria-label={placeholder}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          onClick={() => {
            if (q) setQ('')
            setAbierto(true)
          }}
          onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              mover(1)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              mover(-1)
            } else if (e.key === 'Enter' && mostrar) {
              e.preventDefault()
              const i = activa >= 0 ? activa : evaluados.findIndex((x) => !x.ev.bloqueado)
              if (i >= 0) elegir(i)
            } else if (e.key === 'Escape') {
              if (mostrar) setAbierto(false)
              else if (q) setQ('')
            }
          }}
        />
        {cargando ? <Loader2 size={16} className="tl-spin tl-combo-cargando" aria-hidden /> : null}
        {q && !cargando ? (
          <button type="button" className="tl-combo-x" onClick={() => { setQ(''); inputRef.current?.focus() }} aria-label="Limpiar">
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>
      {mostrar ? (
        <ul id={idLista} role="listbox" className="tl-combo-lista tl-alumno-lista" aria-label="Alumnos">
          {!cargando && evaluados.length === 0 ? (
            <li className="tl-combo-vacio" role="presentation">
              Sin coincidencias{niveles.length ? ` en ${niveles.map(etiquetaNivel).join(' y ')}` : ''}.
            </li>
          ) : null}
          {evaluados.map(({ a, ev }, i) => (
            <li
              key={a.alumno_id}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activa}
              aria-disabled={ev.bloqueado ? true : undefined}
              data-activa={i === activa || undefined}
              data-bloqueado={ev.bloqueado ? true : undefined}
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(i)
              }}
              onMouseEnter={() => !ev.bloqueado && setActiva(i)}
            >
              <span className="tl-alumno-sug">
                <span className="tl-combo-valor"><Resaltar texto={a.nombre} q={q} /></span>
                <span className="tl-alumno-sug-meta">
                  {a.alumno_ref ? <span>No. <Resaltar texto={String(a.alumno_ref)} q={q} /></span> : null}
                  <span className="tl-alumno-grado">{etiquetaGradoAlumno(a)}</span>
                  <span>{etiquetaNivel(a.nivel)}</span>
                </span>
                {ev.info ? <span className="tl-alumno-sug-info">{ev.info}</span> : null}
                {ev.bloqueado ? <span className="tl-alumno-sug-bloq">{ev.bloqueado}</span> : null}
                {ev.avisos?.map((m) => (
                  <span key={m} className="tl-alumno-sug-aviso">{m}</span>
                ))}
              </span>
              {!ev.bloqueado ? (
                <span className="tl-alumno-sug-accion"><UserPlus size={14} aria-hidden /> {etiquetaAccion}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
