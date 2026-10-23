'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Bell, CheckCircle2, Clock, Loader2, X } from 'lucide-react'
import type { TeNotificacion } from '@/lib/teamEnglish/teNotificaciones'

function formatFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Campanita del portal de teachers: recordatorios de planeación (miércoles aviso, jueves urgente). */
export default function TeacherNotificacionesBell() {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [rows, setRows] = useState<TeNotificacion[]>([])
  const [simulado, setSimulado] = useState(false)
  const [marcandoId, setMarcandoId] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchNotifs = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/team-english/teacher/notificaciones', { cache: 'no-store' })
      const data = (await res.json()) as { ok?: boolean; rows?: TeNotificacion[]; simulado?: boolean }
      if (res.ok && data.ok) {
        setRows(data.rows ?? [])
        setSimulado(!!data.simulado)
      }
    } catch {
      /* ignore poll errors */
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void fetchNotifs()
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchNotifs()
    }, 60_000)
    return () => window.clearInterval(t)
  }, [fetchNotifs])

  useEffect(() => {
    if (!abierto) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAbierto(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto])

  async function abrirPanel() {
    const next = !abierto
    setAbierto(next)
    if (next) await fetchNotifs()
  }

  async function entendido(n: TeNotificacion) {
    setMarcandoId(n.id)
    try {
      const res = await fetch('/api/team-english/teacher/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      })
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== n.id))
    } catch {
      /* se queda en la lista */
    } finally {
      setMarcandoId(null)
    }
  }

  const noLeidas = rows.length
  const hayUrgente = rows.some((r) => r.urgencia === 'urgente')

  const panel =
    abierto && mounted
      ? createPortal(
          <div className="dash-notif-layer" role="presentation">
            <button type="button" className="dash-notif-backdrop" aria-label="Cerrar notificaciones" onClick={() => setAbierto(false)} />
            <div className="dash-notif-panel" role="dialog" aria-label="Notificaciones" ref={wrapRef}>
              <header className="dash-notif-panel-head">
                <strong>Notificaciones</strong>
                <button type="button" className="dash-notif-close" onClick={() => setAbierto(false)} aria-label="Cerrar">
                  <X size={16} />
                </button>
              </header>
              {simulado ? (
                <p className="dash-notif-empty te-notif-sim">Vista previa: «Entendido» solo la oculta aquí; la teacher la sigue viendo.</p>
              ) : null}
              {cargando && rows.length === 0 ? (
                <p className="dash-notif-empty">
                  <Loader2 size={16} className="dash-notif-spin" aria-hidden /> Cargando…
                </p>
              ) : rows.length === 0 ? (
                <p className="dash-notif-empty">No tienes notificaciones nuevas.</p>
              ) : (
                <ul className="dash-notif-list">
                  {rows.map((r) => {
                    const ocupado = marcandoId === r.id
                    return (
                      <li key={r.id}>
                        <div className="dash-notif-item-btn is-nueva te-notif-item" data-urgencia={r.urgencia}>
                          <div className="dash-notif-item-title">
                            {r.urgencia === 'urgente' ? <AlertTriangle size={14} aria-hidden /> : <Clock size={14} aria-hidden />}
                            <span>{r.asunto}</span>
                          </div>
                          <p>{r.mensaje}</p>
                          <time dateTime={r.created_at}>{formatFecha(r.created_at)}</time>
                          <button
                            type="button"
                            className="dash-notif-entendido"
                            disabled={ocupado}
                            onClick={() => (simulado ? setRows((prev) => prev.filter((x) => x.id !== r.id)) : void entendido(r))}
                          >
                            {ocupado ? <Loader2 size={14} className="dash-notif-spin" aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
                            Entendido
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div className="dash-notif">
      <button
        type="button"
        className="dash-notif-bell te-notif-bell"
        data-urgente={hayUrgente || undefined}
        onClick={() => void abrirPanel()}
        aria-expanded={abierto}
        aria-label={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'}
      >
        <Bell size={18} aria-hidden />
        {noLeidas > 0 ? <span className="dash-notif-badge">{noLeidas > 99 ? '99+' : noLeidas}</span> : null}
      </button>
      {panel}
    </div>
  )
}
