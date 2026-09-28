'use client'

import { useMemo, useState } from 'react'
import { CalendarPlus, MapPin, Pencil, Trash2, Users } from 'lucide-react'
import {
  COLORES_TALLER,
  DIAS_TALLER,
  NIVELES_TALLER,
  etiquetaCupo,
  hora12,
  lugarDeHorario,
  minutosDeHora,
  nombreMaestroTaller,
  nombreTallerCompleto,
  resumenHorarios,
  type Taller,
  type TallerAsignacion,
  type TallerMaestro,
} from '@/lib/talleres/talleresTypes'
import { NivelesBadges } from './TalleresUi'

const PX_HORA = 64

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
  const [nivel, setNivel] = useState(0)
  const [maestroId, setMaestroId] = useState(0)

  const tallerPorId = useMemo(() => new Map(talleres.map((t) => [t.id, t])), [talleres])
  const maestroPorId = useMemo(() => new Map(maestros.map((m) => [m.id, m])), [maestros])

  const visibles = useMemo(
    () =>
      asignaciones.filter(
        (a) => (!nivel || a.niveles.includes(nivel)) && (!maestroId || a.maestro_id === maestroId)
      ),
    [asignaciones, nivel, maestroId]
  )

  const bloquesPorDia = useMemo(() => {
    const map = new Map<number, Bloque[]>()
    for (const d of DIAS_TALLER) {
      const base = visibles.flatMap((a) =>
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
  }, [visibles, tallerPorId, maestroPorId])

  const [horaIni, horaFin] = useMemo(() => {
    const todos = [...bloquesPorDia.values()].flat()
    if (!todos.length) return [14, 18]
    let ini = Math.floor(Math.min(...todos.map((b) => b.ini)) / 60)
    let fin = Math.ceil(Math.max(...todos.map((b) => b.fin)) / 60)
    if (fin - ini < 4) fin = Math.min(24, ini + 4)
    if (fin - ini < 4) ini = Math.max(0, fin - 4)
    return [ini, fin]
  }, [bloquesPorDia])

  const horas = Array.from({ length: horaFin - horaIni }, (_, i) => horaIni + i)
  const alto = (horaFin - horaIni) * PX_HORA
  const maestrosConAsignacion = maestros.filter((m) => asignaciones.some((a) => a.maestro_id === m.id))

  const etiquetaBloque = (b: Bloque) =>
    `${b.taller ? nombreTallerCompleto(b.taller) : 'Taller'} — ${b.maestro ? nombreMaestroTaller(b.maestro) : ''}`

  return (
    <section className="tl-panel" aria-label="Horario semanal de talleres">
      <div className="tl-toolbar">
        <div className="tl-chips" role="group" aria-label="Filtrar por nivel">
          <button type="button" className="tl-chip" data-activo={!nivel || undefined} aria-pressed={!nivel} onClick={() => setNivel(0)}>Todos</button>
          {NIVELES_TALLER.map((n) => (
            <button key={n.valor} type="button" className="tl-chip" data-activo={nivel === n.valor || undefined}
              aria-pressed={nivel === n.valor} onClick={() => setNivel(n.valor)}>
              {n.etiqueta}
            </button>
          ))}
        </div>
        <select className="tl-input tl-select-sm" value={maestroId} onChange={(e) => setMaestroId(Number(e.target.value))} aria-label="Filtrar por maestro">
          <option value={0}>Todos los maestros</option>
          {maestrosConAsignacion.map((m) => (
            <option key={m.id} value={m.id}>{nombreMaestroTaller(m)}</option>
          ))}
        </select>
        <button type="button" className="tl-btn tl-btn-primary" onClick={onNueva}>
          <CalendarPlus size={16} aria-hidden /> Programar taller
        </button>
      </div>

      {/* Escritorio / tablet: cuadrícula de horas */}
      <div className="tl-cal-wrap">
        <div className="tl-cal" style={{ ['--tl-alto' as string]: `${alto}px`, ['--tl-px-hora' as string]: `${PX_HORA}px` }}>
          <div className="tl-cal-head tl-cal-esquina" aria-hidden />
          {DIAS_TALLER.map((d) => (
            <div key={d.valor} className="tl-cal-head">{d.etiqueta}</div>
          ))}
          <div className="tl-cal-horas" aria-hidden>
            {horas.map((h) => (
              <span key={h} className="tl-cal-hora">{hora12(`${String(h).padStart(2, '0')}:00`)}</span>
            ))}
          </div>
          {DIAS_TALLER.map((d) => (
            <div key={d.valor} className="tl-cal-col">
              {(bloquesPorDia.get(d.valor) ?? []).map((b) => {
                const color = b.taller?.color ?? COLORES_TALLER[0]
                const ancho = 100 / b.carriles
                return (
                  <button
                    key={`${b.asignacion.id}-${b.dia}-${b.ini}`}
                    type="button"
                    className="tl-bloque"
                    style={{
                      top: ((b.ini - horaIni * 60) / 60) * PX_HORA,
                      height: Math.max(26, ((b.fin - b.ini) / 60) * PX_HORA - 3),
                      left: `calc(${b.carril * ancho}% + 2px)`,
                      width: `calc(${ancho}% - 4px)`,
                      ['--tl-color' as string]: color,
                    }}
                    title={etiquetaBloque(b)}
                    onClick={() => onEditar(b.asignacion)}
                  >
                    <span className="tl-bloque-nombre">{b.taller ? nombreTallerCompleto(b.taller) : 'Taller'}</span>
                    <span className="tl-bloque-hora">
                      {hora12(`${String(Math.floor(b.ini / 60)).padStart(2, '0')}:${String(b.ini % 60).padStart(2, '0')}`)} –{' '}
                      {hora12(`${String(Math.floor(b.fin / 60)).padStart(2, '0')}:${String(b.fin % 60).padStart(2, '0')}`)}
                    </span>
                    {b.maestro ? <span className="tl-bloque-meta">{nombreMaestroTaller(b.maestro)}</span> : null}
                    {b.lugar ? <span className="tl-bloque-meta">{b.lugar}</span> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Móvil: agenda por día */}
      <div className="tl-agenda">
        {DIAS_TALLER.map((d) => {
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
                          {hora12(`${String(Math.floor(b.ini / 60)).padStart(2, '0')}:${String(b.ini % 60).padStart(2, '0')}`)}
                          <small>{hora12(`${String(Math.floor(b.fin / 60)).padStart(2, '0')}:${String(b.fin % 60).padStart(2, '0')}`)}</small>
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

      <h3 className="tl-seccion">Talleres programados ({visibles.length})</h3>
      {visibles.length === 0 ? (
        <p className="tl-empty">
          {asignaciones.length
            ? 'Ningún taller coincide con el filtro.'
            : 'Todavía no hay talleres programados. Da de alta talleres y maestros, luego usa «Programar taller».'}
        </p>
      ) : (
        <ul className="tl-asig-lista">
          {visibles.map((a) => {
            const t = tallerPorId.get(a.taller_id)
            const m = maestroPorId.get(a.maestro_id)
            const lugares = [...new Set(a.horarios.map((h) => lugarDeHorario(a, h)).filter(Boolean))].join(' / ')
            const cupo = etiquetaCupo(a)
            return (
              <li key={a.id} className="tl-asig-card" style={{ ['--tl-color' as string]: t?.color ?? COLORES_TALLER[0] }}>
                <div className="tl-min0">
                  <p className="tl-asig-titulo">
                    {t ? nombreTallerCompleto(t) : 'Taller eliminado'}
                    {t?.categoria ? <span className="tl-cat">{t.categoria}</span> : null}
                  </p>
                  <p className="tl-asig-horario">{resumenHorarios(a.horarios)}</p>
                  <p className="tl-asig-meta">
                    <span>{m ? nombreMaestroTaller(m) : 'Maestro eliminado'}</span>
                    {lugares ? <span><MapPin size={13} aria-hidden /> {lugares}</span> : null}
                    {cupo ? <span><Users size={13} aria-hidden /> {cupo}</span> : null}
                  </p>
                  <NivelesBadges niveles={a.niveles} />
                </div>
                <div className="tl-acciones">
                  <button type="button" className="tl-icon-btn" aria-label="Editar horario" onClick={() => onEditar(a)}>
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button type="button" className="tl-icon-btn tl-danger" aria-label="Eliminar horario" onClick={() => onEliminar(a)}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
