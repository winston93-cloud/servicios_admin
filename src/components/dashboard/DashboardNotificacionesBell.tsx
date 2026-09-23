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
  const [detalle, setDetalle] = useState<NotificacionEmpleado | null>(null)
  const [marcando, setMarcando] = useState(false)
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
    if (!abierto || detalle) return
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
  }, [abierto, detalle])

  async function abrirPanel() {
    const next = !abierto
    setAbierto(next)
    if (next) await fetchNotifs()
  }

  async function confirmarLectura(notif: NotificacionEmpleado) {
    const sessionRaw = readPortalSessionForFetch()
    if (!sessionRaw) return
    setMarcando(true)
    try {
      const res = await fetch('/api/notificaciones-empleado', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          [portalSessionHeaderName()]: sessionRaw,
        },
        body: JSON.stringify({ ids: [notif.id] }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        setRows((prev) => prev.filter((r) => r.id !== notif.id))
        setNoLeidas((n) => Math.max(0, n - 1))
      }
    } catch {
      /* ignore */
    } finally {
      setMarcando(false)
      setDetalle(null)
      setAbierto(false)
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
                  {rows.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="dash-notif-item-btn is-nueva"
                        onClick={() => {
                          setDetalle(r)
                          setAbierto(false)
                        }}
                      >
                        <div className="dash-notif-item-title">
                          <CheckCircle2 size={14} aria-hidden />
                          <span>{r.asunto}</span>
                        </div>
                        <p>{r.mensaje}</p>
                        <time dateTime={r.created_at}>{formatFecha(r.created_at)}</time>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  const modal =
    detalle && mounted
      ? createPortal(
          <div className="dash-notif-modal-layer" role="presentation">
            <button
              type="button"
              className="dash-notif-backdrop"
              aria-label="Cerrar detalle"
              disabled={marcando}
              onClick={() => void confirmarLectura(detalle)}
            />
            <div
              className="dash-notif-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dash-notif-modal-title"
            >
              <header>
                <h2 id="dash-notif-modal-title">{detalle.asunto}</h2>
                <button
                  type="button"
                  className="dash-notif-close"
                  disabled={marcando}
                  onClick={() => void confirmarLectura(detalle)}
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </header>
              <div className="dash-notif-modal-body">
                <p>{detalle.mensaje}</p>
                {detalle.cheque_numero ? (
                  <p className="dash-notif-meta">
                    Cheque <strong>{detalle.cheque_numero}</strong>
                    {detalle.devolucion_id ? (
                      <>
                        {' '}
                        · Folio devolución <strong>#{detalle.devolucion_id}</strong>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <time dateTime={detalle.created_at}>{formatFecha(detalle.created_at)}</time>
              </div>
              <footer>
                <button
                  type="button"
                  className="dash-notif-modal-ok"
                  disabled={marcando}
                  onClick={() => void confirmarLectura(detalle)}
                >
                  {marcando ? (
                    <Loader2 size={16} className="dash-notif-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 size={16} aria-hidden />
                  )}
                  Entendido
                </button>
              </footer>
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
      {modal}
    </div>
  )
}
