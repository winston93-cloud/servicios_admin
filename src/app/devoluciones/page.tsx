'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  ImagePlus,
  Loader2,
  Save,
  Undo2,
  X,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import type { DevolucionTarjeta } from '@/lib/devolucionesService'
import './devoluciones.css'

export default function DevolucionesPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <DevolucionesView />
    </ProtectedRoute>
  )
}

function DevolucionesView() {
  const { user, session } = useAuth()
  const realizadoPor =
    user?.usuario_nombre_completo?.trim() ||
    user?.usuario_username?.trim() ||
    session?.usuario_username?.trim() ||
    ''
  const usuarioId = user?.usuario_id ?? 0

  const [asunto, setAsunto] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('image/png')
  const [base64, setBase64] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err' | 'warn'; texto: string } | null>(null)
  const [historial, setHistorial] = useState<DevolucionTarjeta[]>([])
  const [cargandoHist, setCargandoHist] = useState(true)
  const zonaRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cargarHistorial = useCallback(async () => {
    setCargandoHist(true)
    try {
      const res = await fetch('/api/devoluciones')
      const data = (await res.json()) as { ok?: boolean; rows?: DevolucionTarjeta[]; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message || 'No se pudo cargar el historial')
      setHistorial(data.rows ?? [])
    } catch (e) {
      setMsg({
        tipo: 'err',
        texto: e instanceof Error ? e.message : 'Error al cargar historial',
      })
    } finally {
      setCargandoHist(false)
    }
  }, [])

  useEffect(() => {
    void cargarHistorial()
  }, [cargarHistorial])

  const aplicarArchivo = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMsg({ tipo: 'err', texto: 'Solo se aceptan imágenes (PNG, JPEG, WebP, GIF).' })
      return
    }
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
    const b64 = btoa(binary)
    setBase64(b64)
    setMimeType(file.type || 'image/png')
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setMsg(null)
  }, [])

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) void aplicarArchivo(file)
          return
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [aplicarArchivo])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function limpiarImagen() {
    setBase64('')
    setMimeType('image/png')
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  async function guardar() {
    if (!realizadoPor) {
      setMsg({
        tipo: 'err',
        texto: 'No se identificó al usuario de sesión. Vuelve a entrar desde el dashboard.',
      })
      return
    }
    if (!base64) {
      setMsg({ tipo: 'err', texto: 'Pega o sube el screenshot de la autorización de Slack.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asunto,
          realizadoPor,
          usuarioId: usuarioId || undefined,
          imagenBase64: base64,
          mimeType,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        row?: DevolucionTarjeta
      }
      if (!res.ok || !data.ok || !data.row) {
        throw new Error(data.message || 'No se pudo guardar')
      }
      setAsunto('')
      limpiarImagen()
      const slackOk = data.row.slack_ok
      setMsg({
        tipo: slackOk ? 'ok' : 'warn',
        texto: slackOk
          ? `Guardado folio #${data.row.id}. Aviso enviado a #avisos_devolucion.`
          : `Guardado folio #${data.row.id}. Historial OK, pero Slack falló: ${data.row.slack_error || 'sin detalle'}.`,
      })
      await cargarHistorial()
    } catch (e) {
      setMsg({
        tipo: 'err',
        texto: e instanceof Error ? e.message : 'Error al guardar',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="devoluciones-page pos-totality-theme admin-app-shell">
      <div className="devoluciones-bg" aria-hidden />
      <header className="devoluciones-top">
        <Link href="/dashboard" className="devoluciones-back">
          <ArrowLeft size={18} aria-hidden />
          Dashboard
        </Link>
        <ThemeToggle />
      </header>

      <main className="devoluciones-main">
        <p className="devoluciones-kicker">Pagos · Empleados Winston</p>
        <h1 className="devoluciones-title">
          <Undo2 size={34} strokeWidth={1.6} aria-hidden />
          Devoluciones
        </h1>
        <p className="devoluciones-lead">
          Registra la autorización de Slack cuando el papá se arrepiente de un pago con tarjeta
          (inscripción, colegiatura u otro concepto). Queda historial y se avisa a{' '}
          <strong>#avisos_devolucion</strong>.
        </p>

        <section className="devoluciones-form" aria-labelledby="dev-form-title">
          <h2 id="dev-form-title">Nueva devolución</h2>

          <label className="devoluciones-field">
            <span>
              Asunto <em>(opcional)</em>
            </span>
            <input
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej. Colegiatura septiembre — ref. 21847"
              maxLength={255}
              disabled={busy}
              autoComplete="off"
            />
          </label>

          <div className="devoluciones-meta-line">
            <span>
              Realiza: <strong>{realizadoPor || '—'}</strong>
            </span>
            <span>La fecha se registra al guardar</span>
          </div>

          <div
            ref={zonaRef}
            className={`devoluciones-paste${previewUrl ? ' has-preview' : ''}`}
            tabIndex={0}
            role="group"
            aria-label="Zona para pegar screenshot de autorización Slack"
            onDragOver={(e) => {
              e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) void aplicarArchivo(f)
            }}
          >
            {previewUrl ? (
              <div className="devoluciones-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Vista previa de autorización Slack" />
                <button
                  type="button"
                  className="devoluciones-clear-img"
                  onClick={limpiarImagen}
                  disabled={busy}
                  aria-label="Quitar imagen"
                >
                  <X size={16} aria-hidden />
                  Quitar
                </button>
              </div>
            ) : (
              <div className="devoluciones-paste-empty">
                <ClipboardPaste size={28} aria-hidden />
                <p>
                  Pega aquí el screenshot (<kbd>Ctrl</kbd>+<kbd>V</kbd> / <kbd>⌘</kbd>+
                  <kbd>V</kbd>) de la autorización en Slack
                </p>
                <button
                  type="button"
                  className="devoluciones-btn ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <ImagePlus size={16} aria-hidden />
                  O elegir archivo
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="devoluciones-file-hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void aplicarArchivo(f)
              }}
            />
          </div>

          {msg ? (
            <p className={`devoluciones-msg devoluciones-msg--${msg.tipo}`} role="status">
              {msg.tipo === 'ok' ? <CheckCircle2 size={16} aria-hidden /> : null}
              {msg.texto}
            </p>
          ) : null}

          <button
            type="button"
            className="devoluciones-btn primary"
            onClick={() => void guardar()}
            disabled={busy || !base64}
          >
            {busy ? <Loader2 size={18} className="devoluciones-spin" aria-hidden /> : <Save size={18} aria-hidden />}
            Guardar
          </button>
        </section>

        <section className="devoluciones-historial" aria-labelledby="dev-hist-title">
          <div className="devoluciones-hist-head">
            <h2 id="dev-hist-title">Historial</h2>
            <button
              type="button"
              className="devoluciones-btn ghost sm"
              onClick={() => void cargarHistorial()}
              disabled={cargandoHist}
            >
              Actualizar
            </button>
          </div>
          {cargandoHist ? (
            <p className="devoluciones-hist-empty">
              <Loader2 size={16} className="devoluciones-spin" aria-hidden /> Cargando…
            </p>
          ) : historial.length === 0 ? (
            <p className="devoluciones-hist-empty">Aún no hay devoluciones registradas.</p>
          ) : (
            <ul className="devoluciones-hist-list">
              {historial.map((r) => (
                <li key={r.id} className="devoluciones-hist-item">
                  <a
                    href={r.storage_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="devoluciones-hist-thumb"
                    title="Ver screenshot"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.storage_url} alt="" />
                  </a>
                  <div className="devoluciones-hist-body">
                    <header>
                      <strong>#{r.id}</strong>
                      <time dateTime={r.created_at}>{formatFecha(r.created_at)}</time>
                    </header>
                    <p className="devoluciones-hist-asunto">
                      {r.asunto.trim() || <em>Sin asunto</em>}
                    </p>
                    <p className="devoluciones-hist-meta">
                      {r.realizado_por}
                      {r.slack_ok ? (
                        <span className="devoluciones-badge ok">Slack OK</span>
                      ) : (
                        <span className="devoluciones-badge warn" title={r.slack_error || ''}>
                          Slack pendiente
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function formatFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
