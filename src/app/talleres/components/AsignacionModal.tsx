'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Copy, X } from 'lucide-react'
import {
  DIAS_TALLER,
  etiquetaDia,
  hora12,
  lugarDeHorario,
  minutosDeHora,
  nombreMaestroTaller,
  nombreTallerCompleto,
  rangosSeTraslapan,
  resumenHorarios,
  type Taller,
  type TallerAsignacion,
  type TallerHorario,
  type TallerMaestro,
} from '@/lib/talleres/talleresTypes'
import { Campo, NivelesChips, TlModal } from './TalleresUi'

type Tramo = { hora_inicio: string; hora_fin: string; lugar?: string }

const TRAMO_DEFAULT: Tramo = { hora_inicio: '15:00', hora_fin: '16:00' }

const PRESETS: { etiqueta: string; dias: number[] }[] = [
  { etiqueta: 'Lun · Mié · Vie', dias: [1, 3, 5] },
  { etiqueta: 'Mar · Jue', dias: [2, 4] },
  { etiqueta: 'Lunes a viernes', dias: [1, 2, 3, 4, 5] },
  { etiqueta: 'Solo sábado', dias: [6] },
]

function duracion(t: Tramo): string {
  const min = minutosDeHora(t.hora_fin) - minutosDeHora(t.hora_inicio)
  if (min <= 0) return 'Horario inválido'
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ')
}

