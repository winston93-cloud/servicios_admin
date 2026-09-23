'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Loader2,
  Search,
  Send,
  X,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import {
  portalSessionHeaderName,
  readPortalSessionForFetch,
} from '@/lib/insforgeDbProxyShared'
import type { UsuarioNotifItem } from '@/lib/notificacionEmpleadoService'
import './notificaciones.css'

export default function NotificacionesPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <NotificacionesView />
    </ProtectedRoute>
  )
}

function NotificacionesView() {
  const { user, session } = useAuth()
  const enviadoPor =
    user?.usuario_nombre_completo?.trim() ||
    user?.usuario_username?.trim() ||
    session?.usuario_username?.trim() ||
    ''

  const [destinatarios, setDestinatarios] = useState<UsuarioNotifItem[]>([])
  const [query, setQuery] = useState('')
  const [sugerencias, setSugerencias] = useState<UsuarioNotifItem[]>([])
  const [buscando, setBuscando] = useState(false)
  const [listaAbierta, setListaAbierta] = useState(false)
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err' | 'warn'; texto: string } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)

  const sessionHeaders = useCallback((): HeadersInit => {
    const raw = readPortalSessionForFetch()
    return raw ? { [portalSessionHeaderName()]: raw } : {}
  }, [])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setSugerencias([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    debounceRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/notificaciones-empleado/usuarios?q=${encodeURIComponent(q)}&limit=12`,
            { headers: sessionHeaders() }
          )
          const data = (await res.json()) as {
            ok?: boolean
            rows?: UsuarioNotifItem[]
            message?: string
          }
          if (!res.ok || !data.ok) throw new Error(data.message || 'Error al buscar')
          const ya = new Set(destinatarios.map((d) => d.usuario_id))
          setSugerencias((data.rows ?? []).filter((r) => !ya.has(r.usuario_id)))
          setListaAbierta(true)
        } catch (e) {
          setSugerencias([])
          setMsg({
            tipo: 'err',
            texto: e instanceof Error ? e.message : 'No se pudo buscar usuarios',
          })
        } finally {
          setBuscando(false)
        }
      })()
    }, 220)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query, destinatarios, sessionHeaders])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setListaAbierta(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function agregar(u: UsuarioNotifItem) {
    setDestinatarios((prev) =>
      prev.some((x) => x.usuario_id === u.usuario_id) ? prev : [...prev, u]
    )
    setQuery('')
    setSugerencias([])
    setListaAbierta(false)
    setMsg(null)
  }

  function quitar(id: number) {
    setDestinatarios((prev) => prev.filter((x) => x.usuario_id !== id))
  }

  async function enviar() {
    if (!destinatarios.length) {
      setMsg({ tipo: 'err', texto: 'Agrega al menos un destinatario.' })
      return
    }
    if (!asunto.trim() || !mensaje.trim()) {
      setMsg({ tipo: 'err', texto: 'Completa asunto y cuerpo del mensaje.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/notificaciones-empleado', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...sessionHeaders(),
        },
        body: JSON.stringify({
          usuarioIds: destinatarios.map((d) => d.usuario_id),
          asunto: asunto.trim(),
          mensaje: mensaje.trim(),
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        enviadas?: number
        correosOk?: number
        sinCorreo?: string[]
        errores?: string[]
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo enviar')
      }
      const extras: string[] = []
      if (data.sinCorreo?.length) {
        extras.push(`Sin correo: ${data.sinCorreo.join(', ')}`)
      }
      if (data.errores?.length) {
        extras.push(data.errores.slice(0, 3).join(' · '))
      }
      setMsg({
        tipo: extras.length ? 'warn' : 'ok',
        texto: `Enviado a ${data.enviadas} · correos OK ${data.correosOk}${
          extras.length ? ` · ${extras.join(' · ')}` : ''
        }`,
      })
      setDestinatarios([])
      setAsunto('')
      setMensaje('')
      setQuery('')
    } catch (e) {
      setMsg({
        tipo: 'err',
        texto: e instanceof Error ? e.message : 'Error al enviar',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="notif-page pos-totality-theme admin-app-shell">
      <div className="notif-bg" aria-hidden />
      <header className="notif-top">
        <Link href="/servicios" className="notif-back">
          <ArrowLeft size={18} aria-hidden />
          Servicios
        </Link>
        <ThemeToggle />
      </header>

      <main className="notif-main">
        <p className="notif-kicker">Comunicación · Empleados</p>
        <h1 className="notif-title">
          <Bell size={32} strokeWidth={1.6} aria-hidden />
          Notificaciones
        </h1>
        <p className="notif-lead">
          Elige destinatarios con búsqueda (como en Slack), escribe el aviso y se envía a la
          campanita del dashboard más un correo al correo institucional.
        </p>

        <section className="notif-form" aria-labelledby="notif-form-title">
          <h2 id="notif-form-title">Nueva notificación</h2>
          <p className="notif-meta">
            Envía: <strong>{enviadoPor || '—'}</strong>
          </p>

          <div className="notif-field" ref={wrapRef}>
            <span>Destinatarios</span>
            {destinatarios.length > 0 ? (
              <ul className="notif-chips" aria-label="Destinatarios seleccionados">
                {destinatarios.map((d) => (
                  <li key={d.usuario_id} className="notif-chip">
                    <div className="notif-chip-body">
                      <strong>{d.nombre}</strong>
                      <em>{d.email || 'Sin correo institucional'}</em>
                    </div>
                    <button
                      type="button"
                      className="notif-chip-x"
                      aria-label={`Quitar ${d.nombre}`}
                      onClick={() => quitar(d.usuario_id)}
                      disabled={busy}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="notif-search">
              <Search size={16} aria-hidden className="notif-search-icon" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (sugerencias.length) setListaAbierta(true)
                }}
                placeholder="Buscar por nombre, usuario o correo…"
                autoComplete="off"
                disabled={busy}
                aria-autocomplete="list"
                aria-expanded={listaAbierta}
              />
              {buscando ? (
                <Loader2 size={16} className="notif-spin notif-search-spin" aria-hidden />
              ) : null}
            </div>

            {listaAbierta && (sugerencias.length > 0 || (query.trim().length >= 2 && !buscando)) ? (
              <ul className="notif-suggest" role="listbox">
                {sugerencias.length === 0 ? (
                  <li className="notif-suggest-empty">Sin coincidencias</li>
                ) : (
                  sugerencias.map((u) => (
                    <li key={u.usuario_id}>
                      <button
                        type="button"
                        role="option"
                        onClick={() => agregar(u)}
                        disabled={busy}
                      >
                        <strong>{u.nombre}</strong>
                        <span>
                          {u.email || 'Sin correo'} · @{u.username}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          <label className="notif-field">
            <span>Asunto</span>
            <input
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              maxLength={200}
              placeholder="Ej. Recordatorio de junta administrativa"
              disabled={busy}
              autoComplete="off"
            />
          </label>

          <label className="notif-field">
            <span>Cuerpo del mensaje</span>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={7}
              maxLength={8000}
              placeholder="Escribe el aviso que verán en la campanita y en el correo…"
              disabled={busy}
            />
          </label>

          {msg ? (
            <p className={`notif-msg notif-msg--${msg.tipo}`} role="status">
              {msg.tipo === 'ok' ? <CheckCircle2 size={16} aria-hidden /> : null}
              {msg.texto}
            </p>
          ) : null}

          <button
            type="button"
            className="notif-btn primary"
            onClick={() => void enviar()}
            disabled={
              busy || !destinatarios.length || !asunto.trim() || !mensaje.trim()
            }
          >
            {busy ? (
              <Loader2 size={18} className="notif-spin" aria-hidden />
            ) : (
              <Send size={18} aria-hidden />
            )}
            Enviar notificación
          </button>
        </section>
      </main>
    </div>
  )
}
