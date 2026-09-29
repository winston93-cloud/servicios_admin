'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CornerDownLeft, Search, X } from 'lucide-react'
import { tramosCoincidencia } from '@/lib/dashboardBusqueda'
import type { DashboardModuleAccent } from '@/components/dashboard/DashboardModuleCard'
import './dashboard-buscador.css'

export type SugerenciaModulo = {
  key: string
  label: string
  desc: string
  kicker?: string
  accent: DashboardModuleAccent
  icon: ReactNode
  external?: boolean
}

const MAX_SUGERENCIAS = 6

export function TextoResaltado({ texto, q }: { texto: string; q: string }) {
  const tramos = tramosCoincidencia(texto, q)
  if (!tramos.length) return <>{texto}</>
  const partes: ReactNode[] = []
  let pos = 0
  for (const [ini, fin] of tramos) {
    if (ini > pos) partes.push(texto.slice(pos, ini))
    partes.push(<mark key={ini}>{texto.slice(ini, fin)}</mark>)
    pos = fin
  }
  if (pos < texto.length) partes.push(texto.slice(pos))
  return <>{partes}</>
}

function esCampoEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export default function DashboardBuscador({
  q,
  onQ,
  sugerencias,
  total,
  coincidencias,
  onAbrir,
}: {
  q: string
  onQ: (q: string) => void
  /** Ya ordenadas por relevancia. */
  sugerencias: SugerenciaModulo[]
  total: number
  coincidencias: number
  onAbrir: (key: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listaId = useId()
  const [abierta, setAbierta] = useState(false)
  const [activa, setActiva] = useState(0)
  const [esMac, setEsMac] = useState(false)

  const lista = sugerencias.slice(0, MAX_SUGERENCIAS)
  const buscando = q.trim().length > 0
  const mostrarLista = abierta && buscando && lista.length > 0

  useEffect(() => {
    setEsMac(/Mac|iPhone|iPad/.test(navigator.platform))
    const atajo = (e: globalThis.KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((k === 'k' && (e.metaKey || e.ctrlKey)) || (k === '/' && !esCampoEditable(e.target))) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [])

  useEffect(() => {
    setActiva(0)
  }, [q])

  const abrir = (key: string) => {
    setAbierta(false)
    onAbrir(key)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAbierta(true)
      setActiva((i) => (lista.length ? (i + 1) % lista.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiva((i) => (lista.length ? (i - 1 + lista.length) % lista.length : 0))
    } else if (e.key === 'Enter') {
      const s = lista[activa] ?? lista[0]
      if (s && buscando) {
        e.preventDefault()
        abrir(s.key)
      }
    } else if (e.key === 'Escape') {
      if (mostrarLista) setAbierta(false)
      else if (q) onQ('')
      else inputRef.current?.blur()
    }
  }

  return (
    <div className="dash-buscador" data-buscando={buscando || undefined}>
      <div className="dash-buscador-campo">
        <Search size={18} strokeWidth={2.25} className="dash-buscador-lupa" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={mostrarLista ? `${listaId}-${activa}` : undefined}
          aria-label="Buscar módulo"
          placeholder="Buscar módulo, sistema o función…"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => {
            onQ(e.target.value)
            setAbierta(true)
          }}
          onFocus={() => setAbierta(true)}
          onBlur={() => setAbierta(false)}
          onKeyDown={onKeyDown}
        />
        {q ? (
          <button
            type="button"
            className="dash-buscador-limpiar"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onQ('')
              inputRef.current?.focus()
            }}
            aria-label="Limpiar búsqueda"
          >
            <X size={16} strokeWidth={2.5} aria-hidden />
          </button>
        ) : (
          <kbd className="dash-buscador-atajo" aria-hidden>
            {esMac ? '⌘' : 'Ctrl'} K
          </kbd>
        )}
      </div>

      {mostrarLista ? (
        <ul className="dash-buscador-lista" id={listaId} role="listbox" aria-label="Módulos sugeridos">
          {lista.map((s, i) => (
            <li
              key={s.key}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={i === activa}
              className="dash-buscador-opcion"
              data-accent={s.accent}
              data-activa={i === activa || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiva(i)}
              onClick={() => abrir(s.key)}
            >
              <span className="dash-buscador-icono" aria-hidden>{s.icon}</span>
              <span className="dash-buscador-texto">
                <span className="dash-buscador-titulo">
                  <TextoResaltado texto={s.label} q={q} />
                  {s.external ? <span className="dash-buscador-externo">Externo</span> : null}
                </span>
                <span className="dash-buscador-desc">
                  {s.kicker ? <span className="dash-buscador-kicker">{s.kicker}</span> : null}
                  <TextoResaltado texto={s.desc} q={q} />
                </span>
              </span>
              <CornerDownLeft size={16} className="dash-buscador-enter" aria-hidden />
            </li>
          ))}
          <li className="dash-buscador-pie" role="presentation" aria-hidden>
            <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
            <span><kbd>Enter</kbd> abrir</span>
            <span><kbd>Esc</kbd> cerrar</span>
          </li>
        </ul>
      ) : null}

      <p className="dash-buscador-estado" role="status" aria-live="polite">
        {buscando
          ? coincidencias
            ? `${coincidencias} de ${total} ${total === 1 ? 'módulo' : 'módulos'}`
            : 'Sin coincidencias'
          : ''}
      </p>
    </div>
  )
}