export default function AsignacionModal({
  abierto,
  asignacion,
  talleres,
  maestros,
  asignaciones,
  guardando,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean
  asignacion: TallerAsignacion | null
  talleres: Taller[]
  maestros: TallerMaestro[]
  asignaciones: TallerAsignacion[]
  guardando: boolean
  onCerrar: () => void
  onGuardar: (b: Record<string, unknown>) => Promise<boolean>
}) {
  const [tallerId, setTallerId] = useState(0)
  const [maestroId, setMaestroId] = useState(0)
  const [niveles, setNiveles] = useState<number[]>([])
  const [lugar, setLugar] = useState('')
  const [cupo, setCupo] = useState('')
  const [cupoMin, setCupoMin] = useState('')
  const [notas, setNotas] = useState('')
  const [tramos, setTramos] = useState<Map<number, Tramo>>(new Map())
  const [ultimo, setUltimo] = useState<Tramo>(TRAMO_DEFAULT)

  useEffect(() => {
    if (!abierto) return
    if (asignacion) {
      setTallerId(asignacion.taller_id)
      setMaestroId(asignacion.maestro_id)
      setNiveles(asignacion.niveles)
      setLugar(asignacion.lugar ?? '')
      setCupo(asignacion.cupo ? String(asignacion.cupo) : '')
      setCupoMin(asignacion.cupo_min ? String(asignacion.cupo_min) : '')
      setNotas(asignacion.notas ?? '')
      setTramos(new Map(asignacion.horarios.map((h) => [h.dia, { hora_inicio: h.hora_inicio, hora_fin: h.hora_fin, lugar: h.lugar ?? '' }])))
      setUltimo(asignacion.horarios[0] ? { hora_inicio: asignacion.horarios[0].hora_inicio, hora_fin: asignacion.horarios[0].hora_fin } : TRAMO_DEFAULT)
    } else {
      setTallerId(0)
      setMaestroId(0)
      setNiveles([])
      setLugar('')
      setCupo('')
      setCupoMin('')
      setNotas('')
      setTramos(new Map())
      setUltimo(TRAMO_DEFAULT)
    }
  }, [abierto, asignacion])

  const taller = talleres.find((t) => t.id === tallerId) ?? null
  const maestro = maestros.find((m) => m.id === maestroId) ?? null

  const talleresOpciones = useMemo(
    () => talleres.filter((t) => t.activo || t.id === asignacion?.taller_id),
    [talleres, asignacion]
  )

  const maestrosOpciones = useMemo(() => {
    const activos = maestros.filter((m) => m.activo || m.id === asignacion?.maestro_id)
    if (!taller) return activos.map((m) => ({ m, compatible: true }))
    return activos
      .map((m) => ({ m, compatible: m.niveles.some((n) => taller.niveles.includes(n)) }))
      .sort((a, b) => Number(b.compatible) - Number(a.compatible))
  }, [maestros, taller, asignacion])

  const nivelesComunes = useMemo(() => {
    if (!taller) return []
    if (!maestro) return taller.niveles
    return taller.niveles.filter((n) => maestro.niveles.includes(n))
  }, [taller, maestro])

  const cambiarTaller = (id: number) => {
    setTallerId(id)
    const t = talleres.find((x) => x.id === id)
    if (!t) return
    const m = maestros.find((x) => x.id === maestroId)
    if (m && !m.niveles.some((n) => t.niveles.includes(n))) setMaestroId(0)
    const comunes = m ? t.niveles.filter((n) => m.niveles.includes(n)) : t.niveles
    setNiveles(comunes)
  }

  const cambiarMaestro = (id: number) => {
    setMaestroId(id)
    const m = maestros.find((x) => x.id === id)
    if (taller && m) setNiveles(taller.niveles.filter((n) => m.niveles.includes(n)))
  }

  const toggleDia = (dia: number) => {
    const next = new Map(tramos)
    if (next.has(dia)) next.delete(dia)
    else next.set(dia, { hora_inicio: ultimo.hora_inicio, hora_fin: ultimo.hora_fin })
    setTramos(next)
  }

  const aplicarPreset = (dias: number[]) => {
    const base = tramos.values().next().value ?? ultimo
    setTramos(new Map(dias.map((d) => [d, { ...(tramos.get(d) ?? base) }])))
  }

  const setTramo = (dia: number, campo: keyof Tramo, valor: string) => {
    const next = new Map(tramos)
    const t = { ...(next.get(dia) ?? ultimo), [campo]: valor }
    next.set(dia, t)
    setTramos(next)
    if (campo !== 'lugar') setUltimo({ hora_inicio: t.hora_inicio, hora_fin: t.hora_fin })
  }

  const copiarATodos = (dia: number) => {
    const t = tramos.get(dia)
    if (!t) return
    setTramos(new Map([...tramos.entries()].map(([d, actual]) => [d, { ...actual, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin }])))
  }

  const horarios: TallerHorario[] = useMemo(
    () =>
      [...tramos.entries()]
        .sort(([a], [b]) => a - b)
        .map(([dia, t]) => ({ dia, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, lugar: (t.lugar ?? '').trim() || null })),
    [tramos]
  )

  const conflictos = useMemo(() => {
    const out: string[] = []
    const norm = (x: string | null) => (x ?? '').trim().toLowerCase()
    for (const otra of asignaciones) {
      if (otra.id === asignacion?.id) continue
      const mismoMaestro = maestroId > 0 && otra.maestro_id === maestroId
      const t = talleres.find((x) => x.id === otra.taller_id)
      for (const h of horarios) {
        const lugarH = lugarDeHorario({ lugar }, h)
        for (const c of otra.horarios) {
          if (!rangosSeTraslapan(c, h)) continue
          const mismoLugar = Boolean(lugarH && norm(lugarH) === norm(lugarDeHorario(otra, c)))
          if (!mismoMaestro && !mismoLugar) continue
          const cuando = `${etiquetaDia(c.dia)} ${hora12(c.hora_inicio)} – ${hora12(c.hora_fin)}`
          out.push(
            mismoMaestro
              ? `El maestro ya tiene «${t ? nombreTallerCompleto(t) : 'otro taller'}» el ${cuando}.`
              : `«${lugarH}» está ocupado por «${t ? nombreTallerCompleto(t) : 'otro taller'}» el ${cuando}.`
          )
        }
      }
    }
    return [...new Set(out)]
  }, [asignaciones, asignacion, maestroId, lugar, horarios, talleres])

  const invalidos = horarios.some((h) => minutosDeHora(h.hora_fin) <= minutosDeHora(h.hora_inicio))
  const listo = tallerId > 0 && maestroId > 0 && horarios.length > 0 && !invalidos && conflictos.length === 0

  const guardar = async () => {
    const ok = await onGuardar({
      recurso: 'asignacion',
      id: asignacion?.id,
      taller_id: tallerId,
      maestro_id: maestroId,
      niveles,
      lugar,
      cupo,
      cupo_min: cupoMin,
      notas,
      horarios,
    })
    if (ok) onCerrar()
  }

  return (
    <TlModal
      abierto={abierto}
      ancho="amplio"
      titulo={asignacion ? 'Editar horario del taller' : 'Programar taller'}
      subtitulo="Elige taller y maestro, luego arma los días y horas de la semana."
      onCerrar={() => !guardando && onCerrar()}
      pie={
        <>
          <button type="button" className="tl-btn" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="button" className="tl-btn tl-btn-primary" onClick={() => void guardar()} disabled={guardando || !listo}>
            {guardando ? 'Guardando…' : asignacion ? 'Guardar cambios' : 'Programar'}
          </button>
        </>
      }
    >
      <div className="tl-asig">
        <div className="tl-form-grid">
          <Campo etiqueta="Taller *">
            <select className="tl-input" value={tallerId} onChange={(e) => cambiarTaller(Number(e.target.value))}>
              <option value={0}>Selecciona un taller…</option>
              {talleresOpciones.map((t) => (
                <option key={t.id} value={t.id}>{nombreTallerCompleto(t)}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Maestro *" ayuda={taller ? 'Solo se pueden elegir maestros que atienden los niveles del taller.' : undefined}>
            <select className="tl-input" value={maestroId} onChange={(e) => cambiarMaestro(Number(e.target.value))}>
              <option value={0}>Selecciona un maestro…</option>
              {maestrosOpciones.map(({ m, compatible }) => (
                <option key={m.id} value={m.id} disabled={!compatible}>
                  {nombreMaestroTaller(m)}{m.especialidad ? ` · ${m.especialidad}` : ''}{compatible ? '' : ' (otro nivel)'}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Niveles de este grupo" completo ayuda={taller ? 'Niveles en común entre el taller y el maestro.' : 'Primero elige el taller.'}>
            <NivelesChips valor={niveles} onChange={setNiveles} permitidos={nivelesComunes} disabled={!taller} />
          </Campo>
          <Campo etiqueta="Lugar" ayuda="Ej. Aula 20, Cancha 1. Si un día cambia, se ajusta abajo." completo>
            <input className="tl-input" value={lugar} maxLength={80} onChange={(e) => setLugar(e.target.value)} />
          </Campo>
          <Campo etiqueta="Cupo mínimo">
            <input className="tl-input" type="number" inputMode="numeric" min={1} value={cupoMin} onChange={(e) => setCupoMin(e.target.value)} />
          </Campo>
          <Campo etiqueta="Cupo máximo">
            <input className="tl-input" type="number" inputMode="numeric" min={1} value={cupo} onChange={(e) => setCupo(e.target.value)} />
          </Campo>
        </div>

        <div className="tl-semana-builder">
          <div className="tl-builder-head">
            <CalendarClock size={18} aria-hidden />
            <span>Días y horario</span>
          </div>
          <div className="tl-presets" role="group" aria-label="Repetir">
            {PRESETS.map((p) => (
              <button key={p.etiqueta} type="button" className="tl-preset" onClick={() => aplicarPreset(p.dias)}>
                {p.etiqueta}
              </button>
            ))}
          </div>
          <div className="tl-dias" role="group" aria-label="Días de la semana">
            {DIAS_TALLER.map((d) => {
              const activo = tramos.has(d.valor)
              return (
                <button key={d.valor} type="button" className="tl-dia" data-activo={activo || undefined}
                  aria-pressed={activo} aria-label={d.etiqueta} title={d.etiqueta} onClick={() => toggleDia(d.valor)}>
                  <span className="tl-dia-corto">{d.corto}</span>
                  <span className="tl-dia-largo">{d.etiqueta.slice(0, 3)}</span>
                </button>
              )
            })}
          </div>

          {horarios.length === 0 ? (
            <p className="tl-empty tl-empty-sm">Toca los días en que se imparte el taller.</p>
          ) : (
            <ul className="tl-tramos">
              {horarios.map((h, i) => {
                const t = { hora_inicio: h.hora_inicio, hora_fin: h.hora_fin }
                const malo = minutosDeHora(t.hora_fin) <= minutosDeHora(t.hora_inicio)
                return (
                  <li key={h.dia} className="tl-tramo" data-error={malo || undefined}>
                    <span className="tl-tramo-dia">{etiquetaDia(h.dia)}</span>
                    <input type="time" className="tl-input tl-time" step={300} value={t.hora_inicio}
                      aria-label={`Inicio ${etiquetaDia(h.dia)}`} onChange={(e) => setTramo(h.dia, 'hora_inicio', e.target.value)} />
                    <span className="tl-tramo-sep" aria-hidden>–</span>
                    <input type="time" className="tl-input tl-time" step={300} value={t.hora_fin}
                      aria-label={`Fin ${etiquetaDia(h.dia)}`} onChange={(e) => setTramo(h.dia, 'hora_fin', e.target.value)} />
                    <input className="tl-input tl-tramo-lugar" value={tramos.get(h.dia)?.lugar ?? ''} maxLength={80}
                      placeholder={lugar.trim() ? `${lugar.trim()} (igual)` : 'Lugar ese día'}
                      aria-label={`Lugar el ${etiquetaDia(h.dia)}`} onChange={(e) => setTramo(h.dia, 'lugar', e.target.value)} />
                    <span className="tl-tramo-dur">{duracion(t)}</span>
                    <span className="tl-tramo-acc">
                      {i === 0 && horarios.length > 1 ? (
                        <button type="button" className="tl-icon-btn" title="Usar este horario en todos los días" aria-label="Copiar horario a todos los días" onClick={() => copiarATodos(h.dia)}>
                          <Copy size={15} aria-hidden />
                        </button>
                      ) : null}
                      <button type="button" className="tl-icon-btn" aria-label={`Quitar ${etiquetaDia(h.dia)}`} onClick={() => toggleDia(h.dia)}>
                        <X size={15} aria-hidden />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {conflictos.length ? (
          <div className="tl-alerta" role="alert">
            <AlertTriangle size={16} aria-hidden />
            <ul>{conflictos.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        ) : null}

        {taller && horarios.length && !invalidos ? (
          <p className="tl-preview">
            <strong>{nombreTallerCompleto(taller)}:</strong> {resumenHorarios(horarios)}
          </p>
        ) : null}

        <Campo etiqueta="Notas" completo>
          <textarea className="tl-input tl-textarea" rows={2} value={notas} maxLength={2000} onChange={(e) => setNotas(e.target.value)} />
        </Campo>
      </div>
    </TlModal>
  )
}
