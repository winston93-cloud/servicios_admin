'use client'

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { posApi } from '@/lib/pos/posApi'
import { etiquetaCliente, type PosCliente } from '@/lib/pos/posTipos'

export type ClienteBuscadorRef = { focus: () => void }

const TIPO_ETIQUETA = { alumno: 'Alumno', maestro: 'Docente', externo: 'Externo' } as const

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

const ClienteBuscador = forwardRef<ClienteBuscadorRef, { onSeleccion: (c: PosCliente) => void }>(
  function ClienteBuscador({ onSeleccion }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)
    const listId = useId()
    const [q, setQ] = useState('')
    const [resultados, setResultados] = useState<PosCliente[]>([])
    const [cargando, setCargando] = useState(false)
    const [abierto, setAbierto] = useState(false)
    const [activo, setActivo] = useState(0)
    const [error, setError] = useState('')

    useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))

    useEffect(() => {
      const limpia = q.trim()
      if (limpia.length < 2) {
        setResultados([])
        setCargando(false)
        return
      }
      const ctrl = new AbortController()
      setCargando(true)
      const t = setTimeout(async () => {
        try {
          const r = await posApi.buscar(limpia, ctrl.signal)
          setResultados(r)
          setActivo(0)
          setAbierto(true)
          setError('')
        } catch (e) {
          if ((e as Error).name !== 'AbortError') setError('No se pudo buscar. Revisa la conexión.')
        } finally {
          if (!ctrl.signal.aborted) setCargando(false)
        }
      }, 220)
      return () => {
        clearTimeout(t)
        ctrl.abort()
      }
    }, [q])

    const elegir = (c: PosCliente) => {
      onSeleccion(c)
      setQ('')
      setResultados([])
      setAbierto(false)
    }

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAbierto(true)
        setActivo((i) => Math.min(i + 1, resultados.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActivo((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && resultados[activo]) {
        e.preventDefault()
        elegir(resultados[activo])
      } else if (e.key === 'Escape') {
        setAbierto(false)
      }
    }

    const mostrarLista = abierto && q.trim().length >= 2 && !cargando

    return (
      <div className="cj-search">
        <div className="cj-input-wrap">
          <Search size={18} className="cj-input-icon" aria-hidden />
          <input
            ref={inputRef}
            className="cj-input cj-input--lg"
            placeholder="Nombre, apellido o número de control…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setAbierto(true)
            }}
            onKeyDown={onKey}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
            role="combobox"
            aria-expanded={mostrarLista}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={mostrarLista && resultados[activo] ? `${listId}-${activo}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {cargando ? (
            <Loader2 size={18} className="cj-input-trail cj-spin" aria-label="Buscando" />
          ) : q ? (
            <button type="button" className="cj-input-trail cj-input-clear" onClick={() => setQ('')} aria-label="Limpiar búsqueda">
              <X size={16} />
            </button>
          ) : (
            <kbd className="cj-input-trail cj-kbd">F2</kbd>
          )}
        </div>

        {error ? <p className="cj-field-error">{error}</p> : null}

        {mostrarLista ? (
          <ul className="cj-results" id={listId} role="listbox">
            {resultados.length === 0 ? (
              <li className="cj-results-empty">Sin coincidencias para «{q.trim()}»</li>
            ) : (
              resultados.map((c, i) => (
                <li
                  key={`${c.tipo}-${c.ref}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activo}
                  className={`cj-result${i === activo ? ' is-active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    elegir(c)
                  }}
                  onMouseEnter={() => setActivo(i)}
                >
                  <span className={`cj-avatar cj-avatar--${c.tipo}`} aria-hidden>
                    {iniciales(c.nombre)}
                  </span>
                  <span className="cj-result-main">
                    <span className="cj-result-name">{c.nombre}</span>
                    <span className="cj-result-meta">
                      {etiquetaCliente(c)}
                      {c.tipo === 'alumno' ? ` · Ref. ${c.ref}` : ''}
                    </span>
                  </span>
                  <span className={`cj-badge cj-badge--${c.tipo}`}>{TIPO_ETIQUETA[c.tipo]}</span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    )
  }
)

export default ClienteBuscador
