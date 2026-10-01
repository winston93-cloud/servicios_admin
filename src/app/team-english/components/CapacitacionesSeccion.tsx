'use client'

import { useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { MODALIDADES, fechaCorta, type TeCapacitacion } from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { teAbrirArchivo, teAccion, teSubir } from '../teApi'
import { ACEPTAR_DOCS, Avatar, Campo, Hoja, Vacio } from './ui'

type Vista = 'proximas' | 'historial'
type Borrador = {
  id?: number
  titulo: string
  tipo: TeCapacitacion['tipo']
  modalidad: TeCapacitacion['modalidad']
  proveedor: string
  fecha_inicio: string
  fecha_fin: string
  horas: string
  lugar: string
  descripcion: string
  estado: TeCapacitacion['estado']
  participantes: Map<number, boolean | null>
}

const ESTADOS: Record<TeCapacitacion['estado'], string> = {
  programada: '🗓️ Programada',
  realizada: '🎉 Realizada',
  cancelada: '🚫 Cancelada',
}

function mesDia(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  return {
    dia: d.getUTCDate(),
    mes: d.toLocaleDateString('es-MX', { timeZone: 'UTC', month: 'short' }).replace('.', ''),
  }
}

export default function CapacitacionesSeccion({ snap, recargar, avisar }: SeccionProps) {
  const [vista, setVista] = useState<Vista>('proximas')
  const [tipo, setTipo] = useState<'todas' | TeCapacitacion['tipo']>('todas')
  const [borrador, setBorrador] = useState<Borrador | null>(null)

  const esProxima = (c: TeCapacitacion) => c.estado === 'programada' && (c.fecha_fin ?? c.fecha_inicio) >= snap.hoy
  const lista = useMemo(() => {
    const l = snap.capacitaciones
      .filter((c) => (vista === 'proximas' ? esProxima(c) : !esProxima(c)))
      .filter((c) => tipo === 'todas' || c.tipo === tipo)
    return vista === 'proximas' ? [...l].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio)) : l
  }, [snap.capacitaciones, vista, tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  const realizadas = snap.capacitaciones.filter((c) => c.estado === 'realizada')
  const horas = realizadas.reduce((s, c) => s + (c.horas ?? 0), 0)
  const teacherDe = new Map(snap.teachers.map((t) => [t.maestro_id, t]))

  const nueva = (): Borrador => ({
    titulo: '',
    tipo: 'interna',
    modalidad: 'presencial',
    proveedor: '',
    fecha_inicio: snap.hoy,
    fecha_fin: '',
    horas: '',
    lugar: '',
    descripcion: '',
    estado: 'programada',
    participantes: new Map(snap.teachers.filter((t) => t.activo).map((t) => [t.maestro_id, null])),
  })

  const editar = (c: TeCapacitacion): Borrador => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    modalidad: c.modalidad,
    proveedor: c.proveedor ?? '',
    fecha_inicio: c.fecha_inicio,
    fecha_fin: c.fecha_fin ?? '',
    horas: c.horas == null ? '' : String(c.horas),
    lugar: c.lugar ?? '',
    descripcion: c.descripcion,
    estado: c.estado,
    participantes: new Map(c.participantes.map((p) => [p.maestro_id, p.asistio])),
  })

  const eliminar = async (c: TeCapacitacion) => {
    if (!window.confirm(`¿Eliminar «${c.titulo}» y sus constancias?`)) return
    try {
      await teAccion(snap.nivel, 'eliminar_capacitacion', { id: c.id })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  return (
    <>
      <dl className="te-mini-stats">
        <div><dt>🎉 Realizadas en el ciclo</dt><dd>{realizadas.length}</dd></div>
        <div><dt>⏱️ Horas de formación</dt><dd>{horas}</dd></div>
        <div><dt>🏫 Internas</dt><dd>{snap.capacitaciones.filter((c) => c.tipo === 'interna').length}</dd></div>
        <div><dt>✈️ Externas</dt><dd>{snap.capacitaciones.filter((c) => c.tipo === 'externa').length}</dd></div>
      </dl>

      <div className="te-toolbar">
        <div className="te-filtros" role="tablist">
          {([['proximas', '🗓️ Próximas'], ['historial', '📜 Historial']] as [Vista, string][]).map(([id, txt]) => (
            <button key={id} type="button" role="tab" aria-selected={vista === id} data-activo={vista === id || undefined} onClick={() => setVista(id)}>{txt}</button>
          ))}
        </div>
        <select className="te-input te-select-sm" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo">
          <option value="todas">Internas y externas</option>
          <option value="interna">Solo internas</option>
          <option value="externa">Solo externas</option>
        </select>
        <button type="button" className="te-btn te-btn-primary" onClick={() => setBorrador(nueva())}>
          <Plus size={16} aria-hidden /> Nueva capacitación
        </button>
      </div>

      {!lista.length ? (
        <Vacio emoji={vista === 'proximas' ? '🗓️' : '📜'} titulo={vista === 'proximas' ? 'No hay capacitaciones programadas' : 'Aún no hay historial'}>
          {vista === 'proximas' ? 'Programa la siguiente y elige qué teachers asistirán.' : 'Las capacitaciones realizadas o pasadas aparecerán aquí con su asistencia y constancias.'}
        </Vacio>
      ) : (
        <ul className="te-caps">
          {lista.map((c, i) => {
            const f = mesDia(c.fecha_inicio)
            const asistieron = c.participantes.filter((p) => p.asistio).length
            return (
              <li key={c.id} style={{ ['--i' as string]: i }}>
                <article className="te-cap" data-tipo={c.tipo} data-estado={c.estado}>
                  <span className="te-cap-fecha" aria-hidden><b>{f.dia}</b>{f.mes}</span>
                  <div className="te-min0 te-cap-cuerpo">
                    <p className="te-cap-tags">
                      <span className="te-chip">{c.tipo === 'interna' ? '🏫 Interna' : '✈️ Externa'}</span>
                      <span className="te-chip te-chip-suave">{MODALIDADES[c.modalidad]}</span>
                      <span className="te-chip te-chip-suave">{ESTADOS[c.estado]}</span>
                    </p>
                    <h3>{c.titulo}</h3>
                    <p className="te-cap-meta">
                      {fechaCorta(c.fecha_inicio)}{c.fecha_fin && c.fecha_fin !== c.fecha_inicio ? ` – ${fechaCorta(c.fecha_fin)}` : ''}
                      {c.horas ? ` · ${c.horas} h` : ''}{c.proveedor ? ` · ${c.proveedor}` : ''}{c.lugar ? ` · 📍 ${c.lugar}` : ''}
                    </p>
                    {c.descripcion ? <p className="te-cap-desc">{c.descripcion}</p> : null}
                    <div className="te-cap-gente">
                      <span className="te-avatares">
                        {c.participantes.slice(0, 8).map((p) => {
                          const t = teacherDe.get(p.maestro_id)
                          return t ? <span key={p.maestro_id} title={t.nombre} data-asistio={p.asistio ?? undefined}><Avatar emoji={t.emoji} fotoKey={t.foto_key} nombre={t.nombre} tam="sm" /></span> : null
                        })}
                        {c.participantes.length > 8 ? <span className="te-avatares-mas">+{c.participantes.length - 8}</span> : null}
                      </span>
                      <small>
                        {c.participantes.length} teacher{c.participantes.length === 1 ? '' : 's'}
                        {c.estado === 'realizada' ? ` · ${asistieron} asistieron` : ''}
                        {c.participantes.some((p) => p.constancia_key) ? ` · 🏅 ${c.participantes.filter((p) => p.constancia_key).length} constancias` : ''}
                      </small>
                    </div>
                  </div>
                  <div className="te-cap-acciones">
                    <button type="button" className="te-icon-btn" aria-label="Editar" onClick={() => setBorrador(editar(c))}><Pencil size={16} aria-hidden /></button>
                    <button type="button" className="te-icon-btn" aria-label="Eliminar" onClick={() => void eliminar(c)}><Trash2 size={16} aria-hidden /></button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      <FormCapacitacion borrador={borrador} setBorrador={setBorrador} snap={snap} recargar={recargar} avisar={avisar} />
    </>
  )
}

function FormCapacitacion({ borrador, setBorrador, snap, recargar, avisar }: SeccionProps & {
  borrador: Borrador | null
  setBorrador: (b: Borrador | null) => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState<number | null>(null)
  if (!borrador) return null
  const b = borrador
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setBorrador({ ...b, [k]: v })
  const equipo = snap.teachers.filter((t) => t.activo || b.participantes.has(t.maestro_id))
  const original = b.id ? snap.capacitaciones.find((c) => c.id === b.id) : null

  const toggle = (id: number) => {
    const m = new Map(b.participantes)
    if (m.has(id)) m.delete(id)
    else m.set(id, b.estado === 'realizada' ? true : null)
    set('participantes', m)
  }
  const asistio = (id: number, v: boolean) => {
    const m = new Map(b.participantes)
    m.set(id, v)
    set('participantes', m)
  }
  const todas = equipo.every((t) => b.participantes.has(t.maestro_id))

  const guardar = async () => {
    setGuardando(true)
    try {
      const r = await teAccion<{ id: number }>(snap.nivel, 'capacitacion', {
        ...b,
        participantes: [...b.participantes].map(([maestro_id, a]) => ({ maestro_id, asistio: a })),
      })
      await recargar()
      avisar(b.id ? 'Capacitación actualizada.' : 'Capacitación creada. 🎓')
      // Al crear se queda abierta para poder subir constancias.
      setBorrador(b.id ? null : { ...b, id: r.id })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const subirConstancia = async (maestroId: number, file: File | null) => {
    if (!file || !b.id) return
    setSubiendo(maestroId)
    try {
      await teSubir(snap.nivel, { tipo: 'constancia', capacitacion_id: b.id, maestro_id: maestroId, archivo: file })
      await recargar()
      avisar('Constancia subida. 🏅')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setSubiendo(null)
    }
  }

  return (
    <Hoja abierta titulo={b.id ? 'Editar capacitación' : 'Nueva capacitación'} emoji="🎓" onCerrar={() => setBorrador(null)}
      pie={
        <>
          <button type="button" className="te-btn te-btn-ghost" onClick={() => setBorrador(null)}>Cerrar</button>
          <button type="button" className="te-btn te-btn-primary" disabled={guardando || !b.titulo.trim() || !b.fecha_inicio} onClick={() => void guardar()}>
            {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '💾'} Guardar
          </button>
        </>
      }>
      <div className="te-form">
        <Campo etiqueta="Nombre" completo><input className="te-input" value={b.titulo} maxLength={200} onChange={(e) => set('titulo', e.target.value)} placeholder="Phonics workshop" /></Campo>
        <Campo etiqueta="Tipo">
          <select className="te-input" value={b.tipo} onChange={(e) => set('tipo', e.target.value as Borrador['tipo'])}>
            <option value="interna">🏫 Interna</option>
            <option value="externa">✈️ Externa</option>
          </select>
        </Campo>
        <Campo etiqueta="Modalidad">
          <select className="te-input" value={b.modalidad} onChange={(e) => set('modalidad', e.target.value as Borrador['modalidad'])}>
            {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Inicio"><input className="te-input" type="date" value={b.fecha_inicio} onChange={(e) => set('fecha_inicio', e.target.value)} /></Campo>
        <Campo etiqueta="Fin (opcional)"><input className="te-input" type="date" value={b.fecha_fin} min={b.fecha_inicio} onChange={(e) => set('fecha_fin', e.target.value)} /></Campo>
        <Campo etiqueta="Horas"><input className="te-input" type="number" min={0} step={0.5} inputMode="decimal" value={b.horas} onChange={(e) => set('horas', e.target.value)} /></Campo>
        <Campo etiqueta="Estado">
          <select className="te-input" value={b.estado} onChange={(e) => set('estado', e.target.value as Borrador['estado'])}>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo etiqueta={b.tipo === 'externa' ? 'Institución / proveedor' : 'Imparte'}><input className="te-input" value={b.proveedor} onChange={(e) => set('proveedor', e.target.value)} placeholder={b.tipo === 'externa' ? 'Cambridge, Oxford…' : 'Coordinación'} /></Campo>
        <Campo etiqueta="Lugar o enlace"><input className="te-input" value={b.lugar} onChange={(e) => set('lugar', e.target.value)} /></Campo>
        <Campo etiqueta="Descripción" completo><textarea className="te-input" rows={3} value={b.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></Campo>
      </div>

      <div className="te-participantes">
        <div className="te-participantes-head">
          <strong>👩‍🏫 Teachers ({b.participantes.size})</strong>
          <button type="button" className="te-btn te-btn-ghost te-btn-sm"
            onClick={() => set('participantes', todas ? new Map() : new Map(equipo.map((t) => [t.maestro_id, b.participantes.get(t.maestro_id) ?? (b.estado === 'realizada' ? true : null)])))}>
            {todas ? 'Quitar todas' : 'Todas'}
          </button>
        </div>
        <ul>
          {equipo.map((t) => {
            const dentro = b.participantes.has(t.maestro_id)
            const p = original?.participantes.find((x) => x.maestro_id === t.maestro_id)
            return (
              <li key={t.maestro_id} data-dentro={dentro || undefined}>
                <label className="te-check">
                  <input type="checkbox" checked={dentro} onChange={() => toggle(t.maestro_id)} />
                  <span aria-hidden>{t.emoji}</span> {t.nombre}
                </label>
                {dentro && b.estado === 'realizada' ? (
                  <span className="te-asistio" role="group" aria-label={`Asistencia de ${t.nombre}`}>
                    <button type="button" data-activo={b.participantes.get(t.maestro_id) === true || undefined} onClick={() => asistio(t.maestro_id, true)}>Asistió</button>
                    <button type="button" data-activo={b.participantes.get(t.maestro_id) === false || undefined} onClick={() => asistio(t.maestro_id, false)}>No</button>
                  </span>
                ) : null}
                {dentro && b.id && p ? (
                  <span className="te-constancia">
                    {p.constancia_key ? (
                      <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(p.constancia_key!).catch((e) => avisar(e.message, 'error'))}>🏅 Ver</button>
                    ) : null}
                    <label className="te-btn te-btn-ghost te-btn-sm">
                      <input type="file" accept={ACEPTAR_DOCS} hidden onChange={(e) => void subirConstancia(t.maestro_id, e.target.files?.[0] ?? null)} />
                      {subiendo === t.maestro_id ? <Loader2 size={14} className="te-spin" aria-hidden /> : '📎'} {p.constancia_key ? 'Cambiar' : 'Constancia'}
                    </label>
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
        {!b.id ? <p className="te-campo-ayuda">Guarda la capacitación para poder subir constancias.</p> : null}
      </div>
    </Hoja>
  )
}
