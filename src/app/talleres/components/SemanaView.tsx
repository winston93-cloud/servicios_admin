'use client'

import { Fragment, useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus, MapPin, Pencil, Table2, Trash2, Users } from 'lucide-react'
import {
  CATEGORIAS_TALLER,
  COLORES_TALLER,
  DIAS_TALLER,
  NIVELES_TALLER,
  etiquetaCupo,
  etiquetaNivel,
  hora12,
  lugarDeHorario,
  minutosDeHora,
  nombreMaestroTaller,
  nombreTallerCompleto,
  type Taller,
  type TallerAsignacion,
  type TallerMaestro,
} from '@/lib/talleres/talleresTypes'
import MaestroCombo, { maestrosQueCoinciden, opcionesMaestros } from './MaestroCombo'

const PX_HORA = 84
const ANCHO_CARRIL = 150
const ANCHO_DIA_MIN = 180

type Vista = 'tabla' | 'calendario'

type Bloque = {
  asignacion: TallerAsignacion
  taller: Taller | undefined
  maestro: TallerMaestro | undefined
  dia: number
  ini: number
  fin: number
  lugar: string | null
  carril: number
  carriles: number
}

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** "3:00 – 4:00 PM"; si cambia AM/PM, ambos sufijos. */
function rango12(ini: string, fin: string): string {
  const a = hora12(ini)
  const b = hora12(fin)
  const sufA = a.slice(-2)
  return sufA === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`
}

/** Reparte bloques encimados del mismo día en carriles lado a lado. */
function acomodarCarriles(bloques: Omit<Bloque, 'carril' | 'carriles'>[]): Bloque[] {
  const orden = [...bloques].sort((a, b) => a.ini - b.ini || a.fin - b.fin)
  const out: Bloque[] = []
  let grupo: Bloque[] = []
  let finGrupo = -1
  const cerrar = () => {
    const n = Math.max(1, ...grupo.map((b) => b.carril + 1))
    for (const b of grupo) b.carriles = n
    out.push(...grupo)
    grupo = []
  }
  for (const b of orden) {
    if (grupo.length && b.ini >= finGrupo) cerrar()
    const ocupados = new Set(grupo.filter((g) => g.fin > b.ini).map((g) => g.carril))
    let carril = 0
    while (ocupados.has(carril)) carril++
    grupo.push({ ...b, carril, carriles: 1 })
    finGrupo = Math.max(finGrupo, b.fin)
  }
  if (grupo.length) cerrar()
  return out
}

function ordenCategoria(c: string | null): number {
  const i = CATEGORIAS_TALLER.findIndex((x) => x.toLowerCase() === (c ?? '').trim().toLowerCase())
  return i === -1 ? (c ? CATEGORIAS_TALLER.length : CATEGORIAS_TALLER.length + 1) : i
}

export default function SemanaView({
  talleres,
  maestros,
  asignaciones,
  onNueva,
  onEditar,
  onEliminar,
}: {
  talleres: Taller[]
  maestros: TallerMaestro[]
  asignaciones: TallerAsignacion[]
  onNueva: () => void
  onEditar: (a: TallerAsignacion) => void
  onEliminar: (a: TallerAsignacion) => void
}) {
  const conteoNivel = useMemo(() => {
    const m = new Map<number, number>()
    for (const n of NIVELES_TALLER) m.set(n.valor, asignaciones.filter((a) => a.niveles.includes(n.valor)).length)
    return m
  }, [asignaciones])

  const nivelInicial = NIVELES_TALLER.find((n) => (conteoNivel.get(n.valor) ?? 0) > 0)?.valor ?? 0
  const [nivelElegido, setNivel] = useState<number | null>(null)
  const nivel = nivelElegido ?? nivelInicial
  const [maestroId, setMaestroId] = useState(0)
  const [maestroQ, setMaestroQ] = useState('')
  const [vista, setVista] = useState<Vista>('tabla')

  const tallerPorId = useMemo(() => new Map(talleres.map((t) => [t.id, t])), [talleres])
  const maestroPorId = useMemo(() => new Map(maestros.map((m) => [m.id, m])), [maestros])

  const delNivel = useMemo(
    () => asignaciones.filter((a) => !nivel || a.niveles.includes(nivel)),
    [asignaciones, nivel]
  )
  const opciones = useMemo(() => opcionesMaestros(maestros, talleres, delNivel), [maestros, talleres, delNivel])

  const visibles = useMemo(() => {
    if (maestroId) return delNivel.filter((a) => a.maestro_id === maestroId)
    const ids = maestrosQueCoinciden(opciones, maestroQ)
    return ids ? delNivel.filter((a) => ids.has(a.maestro_id)) : delNivel
  }, [delNivel, maestroId, maestroQ, opciones])

  const dias = useMemo(() => {
    const usados = new Set(visibles.flatMap((a) => a.horarios.map((h) => h.dia)))
    return DIAS_TALLER.filter((d) => d.valor <= 5 || usados.has(d.valor))
  }, [visibles])

  const nivelesSeccion = nivel
    ? [nivel]
    : NIVELES_TALLER.map((n) => n.valor).filter((n) => visibles.some((a) => a.niveles.includes(n)))

  return (
    <section className="tl-panel" aria-label="Horario semanal de talleres">
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
        <div className="tl-toolbar-der">
          <div className="tl-seg" role="group" aria-label="Tipo de vista">
            <button type="button" data-activo={vista === 'tabla' || undefined} aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')}>
              <Table2 size={16} aria-hidden /> Tabla
            </button>
            <button type="button" data-activo={vista === 'calendario' || undefined} aria-pressed={vista === 'calendario'} onClick={() => setVista('calendario')}>
              <CalendarDays size={16} aria-hidden /> Calendario
            </button>
          </div>
          <MaestroCombo
            opciones={opciones}
            q={maestroQ}
            elegidoId={maestroId}
            onQ={(v) => {
              setMaestroQ(v)
              setMaestroId(0)
            }}
            onElegir={(id, nombre) => {
              setMaestroId(id)
              setMaestroQ(nombre)
            }}
          />
          <button type="button" className="tl-btn tl-btn-primary" onClick={onNueva}>
            <CalendarPlus size={16} aria-hidden /> Programar taller
          </button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="tl-empty">
          {asignaciones.length
            ? 'Ningún taller coincide con el filtro.'
            : 'Todavía no hay talleres programados. Da de alta talleres y maestros, luego usa «Programar taller».'}
        </p>
      ) : vista === 'tabla' ? (
        nivelesSeccion.map((n) => (
          <TablaNivel
            key={n}
            nivel={n}
            asignaciones={visibles.filter((a) => a.niveles.includes(n))}
            dias={dias}
            tallerPorId={tallerPorId}
            maestroPorId={maestroPorId}
            onEditar={onEditar}
            onEliminar={onEliminar}
          />
        ))
      ) : (
        <Calendario
          asignaciones={visibles}
          dias={dias}
          tallerPorId={tallerPorId}
          maestroPorId={maestroPorId}
          onEditar={onEditar}
        />
      )}
    </section>
  )
}

function TablaNivel({
  nivel,
  asignaciones,
  dias,
  tallerPorId,
  maestroPorId,
  onEditar,
  onEliminar,
}: {
  nivel: number
  asignaciones: TallerAsignacion[]
  dias: readonly (typeof DIAS_TALLER)[number][]
  tallerPorId: Map<number, Taller>
  maestroPorId: Map<number, TallerMaestro>
  onEditar: (a: TallerAsignacion) => void
  onEliminar: (a: TallerAsignacion) => void
}) {
  const grupos = useMemo(() => {
    const filas = asignaciones.map((a) => ({ a, t: tallerPorId.get(a.taller_id), m: maestroPorId.get(a.maestro_id) }))
    filas.sort(
      (x, y) =>
        ordenCategoria(x.t?.categoria ?? null) - ordenCategoria(y.t?.categoria ?? null) ||
        (x.t?.nombre ?? '').localeCompare(y.t?.nombre ?? '', 'es', { numeric: true }) ||
        (x.t?.grados ?? '').localeCompare(y.t?.grados ?? '', 'es', { numeric: true })
    )
    const out: { categoria: string; filas: typeof filas }[] = []
    for (const f of filas) {
      const cat = f.t?.categoria?.trim() || 'Sin categoría'
      const ultimo = out[out.length - 1]
      if (ultimo && ultimo.categoria === cat) ultimo.filas.push(f)
      else out.push({ categoria: cat, filas: [f] })
    }
    return out
  }, [asignaciones, tallerPorId, maestroPorId])

  const columnas = dias.length + 2

  return (
    <div className="tl-nivel">
      <h3 className="tl-nivel-titulo">
        {etiquetaNivel(nivel)}
        <span>{asignaciones.length} {asignaciones.length === 1 ? 'grupo' : 'grupos'}</span>
      </h3>
      <div className="tl-horario-wrap">
        <table className="tl-horario">
          <thead>
            <tr>
              <th scope="col" className="tl-horario-col-taller">Taller</th>
              {dias.map((d) => (
                <th key={d.valor} scope="col">{d.etiqueta}</th>
              ))}
              <th scope="col" className="tl-horario-col-acc"><span className="tl-sr">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g.categoria}>
                <tr className="tl-horario-cat">
                  <th scope="rowgroup" colSpan={columnas}>
                    {g.categoria} <span>{g.filas.length}</span>
                  </th>
                </tr>
                {g.filas.map(({ a, t, m }) => {
                  const otros = a.niveles.filter((n) => n !== nivel)
                  const cupo = etiquetaCupo(a)
                  return (
                    <tr key={a.id} className="tl-horario-fila" style={{ ['--tl-color' as string]: t?.color ?? COLORES_TALLER[0] }}>
                      <th scope="row" className="tl-horario-taller">
                        <button type="button" className="tl-horario-nombre" onClick={() => onEditar(a)}>
                          <strong>{t?.nombre ?? 'Taller eliminado'}</strong>
                          {t?.grados ? <span className="tl-grados">{t.grados}</span> : null}
                        </button>
                        <span className="tl-horario-meta">{m ? nombreMaestroTaller(m) : 'Maestro eliminado'}</span>
                        <span className="tl-horario-meta tl-horario-tags">
                          {cupo ? <span><Users size={12} aria-hidden /> {cupo}</span> : null}
                          {otros.length ? <span className="tl-mixto">Con {otros.map(etiquetaNivel).join(' y ')}</span> : null}
                        </span>
                        {a.notas ? <span className="tl-horario-nota">{a.notas}</span> : null}
                      </th>
                      {dias.map((d) => {
                        const hs = a.horarios
                          .filter((h) => h.dia === d.valor)
                          .sort((x, y) => minutosDeHora(x.hora_inicio) - minutosDeHora(y.hora_inicio))
                        return (
                          <td key={d.valor} data-dia={d.etiqueta} data-vacio={!hs.length || undefined}>
                            {hs.length ? (
                              hs.map((h, i) => {
                                const lugar = lugarDeHorario(a, h)
                                return (
                                  <span key={i} className="tl-slot">
                                    <b>{rango12(h.hora_inicio, h.hora_fin)}</b>
                                    {lugar ? <span><MapPin size={11} aria-hidden /> {lugar}</span> : null}
                                  </span>
                                )
                              })
                            ) : (
                              <span className="tl-slot-vacio" aria-label="Sin clase">·</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="tl-horario-acc">
                        <div className="tl-acciones">
                          <button type="button" className="tl-icon-btn" aria-label={`Editar ${t ? nombreTallerCompleto(t) : 'taller'}`} onClick={() => onEditar(a)}>
                            <Pencil size={16} aria-hidden />
                          </button>
                          <button type="button" className="tl-icon-btn tl-danger" aria-label={`Eliminar ${t ? nombreTallerCompleto(t) : 'taller'}`} onClick={() => onEliminar(a)}>
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Calendario({
  asignaciones,
  dias,
  tallerPorId,
  maestroPorId,
  onEditar,
}: {
  asignaciones: TallerAsignacion[]
  dias: readonly (typeof DIAS_TALLER)[number][]
  tallerPorId: Map<number, Taller>
  maestroPorId: Map<number, TallerMaestro>
  onEditar: (a: TallerAsignacion) => void
}) {
  const bloquesPorDia = useMemo(() => {
    const map = new Map<number, Bloque[]>()
    for (const d of dias) {
      const base = asignaciones.flatMap((a) =>
        a.horarios
          .filter((h) => h.dia === d.valor)
          .map((h) => ({
            asignacion: a,
            taller: tallerPorId.get(a.taller_id),
            maestro: maestroPorId.get(a.maestro_id),
            dia: d.valor,
            ini: minutosDeHora(h.hora_inicio),
            fin: minutosDeHora(h.hora_fin),
            lugar: lugarDeHorario(a, h),
          }))
      )
      map.set(d.valor, acomodarCarriles(base))
    }
    return map
  }, [asignaciones, dias, tallerPorId, maestroPorId])

  const [horaIni, horaFin] = useMemo(() => {
    const todos = [...bloquesPorDia.values()].flat()
    if (!todos.length) return [14, 18]
    let ini = Math.floor(Math.min(...todos.map((b) => b.ini)) / 60)
    // Una hora extra abajo para que el bloque ampliado no se corte.
    let fin = Math.min(24, Math.ceil(Math.max(...todos.map((b) => b.fin)) / 60) + 1)
    if (fin - ini < 4) fin = Math.min(24, ini + 4)
    if (fin - ini < 4) ini = Math.max(0, fin - 4)
    return [ini, fin]
  }, [bloquesPorDia])

  const horas = Array.from({ length: horaFin - horaIni }, (_, i) => horaIni + i)
  const alto = (horaFin - horaIni) * PX_HORA
  const anchos = dias.map((d) =>
    Math.max(ANCHO_DIA_MIN, Math.max(1, ...(bloquesPorDia.get(d.valor) ?? []).map((b) => b.carriles)) * ANCHO_CARRIL)
  )
  const columnas = anchos.map((w) => `minmax(${w}px, 1fr)`).join(' ')
  const anchoMin = 72 + anchos.reduce((s, w) => s + w, 0)

  return (
    <>
      <p className="tl-muted tl-cal-ayuda">Pasa el mouse o enfoca un bloque para ver horario, lugar y maestro; haz clic para editarlo. Desliza a los lados si un día tiene muchos talleres.</p>
      <div className="tl-cal-wrap">
        <div
          className="tl-cal"
          style={{
            gridTemplateColumns: `72px ${columnas}`,
            minWidth: anchoMin,
            ['--tl-alto' as string]: `${alto}px`,
            ['--tl-px-hora' as string]: `${PX_HORA}px`,
          }}
        >
          <div className="tl-cal-head tl-cal-esquina" aria-hidden />
          {dias.map((d) => (
            <div key={d.valor} className="tl-cal-head">{d.etiqueta}</div>
          ))}
          <div className="tl-cal-horas" aria-hidden>
            {horas.map((h) => (
              <span key={h} className="tl-cal-hora">{hora12(`${String(h).padStart(2, '0')}:00`)}</span>
            ))}
          </div>
          {dias.map((d) => (
            <div key={d.valor} className="tl-cal-col">
              {(bloquesPorDia.get(d.valor) ?? []).map((b) => {
                const ancho = 100 / b.carriles
                const nombre = b.taller ? nombreTallerCompleto(b.taller) : 'Taller'
                return (
                  <button
                    key={`${b.asignacion.id}-${b.dia}-${b.ini}`}
                    type="button"
                    className="tl-bloque"
                    style={{
                      top: ((b.ini - horaIni * 60) / 60) * PX_HORA,
                      height: Math.max(26, ((b.fin - b.ini) / 60) * PX_HORA - 3),
                      ['--tl-alto-bloque' as string]: `${Math.max(26, ((b.fin - b.ini) / 60) * PX_HORA - 3)}px`,
                      left: `calc(${b.carril * ancho}% + 2px)`,
                      width: `calc(${ancho}% - 4px)`,
                      ['--tl-color' as string]: b.taller?.color ?? COLORES_TALLER[0],
                    }}
                    data-ultimo={
                      b.carril === b.carriles - 1 && (b.carriles > 1 || d.valor === dias[dias.length - 1].valor)
                        ? true
                        : undefined
                    }
                    aria-label={`${nombre}, ${rango12(hhmm(b.ini), hhmm(b.fin))}${b.lugar ? `, ${b.lugar}` : ''}${b.maestro ? `, ${nombreMaestroTaller(b.maestro)}` : ''}. Editar`}
                    onClick={() => onEditar(b.asignacion)}
                  >
                    <span className="tl-bloque-nombre">{nombre}</span>
                    <span className="tl-bloque-det">
                      <span className="tl-bloque-hora">{rango12(hhmm(b.ini), hhmm(b.fin))}</span>
                      {b.lugar ? <span className="tl-bloque-meta">{b.lugar}</span> : null}
                      {b.maestro ? <span className="tl-bloque-meta">{nombreMaestroTaller(b.maestro)}</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="tl-agenda">
        {dias.map((d) => {
          const bloques = [...(bloquesPorDia.get(d.valor) ?? [])].sort((a, b) => a.ini - b.ini)
          return (
            <div key={d.valor} className="tl-agenda-dia">
              <h3 className="tl-agenda-titulo">{d.etiqueta}</h3>
              {bloques.length === 0 ? (
                <p className="tl-muted tl-agenda-vacio">Sin talleres</p>
              ) : (
                <ul>
                  {bloques.map((b) => (
                    <li key={`${b.asignacion.id}-${b.ini}`}>
                      <button type="button" className="tl-agenda-item" style={{ ['--tl-color' as string]: b.taller?.color ?? COLORES_TALLER[0] }}
                        onClick={() => onEditar(b.asignacion)}>
                        <span className="tl-agenda-hora">
                          {hora12(hhmm(b.ini))}
                          <small>{hora12(hhmm(b.fin))}</small>
                        </span>
                        <span className="tl-min0">
                          <strong>{b.taller ? nombreTallerCompleto(b.taller) : 'Taller'}</strong>
                          <span className="tl-desc">
                            {[b.maestro ? nombreMaestroTaller(b.maestro) : '', b.lugar ?? ''].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
