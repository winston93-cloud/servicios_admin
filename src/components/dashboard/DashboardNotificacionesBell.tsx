'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DashboardNotificacionesBell() {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [rows, setRows] = useState<NotificacionEmpleado[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

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

  async function abrir() {
    const next = !abierto
    setAbierto(next)
    if (!next) return

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
        const pendientes = Number(data.noLeidas) || 0
        setNoLeidas(pendientes)
        if (pendientes > 0) {
          await fetch('/api/notificaciones-empleado', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              [portalSessionHeaderName()]: sessionRaw,
            },
            body: JSON.stringify({}),
          })
          setNoLeidas(0)
          setRows((prev) => prev.map((r) => ({ ...r, leida: true })))
        }
      }
    } catch {
      /* ignore */
    } finally {
      setCargando(false)
    }
  }

  const badge = noLeidas > 99 ? '99+' : String(noLeidas)

  return (
    <div className="dash-notif" ref={wrapRef}>
      <button
        type="button"
        className="dash-notif-bell"
        onClick={() => void abrir()}
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

      {abierto ? (
        <div className="dash-notif-panel" role="dialog" aria-label="Notificaciones">
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
            <p className="dash-notif-empty">No tienes notificaciones.</p>
          ) : (
            <ul className="dash-notif-list">
              {rows.map((r) => (
                <li key={r.id} className={r.leida ? undefined : 'is-nueva'}>
                  <div className="dash-notif-item-title">
                    <CheckCircle2 size={14} aria-hidden />
                    <span>{r.asunto}</span>
                  </div>
                  <p>{r.mensaje}</p>
                  <time dateTime={r.created_at}>{formatFecha(r.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
