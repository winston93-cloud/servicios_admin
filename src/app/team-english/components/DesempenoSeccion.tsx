'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  RUBROS,
  TIPOS_INCIDENCIA,
  calcularDesempeno,
  diasHabiles,
  fechaLarga,
  nivelDesempeno,
  sumarDias,
  type Ponderadores,
  type TipoIncidencia,
} from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { teAccion } from '../teApi'
import { Avatar, Campo, Vacio } from './ui'

type Periodo = 'mes' | 'anterior' | 'ciclo' | 'custom'

export default function DesempenoSeccion({ snap, recargar, avisar }: SeccionProps) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [custom, setCustom] = useState({ desde: `${snap.hoy.slice(0, 8)}01`, hasta: snap.hoy })
  const [abierta, setAbierta] = useState<number | null>(null)
  const [capturando, setCapturando] = useState(false)
  const [verPesos, setVerPesos] = useState(false)

  const rango = useMemo(() => {
    const inicioMes = `${snap.hoy.slice(0, 8)}01`
    if (periodo === 'mes') return { desde: inicioMes, hasta: snap.hoy }
    if (periodo === 'anterior') {
      const fin = sumarDias(inicioMes, -1)
      return { desde: `${fin.slice(0, 8)}01`, hasta: fin }
    }
    if (periodo === 'ciclo') return { desde: snap.inicio_ciclo, hasta: snap.hoy }
    return custom.desde <= custom.hasta ? custom : { desde: custom.hasta, hasta: custom.desde }
  }, [periodo, custom, snap.hoy, snap.inicio_ciclo])

  const activas = snap.teachers.filter((t) => t.activo)
  const filas = activas
    .map((t) => ({ t, d: calcularDesempeno(t.maestro_id, snap.incidencias, rango.desde, rango.hasta, snap.ponderadores) }))
    .sort((a, b) => b.d.total - a.d.total || a.t.nombre.localeCompare(b.t.nombre, 'es'))
  const promedio = filas.length ? filas.reduce((s, f) => s + f.d.total, 0) / filas.length : 100
  const dias = diasHabiles(rango.desde, rango.hasta)
  const incPeriodo = snap.incidencias.filter((i) => i.fecha >= rango.desde && i.fecha <= rango.hasta)

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar esta incidencia?')) return
    try {
      await teAccion(snap.nivel, 'eliminar_incidencia', { id })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const np = nivelDesempeno(promedio)
  return (
    <>
      <div className="te-toolbar">
        <div className="te-filtros" role="radiogroup" aria-label="Periodo">
          {([['mes', 'Este mes'], ['anterior', 'Mes anterior'], ['ciclo', 'Ciclo escolar'], ['custom', 'Personalizado']] as [Periodo, string][]).map(([id, txt]) => (
            <button key={id} type="button" role="radio" aria-checked={periodo === id} data-activo={periodo === id || undefined} onClick={() => setPeriodo(id)}>{txt}</button>
          ))}
        </div>
        <button type="button" className="te-btn te-btn-primary" onClick={() => setCapturando((v) => !v)}>
          <Plus size={16} aria-hidden /> Registrar incidencia
        </button>
      </div>
      {periodo === 'custom' ? (
        <div className="te-rango">
          <Campo etiqueta="Desde"><input className="te-input" type="date" value={custom.desde} onChange={(e) => setCustom({ ...custom, desde: e.target.value })} /></Campo>
          <Campo etiqueta="Hasta"><input className="te-input" type="date" value={custom.hasta} onChange={(e) => setCustom({ ...custom, hasta: e.target.value })} /></Campo>
        </div>
      ) : null}

      {capturando ? <CapturaIncidencia snap={snap} recargar={recargar} avisar={avisar} onCerrar={() => setCapturando(false)} /> : null}

      <div className="te-desemp-top">
        <div className="te-anillo-grande" data-tono={np.tono} style={{ ['--p' as string]: promedio / 100 }}>
          <span><b>{promedio.toFixed(1)}%</b><small>{np.emoji} Promedio del equipo</small></span>
        </div>
        <div className="te-min0 te-desemp-info">
          <p><b>{fechaLarga(rango.desde)}</b> al <b>{fechaLarga(rango.hasta)}</b> · {dias} días hábiles · {incPeriodo.length} incidencias</p>
          <p className="te-nota">
            Cada rubro es el % de días hábiles sin esa incidencia (las justificadas cuentan la mitad). El total pondera los rubros
            según tus porcentajes.
          </p>
          <button type="button" className="te-btn te-btn-ghost te-btn-sm" aria-expanded={verPesos} onClick={() => setVerPesos((v) => !v)}>
            ⚖️ Ponderadores: {RUBROS.map((r) => `${r.emoji} ${snap.ponderadores[r.clave]}%`).join(' · ')}
          </button>
        </div>
      </div>

      {verPesos ? <EditorPonderadores snap={snap} recargar={recargar} avisar={avisar} onCerrar={() => setVerPesos(false)} /> : null}

      {!filas.length ? (
        <Vacio emoji="👩‍🏫" titulo="Aún no hay teachers en el equipo" />
      ) : (
        <ol className="te-ranking">
          {filas.map(({ t, d }, i) => {
            const n = nivelDesempeno(d.total)
            const abiertaEsta = abierta === t.maestro_id
            const suyas = incPeriodo.filter((x) => x.maestro_id === t.maestro_id)
            return (
              <li key={t.maestro_id} style={{ ['--i' as string]: i }} data-tono={n.tono}>
                <button type="button" className="te-rank-fila" aria-expanded={abiertaEsta} onClick={() => setAbierta(abiertaEsta ? null : t.maestro_id)}>
                  <Avatar emoji={t.emoji} fotoKey={t.foto_key} nombre={t.nombre} tam="sm" />
                  <span className="te-min0 te-rank-nombre">
                    <strong>{t.nombre}</strong>
                    <small>🚫 {d.conteos.falta} · ⏰ {d.conteos.retardo} · 🚪 {d.conteos.permiso_llegada + d.conteos.permiso_salida} · 🤒 {d.conteos.enfermedad}</small>
                  </span>
                  <span className="te-rank-barras" aria-hidden>
                    {RUBROS.map((r) => (
                      <span key={r.clave} title={`${r.etiqueta}: ${d.rubros[r.clave].toFixed(1)}%`}>
                        <i style={{ ['--p' as string]: d.rubros[r.clave] / 100 }} />
                        <em>{r.emoji}</em>
                      </span>
                    ))}
                  </span>
                  <span className="te-rank-pct"><b>{d.total.toFixed(1)}%</b><small>{n.emoji} {n.etiqueta}</small></span>
                  <ChevronDown size={18} className="te-chevron" aria-hidden />
                </button>
                {abiertaEsta ? (
                  <div className="te-rank-detalle">
                    <ul className="te-rubros">
                      {RUBROS.map((r) => (
                        <li key={r.clave}>
                          <span>{r.emoji} {r.etiqueta}</span>
                          <b>{d.rubros[r.clave].toFixed(1)}%</b>
                          <small>{r.ayuda} · peso {snap.ponderadores[r.clave]}%</small>
                        </li>
                      ))}
                    </ul>
                    {suyas.length ? (
                      <ul className="te-incidencias">
                        {suyas.map((x) => {
                          const tipo = TIPOS_INCIDENCIA.find((y) => y.valor === x.tipo)
                          return (
                            <li key={x.id}>
                              <span aria-hidden>{tipo?.emoji}</span>
                              <span className="te-min0">
                                <b>{tipo?.etiqueta}</b> · {fechaLarga(x.fecha)}
                                {x.minutos ? ` · ${x.minutos} min` : ''}
                                {x.justificada ? ' · ✔️ Justificada' : ''}
                                {x.notas ? <small>{x.notas}</small> : null}
                              </span>
                              <button type="button" className="te-icon-btn" aria-label="Eliminar incidencia" onClick={() => void eliminar(x.id)}>
                                <Trash2 size={15} aria-hidden />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="te-nota">🌟 Sin incidencias en este periodo.</p>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}

function CapturaIncidencia({ snap, recargar, avisar, onCerrar }: SeccionProps & { onCerrar: () => void }) {
  const activas = snap.teachers.filter((t) => t.activo)
  const [f, setF] = useState({ maestro_id: '', fecha: snap.hoy, tipo: 'retardo' as TipoIncidencia, minutos: '', justificada: false, notas: '' })
  const [guardando, setGuardando] = useState(false)
  const conMinutos = f.tipo === 'retardo' || f.tipo === 'permiso_llegada' || f.tipo === 'permiso_salida'

  const guardar = async () => {
    setGuardando(true)
    try {
      await teAccion(snap.nivel, 'incidencia', { ...f, maestro_id: Number(f.maestro_id), minutos: conMinutos ? f.minutos : '' })
      await recargar()
      avisar('Incidencia registrada.')
      setF({ ...f, minutos: '', justificada: false, notas: '' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="te-captura">
      <div className="te-tipos" role="radiogroup" aria-label="Tipo de incidencia">
        {TIPOS_INCIDENCIA.map((t) => (
          <button key={t.valor} type="button" role="radio" aria-checked={f.tipo === t.valor} data-activo={f.tipo === t.valor || undefined}
            onClick={() => setF({ ...f, tipo: t.valor })}>
            <span aria-hidden>{t.emoji}</span>{t.etiqueta}
          </button>
        ))}
      </div>
      <div className="te-form">
        <Campo etiqueta="Teacher">
          <select className="te-input" value={f.maestro_id} onChange={(e) => setF({ ...f, maestro_id: e.target.value })}>
            <option value="">Selecciona…</option>
            {activas.map((t) => <option key={t.maestro_id} value={t.maestro_id}>{t.emoji} {t.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Fecha"><input className="te-input" type="date" value={f.fecha} max={snap.hoy} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
        {conMinutos ? (
          <Campo etiqueta="Minutos (opcional)"><input className="te-input" type="number" min={0} max={600} inputMode="numeric" value={f.minutos} onChange={(e) => setF({ ...f, minutos: e.target.value })} /></Campo>
        ) : null}
        <Campo etiqueta="Notas (opcional)"><input className="te-input" value={f.notas} maxLength={1000} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Campo>
        <label className="te-check" data-completo>
          <input type="checkbox" checked={f.justificada} onChange={(e) => setF({ ...f, justificada: e.target.checked })} />
          Justificada (cuenta la mitad)
        </label>
      </div>
      <div className="te-fila-botones te-fila-fin">
        <button type="button" className="te-btn te-btn-ghost" onClick={onCerrar}>Cerrar</button>
        <button type="button" className="te-btn te-btn-primary" disabled={guardando || !f.maestro_id || !f.fecha} onClick={() => void guardar()}>
          {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '💾'} Guardar
        </button>
      </div>
    </div>
  )
}

function EditorPonderadores({ snap, recargar, avisar, onCerrar }: SeccionProps & { onCerrar: () => void }) {
  const [p, setP] = useState<Ponderadores>(snap.ponderadores)
  const [guardando, setGuardando] = useState(false)
  const suma = RUBROS.reduce((s, r) => s + p[r.clave], 0)

  const guardar = async () => {
    setGuardando(true)
    try {
      await teAccion(snap.nivel, 'ponderadores', { ponderadores: p })
      await recargar()
      avisar('Ponderadores guardados. ⚖️')
      onCerrar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="te-pesos">
      {RUBROS.map((r) => (
        <label key={r.clave} className="te-peso">
          <span>{r.emoji} {r.etiqueta}<small>{r.ayuda}</small></span>
          <input type="range" min={0} max={100} step={5} value={p[r.clave]} onChange={(e) => setP({ ...p, [r.clave]: Number(e.target.value) })} />
          <b>{p[r.clave]}%</b>
        </label>
      ))}
      <div className="te-fila-botones te-fila-fin">
        <span className="te-suma" data-ok={suma === 100 || undefined}>{suma === 100 ? '✅ Suman 100%' : `Suman ${suma}% (deben ser 100%)`}</span>
        <button type="button" className="te-btn te-btn-ghost" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="te-btn te-btn-primary" disabled={guardando || suma !== 100} onClick={() => void guardar()}>
          {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '💾'} Guardar
        </button>
      </div>
    </div>
  )
}
