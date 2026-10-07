'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarPlus, Check, MapPin, Pencil, Search, Trash2, Users, X } from 'lucide-react'
import {
  CATEGORIAS_TALLER,
  COLORES_TALLER,
  NIVELES_TALLER,
  enMinimo,
  estadoCupo,
  etiquetaCupo,
  textoCupo,
  etiquetaDia,
  etiquetaNivel,
  lugarDeHorario,
  nombreMaestroTaller,
  nombreTallerCompleto,
  resumenHorarios,
  type Taller,
  type TallerAsignacion,
  type TallerMaestro,
} from '@/lib/talleres/talleresTypes'
import { norm, Resaltar } from './busqueda'

type TipoSugerencia = 'Taller' | 'Maestro' | 'Lugar' | 'Categoría' | 'Día'

type Sugerencia = { tipo: TipoSugerencia; valor: string; total: number }

type Fila = {
  a: TallerAsignacion
  t: Taller | undefined
  m: TallerMaestro | undefined
  taller: string
  maestro: string
  lugares: string[]
  categoria: string
  dias: string[]
  texto: string
}

const MAX_SUGERENCIAS = 8

function AlertaMinimo({ inscritos, minimo }: { inscritos: number; minimo: number }) {
  const faltan = minimo - inscritos
  return (
    <p className="tl-alerta-minimo" role="status">
      <AlertTriangle size={16} aria-hidden />
      <span>
        <strong>Taller en mínimo</strong> · {inscritos} de {minimo} inscritos{faltan > 0 ? ` (faltan ${faltan})` : ''}
      </span>
    </p>
  )
}

