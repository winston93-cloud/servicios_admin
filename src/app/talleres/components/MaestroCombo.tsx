'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import {
  etiquetaNivel,
  nombreMaestroTaller,
  type Taller,
  type TallerAsignacion,
  type TallerMaestro,
} from '@/lib/talleres/talleresTypes'
import { norm, Resaltar } from './busqueda'

export type MaestroOpcion = {
  maestro: TallerMaestro
  nombre: string
  niveles: number[]
  talleres: string[]
  grupos: number
  texto: string
}

/** Maestros con grupos en `asignaciones`, con niveles y talleres que dan. */
export function opcionesMaestros(
  maestros: TallerMaestro[],
  talleres: Taller[],
  asignaciones: TallerAsignacion[]
): MaestroOpcion[] {
  const tPorId = new Map(talleres.map((t) => [t.id, t]))
  const out: MaestroOpcion[] = []
  for (const m of maestros) {
    const suyas = asignaciones.filter((a) => a.maestro_id === m.id)
    if (!suyas.length) continue
    const niveles = [...new Set(suyas.flatMap((a) => a.niveles))].sort((a, b) => a - b)
    const nombresTaller = [
      ...new Set(suyas.map((a) => tPorId.get(a.taller_id)?.nombre).filter((x): x is string => Boolean(x))),
    ].sort((a, b) => a.localeCompare(b, 'es'))
    const nombre = nombreMaestroTaller(m)
    out.push({
      maestro: m,
      nombre,
      niveles,
      talleres: nombresTaller,
      grupos: suyas.length,
      texto: norm([nombre, ...nombresTaller, ...niveles.map(etiquetaNivel), m.especialidad ?? ''].join(' ')),
    })
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** IDs de maestros cuyo nombre, taller o nivel contiene todas las palabras de `q`. */
export function maestrosQueCoinciden(opciones: MaestroOpcion[], q: string): Set<number> | null {
  const palabras = norm(q).split(/\s+/).filter(Boolean)
  if (!palabras.length) return null
  return new Set(opciones.filter((o) => palabras.every((p) => o.texto.includes(p))).map((o) => o.maestro.id))
}

export default function MaestroCombo({
  opciones,
  q,
  elegidoId,
  onQ,
  onElegir,
}: {
  opciones: MaestroOpcion[]
  q: string
  elegidoId: number
  onQ: (q: string) => void
  onElegir: (id: number, nombre: string) => void
}) {
  const idLista = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(-1)

  const sugerencias = useMemo(() => {
    if (elegidoId) return []
    const ids = maestrosQueCoinciden(opciones, q)
    const lista = ids ? opciones.filter((o) => ids.has(o.maestro.id)) : opciones
    const nq = norm(q)
    return [...lista].sort((a, b) => {
      const ia = nq && norm(a.nombre).includes(nq) ? 0 : 1
      const ib = nq && norm(b.nombre).includes(nq) ? 0 : 1
      return ia - ib || a.nombre.localeCompare(b.nombre, 'es')
    })
  }, [opciones, q, elegidoId])

  const mostrar = abierto && sugerencias.length > 0

  const elegir = (o: MaestroOpcion) => {
    onElegir(o.maestro.id, o.nombre)
    setAbierto(false)
    setActiva(-1)
  }

  const limpiar = () => {
    onQ('')
    setActiva(-1)
    inputRef.current?.focus()
  }

  return (
    <div className="tl-combo tl-combo-maestro">
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
          aria-label="Buscar maestro por nombre, taller o nivel"
          placeholder="Buscar maestro, taller o nivel…"
          autoComplete="off"
          value={q}
          data-elegido={elegidoId ? true : undefined}
          onChange={(e) => {
            onQ(e.target.value)
            setAbierto(true)
            setActiva(-1)
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && sugerencias.length) {
              e.preventDefault()
              setAbierto(true)
              setActiva((i) => (i + 1) % sugerencias.length)
            } else if (e.key === 'ArrowUp' && sugerencias.length) {
              e.preventDefault()
              setActiva((i) => (i <= 0 ? sugerencias.length - 1 : i - 1))
            } else if (e.key === 'Enter' && mostrar) {
              e.preventDefault()
              elegir(sugerencias[activa >= 0 ? activa : 0])
            } else if (e.key === 'Escape') {
              if (mostrar) setAbierto(false)
              else if (q) limpiar()
            }
          }}
        />
        {q ? (
          <button type="button" className="tl-combo-x" onClick={limpiar} aria-label="Limpiar maestro">
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>
      {mostrar ? (
        <ul id={idLista} role="listbox" className="tl-combo-lista tl-combo-lista-maestro" aria-label="Maestros">
          {sugerencias.map((o, i) => (
            <li
              key={o.maestro.id}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activa}
              data-activa={i === activa || undefined}
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(o)
              }}
              onMouseEnter={() => setActiva(i)}
            >
              <span className="tl-combo-maestro-info">
                <span className="tl-combo-valor"><Resaltar texto={o.nombre} q={q} /></span>
                <span className="tl-combo-desc">
                  <span className="tl-combo-niveles">{o.niveles.map(etiquetaNivel).join(' · ')}</span>
                  <span className="tl-combo-talleres">
                    {o.talleres.map((t, k) => (
                      <span key={t}>
                        {k ? ', ' : ''}
                        <Resaltar texto={t} q={q} />
                      </span>
                    ))}
                  </span>
                </span>
              </span>
              <span className="tl-combo-total" title="Grupos">{o.grupos}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
