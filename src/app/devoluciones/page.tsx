'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  FileUp,
  ImagePlus,
  Loader2,
  Paperclip,
  Save,
  Send,
  Undo2,
  X,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import {
  DEVOLUCION_ETAPAS_TOTAL,
  type DevolucionTarjeta,
} from '@/lib/devolucionesService'
import CelebracionConfetiFuegos from '@/components/devoluciones/CelebracionConfetiFuegos'
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
  const [busyId, setBusyId] = useState<number | null>(null)
  const [celebra, setCelebra] = useState<{ cheque: number; folio: number } | null>(null)
  const [pestana, setPestana] = useState<'proceso' | 'historial'>('proceso')
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

  async function subirAdjuntos(devolucionId: number, files: FileList | null) {
    if (!files?.length) return
    if (!realizadoPor) {
      setMsg({ tipo: 'err', texto: 'No se identificó al usuario de sesión.' })
      return
    }
    setBusyId(devolucionId)
    setMsg(null)
    try {
      const archivos = []
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} supera 5 MB.`)
        }
        const b64 = await fileToBase64(file)
        archivos.push({
          nombre: file.name,
          mimeType: file.type || 'application/pdf',
          base64: b64,
        })
      }
      const res = await fetch(`/api/devoluciones/${devolucionId}/adjuntos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realizadoPor, archivos }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        row?: DevolucionTarjeta
      }
      if (!res.ok || !data.ok || !data.row) {
        throw new Error(data.message || 'No se pudieron subir los archivos')
      }
      setHistorial((prev) => prev.map((x) => (x.id === data.row!.id ? data.row! : x)))
      setMsg({
        tipo: 'ok',
        texto: `Folio #${devolucionId}: ${archivos.length} archivo(s) adjunto(s).`,
      })
    } catch (e) {
      setMsg({
        tipo: 'err',
        texto: e instanceof Error ? e.message : 'Error al adjuntar',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function enviarAdmvo(devolucionId: number) {
    if (!realizadoPor) {
      setMsg({ tipo: 'err', texto: 'No se identificó al usuario de sesión.' })
      return
    }
    setBusyId(devolucionId)
    setMsg(null)
    try {
      const res = await fetch(`/api/devoluciones/${devolucionId}/enviar-admvo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realizadoPor }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        row?: DevolucionTarjeta
      }
      if (!res.ok || !data.ok || !data.row) {
        throw new Error(data.message || 'No se pudo enviar a administración')
      }
      setHistorial((prev) => prev.map((x) => (x.id === data.row!.id ? data.row! : x)))
      setMsg({
        tipo: 'ok',
        texto: `Folio #${devolucionId} enviado a #devolucion_admvo · etapa 2/${DEVOLUCION_ETAPAS_TOTAL}.`,
      })
    } catch (e) {
      setMsg({
        tipo: 'err',
        texto: e instanceof Error ? e.message : 'Error al enviar Slack admvo',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function completarDevolucion(devolucionId: number) {
    if (!realizadoPor) {
      setMsg({ tipo: 'err', texto: 'No se identificó al usuario de sesión.' })
      return
    }
    setBusyId(devolucionId)
    setMsg(null)
    try {
      const res = await fetch(`/api/devoluciones/${devolucionId}/completar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realizadoPor }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        row?: DevolucionTarjeta
      }
      if (!res.ok || !data.ok || !data.row) {
        throw new Error(data.message || 'No se pudo completar la devolución')
      }
      setHistorial((prev) => prev.map((x) => (x.id === data.row!.id ? data.row! : x)))
      setCelebra({
        folio: devolucionId,
        cheque: Number(data.row.cheque_numero) || 0,
      })
      setMsg({
        tipo: 'ok',
        texto: `Folio #${devolucionId}: cheque firmado · etapa 4/${DEVOLUCION_ETAPAS_TOTAL}.`,
      })
    } catch (e) {
      setMsg({
        tipo: 'err',
        texto: e instanceof Error ? e.message : 'Error al completar devolución',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="devoluciones-page pos-totality-theme admin-app-shell">
      <CelebracionConfetiFuegos
        open={celebra != null}
        titulo={
          celebra?.cheque
            ? `¡Cheque ${celebra.cheque} firmado!`
            : '¡Devolución completada!'
        }
        subtitulo={
          celebra
            ? `Folio #${celebra.folio} · Ya puedes avisar a papá/mamá que pase por el cheque.`
            : undefined
        }
        onClose={() => setCelebra(null)}
      />
      <div className="devoluciones-bg" aria-hidden />
      <header className="devoluciones-top">
        <Link href="/dashboard" className="devoluciones-back">
          <ArrowLeft size={18} aria-hidden />
          Dashboard
        </Link>
        <ThemeToggle />
      </header>

      <main className="devoluciones-main">
        <div className="devoluciones-intro">
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
        </div>

        <div className="devoluciones-columns">
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
            <h2 id="dev-hist-title">Devoluciones</h2>
            <button
              type="button"
              className="devoluciones-btn ghost sm"
              onClick={() => void cargarHistorial()}
              disabled={cargandoHist}
            >
              Actualizar
            </button>
          </div>

          <div className="devoluciones-tabs" role="tablist" aria-label="Vista de devoluciones">
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'proceso'}
              className={`devoluciones-tab${pestana === 'proceso' ? ' is-active' : ''}`}
              onClick={() => setPestana('proceso')}
            >
              En proceso
              <span className="devoluciones-tab-count">
                {historial.filter((r) => r.etapa < 5).length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'historial'}
              className={`devoluciones-tab${pestana === 'historial' ? ' is-active' : ''}`}
              onClick={() => setPestana('historial')}
            >
              Historial
              <span className="devoluciones-tab-count">
                {historial.filter((r) => r.etapa >= 5).length}
              </span>
            </button>
          </div>

          {cargandoHist ? (
            <p className="devoluciones-hist-empty">
              <Loader2 size={16} className="devoluciones-spin" aria-hidden /> Cargando…
            </p>
          ) : (() => {
              const lista =
                pestana === 'historial'
                  ? historial.filter((r) => r.etapa >= 5)
                  : historial.filter((r) => r.etapa < 5)
              if (lista.length === 0) {
                return (
                  <p className="devoluciones-hist-empty">
                    {pestana === 'historial'
                      ? 'Aún no hay devoluciones cerradas en historial.'
                      : 'No hay devoluciones en proceso.'}
                  </p>
                )
              }
              return (
            <ul className="devoluciones-hist-list">
              {lista.map((r) => {
                const ocupado = busyId === r.id
                const enEtapa1 = r.etapa === 1
                const cerrada = r.etapa >= 5
                return (
                  <li key={r.id} className="devoluciones-hist-item">
                    <div className="devoluciones-hist-body">
                      <header>
                        <strong>#{r.id}</strong>
                        <span className="devoluciones-etapa" title="Etapa del proceso">
                          Etapa {r.etapa} / {DEVOLUCION_ETAPAS_TOTAL}
                        </span>
                        <time dateTime={r.created_at}>{formatFecha(r.created_at)}</time>
                      </header>
                      <p className="devoluciones-hist-asunto">
                        {r.asunto.trim() || <em>Sin asunto</em>}
                      </p>
                      <p className="devoluciones-hist-meta">
                        {r.realizado_por}
                        {r.slack_ok ? (
                          <span className="devoluciones-badge ok">Slack avisos OK</span>
                        ) : (
                          <span className="devoluciones-badge warn" title={r.slack_error || ''}>
                            Slack avisos pendiente
                          </span>
                        )}
                        {r.etapa >= 2 ? (
                          <span className="devoluciones-badge ok">Admvo OK</span>
                        ) : null}
                        {cerrada ? (
                          <span className="devoluciones-badge ok">Cerrada</span>
                        ) : null}
                      </p>

                      {(r.adjuntos?.length ?? 0) > 0 ? (
                        <div className="devoluciones-adjuntos-preview">
                          {r.adjuntos.map((a) => {
                            const esImg = String(a.mime_type || '').startsWith('image/')
                            const esPdf =
                              String(a.mime_type || '').includes('pdf') ||
                              /\.pdf$/i.test(a.nombre_archivo || '')
                            return (
                              <div key={a.id} className="devoluciones-adjunto-card">
                                {esImg ? (
                                  <a
                                    href={a.storage_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="devoluciones-adjunto-img"
                                    title={a.nombre_archivo}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={a.storage_url} alt={a.nombre_archivo} />
                                  </a>
                                ) : esPdf ? (
                                  <a
                                    href={a.storage_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="devoluciones-adjunto-pdf"
                                    title={a.nombre_archivo}
                                  >
                                    <span className="devoluciones-adjunto-pdf-label">PDF</span>
                                    <span className="devoluciones-adjunto-pdf-name">
                                      {a.nombre_archivo}
                                    </span>
                                  </a>
                                ) : (
                                  <a
                                    href={a.storage_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="devoluciones-adjunto-file"
                                  >
                                    <Paperclip size={16} aria-hidden />
                                    {a.nombre_archivo}
                                  </a>
                                )}
                                <div className="devoluciones-adjunto-meta">
                                  <a
                                    href={a.storage_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {a.nombre_archivo}
                                  </a>
                                  <span>{formatBytes(a.bytes)}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}

                      {r.storage_url ? (
                        <ul className="devoluciones-adjuntos">
                          <li>
                            <a
                              href={r.storage_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Paperclip size={12} aria-hidden />
                              Screenshot autorización
                            </a>
                          </li>
                        </ul>
                      ) : null}

                      {!cerrada && enEtapa1 ? (
                        <div className="devoluciones-etapa1-actions">
                          <label className="devoluciones-btn ghost sm devoluciones-file-label">
                            {ocupado ? (
                              <Loader2 size={14} className="devoluciones-spin" aria-hidden />
                            ) : (
                              <FileUp size={14} aria-hidden />
                            )}
                            Adjuntar PDF / factura
                            <input
                              type="file"
                              multiple
                              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                              disabled={ocupado}
                              className="devoluciones-file-hidden"
                              onChange={(e) => {
                                void subirAdjuntos(r.id, e.target.files)
                                e.target.value = ''
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="devoluciones-btn danger sm"
                            disabled={ocupado || !(r.adjuntos?.length > 0)}
                            title={
                              r.adjuntos?.length
                                ? 'Enviar a #devolucion_admvo y pasar a etapa 2'
                                : 'Primero adjunta al menos un archivo'
                            }
                            onClick={() => void enviarAdmvo(r.id)}
                          >
                            {ocupado ? (
                              <Loader2 size={14} className="devoluciones-spin" aria-hidden />
                            ) : (
                              <Send size={14} aria-hidden />
                            )}
                            Enviar Slack
                          </button>
                        </div>
                      ) : null}

                      {!cerrada &&
                      r.cheque_numero &&
                      r.cheque_firma_status === 'pendiente_firma' ? (
                        <div className="devoluciones-cheque-banner pendiente">
                          <p>
                            Cheque {r.cheque_numero}
                            {r.cheque_entidad === 'educativo'
                              ? ' (Educativo)'
                              : r.cheque_entidad === 'winston'
                                ? ' (Winston)'
                                : ''}
                            , Impreso, Pendiente Firma
                          </p>
                          <button
                            type="button"
                            className="devoluciones-btn danger sm"
                            disabled={ocupado}
                            onClick={() => void completarDevolucion(r.id)}
                          >
                            {ocupado ? (
                              <Loader2 size={14} className="devoluciones-spin" aria-hidden />
                            ) : (
                              <CheckCircle2 size={14} aria-hidden />
                            )}
                            Completar Devolución
                          </button>
                        </div>
                      ) : null}

                      {!cerrada &&
                      r.cheque_numero &&
                      r.cheque_firma_status === 'firmado' ? (
                        <div className="devoluciones-cheque-banner firmado">
                          <p>Cheque {r.cheque_numero} Firmado</p>
                          <button type="button" className="devoluciones-btn success sm" disabled>
                            <CheckCircle2 size={14} aria-hidden />
                            Completado
                          </button>
                        </div>
                      ) : null}

                      {cerrada && r.cheque_numero ? (
                        <div className="devoluciones-cheque-banner firmado">
                          <p>
                            Cheque {r.cheque_numero} Firmado · Folio cerrado (5/
                            {DEVOLUCION_ETAPAS_TOTAL})
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
              )
            })()}
        </section>
        </div>
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const b64 = result.includes(',') ? result.split(',')[1]! : result
      resolve(b64)
    }
    reader.readAsDataURL(file)
  })
}