function CupoGrupo({
  asignacion: a,
  etiqueta,
  taller,
  onGuardar,
}: {
  asignacion: TallerAsignacion
  etiqueta: string | null
  taller: Taller | undefined
  onGuardar: (a: TallerAsignacion, cupoMin: string, cupo: string) => Promise<boolean>
}) {
  const [editando, setEditando] = useState(false)
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [guardando, setGuardando] = useState(false)
  const estado = estadoCupo(a)
  const ajustado =
    (a.cupo ?? null) !== (taller?.cupo_max ?? null) || (a.cupo_min ?? null) !== (taller?.cupo_min ?? null)

  const abrir = () => {
    setMin(a.cupo_min ? String(a.cupo_min) : '')
    setMax(a.cupo ? String(a.cupo) : '')
    setEditando(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    const ok = await onGuardar(a, min, max)
    setGuardando(false)
    if (ok) setEditando(false)
  }

  if (!editando) {
    return (
      <button type="button" className="tl-cupo-chip" data-estado={estado} onClick={abrir} title={`${textoCupo(a)} · clic para cambiar el cupo`}>
        <Users size={13} aria-hidden />
        <span>{a.inscritos} {a.inscritos === 1 ? 'inscrito' : 'inscritos'}</span>
        <span className="tl-cupo-chip-sep">·</span>
        <span>{etiqueta ?? 'Sin cupo, definir'}</span>
        {ajustado && taller && (taller.cupo_max || taller.cupo_min) ? <span className="tl-cupo-chip-tag">ajustado</span> : null}
        <Pencil size={12} aria-hidden />
      </button>
    )
  }

  return (
    <form className="tl-cupo-edit" onSubmit={guardar}>
      <label>
        <span>Mínimo</span>
        <input className="tl-input" type="number" inputMode="numeric" min={1} value={min} autoFocus
          onChange={(e) => setMin(e.target.value)} placeholder={taller?.cupo_min ? String(taller.cupo_min) : '—'} />
      </label>
      <label>
        <span>Máximo</span>
        <input className="tl-input" type="number" inputMode="numeric" min={1} value={max}
          onChange={(e) => setMax(e.target.value)} placeholder={taller?.cupo_max ? String(taller.cupo_max) : '—'} />
      </label>
      <div className="tl-cupo-edit-acciones">
        {taller && (taller.cupo_max || taller.cupo_min) ? (
          <button type="button" className="tl-btn tl-btn-sm" disabled={guardando}
            onClick={() => { setMin(taller.cupo_min ? String(taller.cupo_min) : ''); setMax(taller.cupo_max ? String(taller.cupo_max) : '') }}>
            Usar el del taller
          </button>
        ) : null}
        <button type="button" className="tl-btn tl-btn-sm" onClick={() => setEditando(false)} disabled={guardando}>Cancelar</button>
        <button type="submit" className="tl-btn tl-btn-sm tl-btn-primary" disabled={guardando}>
          <Check size={14} aria-hidden /> {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

function ordenCategoria(c: string): number {
  const i = CATEGORIAS_TALLER.findIndex((x) => norm(x) === norm(c))
  return i === -1 ? CATEGORIAS_TALLER.length : i
}

export default function ProgramadosView({
  talleres,
  maestros,
  asignaciones,
  onNueva,
  onEditar,
  onEliminar,
  onCupo,
}: {
  talleres: Taller[]
  maestros: TallerMaestro[]
  asignaciones: TallerAsignacion[]
  onNueva: () => void
  onEditar: (a: TallerAsignacion) => void
  onEliminar: (a: TallerAsignacion) => void
  onCupo: (a: TallerAsignacion, cupoMin: string, cupo: string) => Promise<boolean>
}) {
  const idLista = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const conteoNivel = useMemo(() => {
    const m = new Map<number, number>()
    for (const n of NIVELES_TALLER) m.set(n.valor, asignaciones.filter((a) => a.niveles.includes(n.valor)).length)
    return m
  }, [asignaciones])
  const nivelInicial = NIVELES_TALLER.find((n) => (conteoNivel.get(n.valor) ?? 0) > 0)?.valor ?? 0
  const [nivelElegido, setNivel] = useState<number | null>(null)
  const nivel = nivelElegido ?? nivelInicial

  const [q, setQ] = useState('')
  const [elegida, setElegida] = useState<Sugerencia | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(-1)

  const filas = useMemo<Fila[]>(() => {
    const tPorId = new Map(talleres.map((t) => [t.id, t]))
    const mPorId = new Map(maestros.map((m) => [m.id, m]))
    return asignaciones
      .filter((a) => !nivel || a.niveles.includes(nivel))
      .map((a) => {
        const t = tPorId.get(a.taller_id)
        const m = mPorId.get(a.maestro_id)
        const taller = t ? nombreTallerCompleto(t) : 'Taller eliminado'
        const maestro = m ? nombreMaestroTaller(m) : 'Maestro eliminado'
        const lugares = [...new Set(a.horarios.map((h) => lugarDeHorario(a, h)).filter((x): x is string => Boolean(x)))]
        const categoria = t?.categoria?.trim() || 'Sin categoría'
        const dias = [...new Set(a.horarios.map((h) => h.dia))].sort((x, y) => x - y).map(etiquetaDia)
        const texto = norm([taller, t?.nombre ?? '', maestro, categoria, ...lugares, ...dias, a.notas ?? ''].join(' '))
        return { a, t, m, taller, maestro, lugares, categoria, dias, texto }
      })
      .sort(
        (x, y) =>
          ordenCategoria(x.categoria) - ordenCategoria(y.categoria) ||
          x.taller.localeCompare(y.taller, 'es', { numeric: true })
      )
  }, [asignaciones, talleres, maestros, nivel])

  const sugerencias = useMemo<Sugerencia[]>(() => {
    const nq = norm(q)
    if (elegida) return []
    const cuenta = new Map<string, Sugerencia>()
    if (!nq) {
      for (const f of filas) {
        for (const [tipo, valor] of [['Taller', f.t?.nombre], ['Maestro', f.maestro]] as const) {
          if (!valor) continue
          const k = `${tipo}|${valor}`
          const s = cuenta.get(k)
          if (s) s.total++
          else cuenta.set(k, { tipo, valor, total: 1 })
        }
      }
      return [...cuenta.values()].sort(
        (a, b) => a.tipo.localeCompare(b.tipo) || a.valor.localeCompare(b.valor, 'es')
      )
    }
    const sumar = (tipo: TipoSugerencia, valor: string) => {
      if (!norm(valor).includes(nq)) return
      const k = `${tipo}|${valor}`
      const s = cuenta.get(k)
      if (s) s.total++
      else cuenta.set(k, { tipo, valor, total: 1 })
    }
    for (const f of filas) {
      if (f.t) sumar('Taller', f.t.nombre)
      sumar('Maestro', f.maestro)
      for (const l of f.lugares) sumar('Lugar', l)
      sumar('Categoría', f.categoria)
      for (const d of f.dias) sumar('Día', d)
    }
    return [...cuenta.values()]
      .sort((a, b) => {
        const ia = norm(a.valor).startsWith(nq) ? 0 : 1
        const ib = norm(b.valor).startsWith(nq) ? 0 : 1
        return ia - ib || b.total - a.total || a.valor.localeCompare(b.valor, 'es')
      })
      .slice(0, MAX_SUGERENCIAS)
  }, [filas, q, elegida])

  const resultado = useMemo(() => {
    if (elegida) {
      const v = elegida.valor
      return filas.filter((f) => {
        switch (elegida.tipo) {
          case 'Taller': return f.t?.nombre === v
          case 'Maestro': return f.maestro === v
          case 'Lugar': return f.lugares.includes(v)
          case 'Categoría': return f.categoria === v
          case 'Día': return f.dias.includes(v)
        }
      })
    }
    const palabras = norm(q).split(/\s+/).filter(Boolean)
    return palabras.length ? filas.filter((f) => palabras.every((p) => f.texto.includes(p))) : filas
  }, [filas, q, elegida])

  const elegir = (s: Sugerencia) => {
    setElegida(s)
    setQ(s.valor)
    setAbierto(false)
    setActiva(-1)
  }

  const limpiar = () => {
    setElegida(null)
    setQ('')
    setActiva(-1)
    inputRef.current?.focus()
  }

  const mostrarLista = abierto && sugerencias.length > 0

  useEffect(() => {
    if (activa >= 0) document.getElementById(`${idLista}-${activa}`)?.scrollIntoView({ block: 'nearest' })
  }, [activa, idLista])
  const secciones = nivel
    ? [nivel]
    : NIVELES_TALLER.map((n) => n.valor).filter((n) => resultado.some((f) => f.a.niveles.includes(n)))
  const resaltado = elegida ? '' : q

  return (
    <section className="tl-panel" aria-label="Talleres programados">
      <div className="tl-toolbar tl-toolbar-semana">
        <div className="tl-chips" role="group" aria-label="Filtrar por nivel">
          {NIVELES_TALLER.map((n) => {
            const total = conteoNivel.get(n.valor) ?? 0
            return (
              <button key={n.valor} type="button" className="tl-chip" data-activo={nivel === n.valor || undefined}
                aria-pressed={nivel === n.valor} disabled={!total} onClick={() => setNivel(n.valor)}>
                {n.etiqueta} <span className="tl-chip-num">{total}</span>
              </button>
            )
          })}
          <button type="button" className="tl-chip" data-activo={!nivel || undefined} aria-pressed={!nivel} onClick={() => setNivel(0)}>
            Todos
          </button>
        </div>
        <button type="button" className="tl-btn tl-btn-primary" onClick={onNueva}>
          <CalendarPlus size={16} aria-hidden /> Programar taller
        </button>
      </div>

      <div className="tl-combo">
        <div className="tl-search">
          <Search size={16} aria-hidden />
          <input
            ref={inputRef}
            className="tl-input"
            role="combobox"
            aria-expanded={mostrarLista}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={mostrarLista && activa >= 0 ? `${idLista}-${activa}` : undefined}
            aria-label="Buscar taller, maestro, lugar, categoría o día"
            placeholder="Buscar taller, maestro, lugar o día…"
            autoComplete="off"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setElegida(null)
              setAbierto(true)
              setActiva(-1)
            }}
            onFocus={() => setAbierto(true)}
            onClick={() => {
              if (q || elegida) {
                setQ('')
                setElegida(null)
              }
              setAbierto(true)
              setActiva(-1)
            }}
            onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && sugerencias.length) {
                e.preventDefault()
                setAbierto(true)
                setActiva((i) => (i + 1) % sugerencias.length)
              } else if (e.key === 'ArrowUp' && sugerencias.length) {
                e.preventDefault()
                setActiva((i) => (i <= 0 ? sugerencias.length - 1 : i - 1))
              } else if (e.key === 'Enter' && mostrarLista && activa >= 0) {
                e.preventDefault()
                elegir(sugerencias[activa])
              } else if (e.key === 'Escape') {
                if (mostrarLista) setAbierto(false)
                else if (q) limpiar()
              }
            }}
          />
          {q ? (
            <button type="button" className="tl-combo-x" onClick={limpiar} aria-label="Limpiar búsqueda">
              <X size={16} aria-hidden />
            </button>
          ) : null}
        </div>
        {mostrarLista ? (
          <ul id={idLista} role="listbox" className="tl-combo-lista" aria-label="Sugerencias">
            {sugerencias.map((s, i) => (
              <li
                key={`${s.tipo}|${s.valor}`}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === activa}
                data-activa={i === activa || undefined}
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(s)
                }}
                onMouseEnter={() => setActiva(i)}
              >
                <span className="tl-combo-tipo">{s.tipo}</span>
                <span className="tl-combo-valor"><Resaltar texto={s.valor} q={q} /></span>
                <span className="tl-combo-total">{s.total}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="tl-combo-estado" aria-live="polite">
        {elegida ? (
          <>
            <span className="tl-combo-filtro">
              {elegida.tipo}: <strong>{elegida.valor}</strong>
              <button type="button" onClick={limpiar} aria-label="Quitar filtro"><X size={13} aria-hidden /></button>
            </span>{' '}
          </>
        ) : null}
        {resultado.length} de {filas.length} {filas.length === 1 ? 'grupo' : 'grupos'}
        {nivel ? ` en ${etiquetaNivel(nivel)}` : ''}
      </p>

      {resultado.length === 0 ? (
        <p className="tl-empty">
          {filas.length ? 'Ningún taller coincide con la búsqueda.' : 'No hay talleres programados en este nivel.'}
        </p>
      ) : (
        secciones.map((n) => {
          const deNivel = resultado.filter((f) => f.a.niveles.includes(n))
          if (!deNivel.length) return null
          return (
            <div key={n} className="tl-nivel">
              {!nivel ? (
                <h3 className="tl-nivel-titulo">
                  {etiquetaNivel(n)} <span>{deNivel.length} {deNivel.length === 1 ? 'grupo' : 'grupos'}</span>
                </h3>
              ) : null}
              <ul className="tl-asig-lista">
                {deNivel.map((f) => {
                  const cupo = etiquetaCupo(f.a)
                  const otros = f.a.niveles.filter((x) => x !== n)
                  const minimo = enMinimo(f.a)
                  return (
                    <li key={f.a.id} className="tl-asig-card" data-minimo={minimo || undefined}
                      style={{ ['--tl-color' as string]: f.t?.color ?? COLORES_TALLER[0] }}>
                      <div className="tl-min0">
                        {minimo ? <AlertaMinimo inscritos={f.a.inscritos} minimo={f.a.cupo_min ?? 0} /> : null}
                        <p className="tl-asig-titulo">
                          <Resaltar texto={f.taller} q={resaltado} />
                          <span className="tl-cat">{f.categoria}</span>
                        </p>
                        <p className="tl-asig-horario">{resumenHorarios(f.a.horarios)}</p>
                        <p className="tl-asig-meta">
                          <span><Resaltar texto={f.maestro} q={resaltado} /></span>
                          {f.lugares.length ? <span><MapPin size={13} aria-hidden /> {f.lugares.join(' / ')}</span> : null}
                        </p>
                        <CupoGrupo asignacion={f.a} etiqueta={cupo} taller={f.t} onGuardar={onCupo} />
                        {otros.length ? <span className="tl-mixto">Con {otros.map(etiquetaNivel).join(' y ')}</span> : null}
                        {f.a.notas ? <p className="tl-horario-nota">{f.a.notas}</p> : null}
                      </div>
                      <div className="tl-acciones">
                        <button type="button" className="tl-icon-btn" aria-label={`Editar ${f.taller}`} onClick={() => onEditar(f.a)}>
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button type="button" className="tl-icon-btn tl-danger" aria-label={`Eliminar ${f.taller}`} onClick={() => onEliminar(f.a)}>
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })
      )}
    </section>
  )
}
