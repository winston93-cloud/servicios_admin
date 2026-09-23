'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CheckCircle2, Loader2, X } from 'lucide-react'
import {
  portalSessionHeaderName,
  readPortalSessionForFetch,
} from '@/lib/insforgeDbProxyShared'
import type { NotificacionEmpleado } from '@/lib/notificacionEmpleadoService'

function formatFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DashboardNotificacionesBell() {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [rows, setRows] = useState<NotificacionEmpleado[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [marcandoId, setMarcandoId] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchNotifs = useCallback(async () => {
    const sessionRaw = readPortalSessionForFetch()
    if (!sessionRaw) return
    setCargando(true)
    try {
      const res = await fetch('/api/notificaciones-empleado', {
        headers: { [portalSessionHeaderName()]: sessionRaw },
      })
      const data = (await res.json()) as {
        ok?: boolean
        rows?: NotificacionEmpleado[]
        noLeidas?: number
      }
      if (res.ok && data.ok) {
        setRows(data.rows ?? [])
        setNoLeidas(Number(data.noLeidas) || 0)
      }
    } catch {
      /* ignore poll errors */
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void fetchNotifs()
    const t = window.setInterval(() => void fetchNotifs(), 45_000)
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

  /** Al abrir/ver la notificación: marcar leída + devolución → etapa 5 / historial. */
  async function abrirYCerrar(notif: NotificacionEmpleado) {
    const sessionRaw = readPortalSessionForFetch()
    if (!sessionRaw) return
    setMarcandoId(notif.id)
    try {
      const res = await fetch('/api/notificaciones-empleado', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          [portalSessionHeaderName()]: sessionRaw,
        },
        body: JSON.stringify({ ids: [notif.id] }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        console.warn('[notif] no se pudo marcar:', data.message)
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== notif.id))
      setNoLeidas((n) => Math.max(0, n - 1))
    } catch (e) {
      console.warn('[notif] error al marcar', e)
    } finally {
      setMarcandoId(null)
    }
  }

  const badge = noLeidas > 99 ? '99+' : String(noLeidas)

  const panel =
    abierto && mounted
      ? createPortal(
          <div className="dash-notif-layer" role="presentation">
            <button
              type="button"
              className="dash-notif-backdrop"
              aria-label="Cerrar notificaciones"
              onClick={() => setAbierto(false)}
            />
            <div
              className="dash-notif-panel"
              role="dialog"
              aria-label="Notificaciones"
              ref={wrapRef}
            >
              <header className="dash-notif-panel-head">
                <strong>Notificaciones</strong>
                <button
                  type="button"
                  className="dash-notif-close"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                >
                  <X size={16} />
                </button>
              </header>

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
                        <div className="dash-notif-item-btn is-nueva">
                          <div className="dash-notif-item-title">
                            <CheckCircle2 size={14} aria-hidden />
                            <span>{r.asunto}</span>
                          </div>
                          <p>{r.mensaje}</p>
                          <time dateTime={r.created_at}>{formatFecha(r.created_at)}</time>
                          <button
                            type="button"
                            className="dash-notif-entendido"
                            disabled={ocupado}
                            onClick={() => void abrirYCerrar(r)}
                          >
                            {ocupado ? (
                              <Loader2 size={14} className="dash-notif-spin" aria-hidden />
                            ) : (
                              <CheckCircle2 size={14} aria-hidden />
                            )}
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
        className="dash-notif-bell"
        onClick={() => void abrirPanel()}
        aria-expanded={abierto}
        aria-label={
          noLeidas > 0
            ? `Notificaciones, ${noLeidas} sin leer`
            : 'Notificaciones'
        }
      >
        <Bell size={18} aria-hidden />
        {noLeidas > 0 ? <span className="dash-notif-badge">{badge}</span> : null}
      </button>
      {panel}
    </div>
  )
}
