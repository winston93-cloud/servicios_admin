'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  DOCUMENTOS_NI_MAX_BYTES,
  type DocumentoNiTipoId,
} from '@/lib/portalDocumentosNiTipos'

type RequisitoDoc = {
  id: DocumentoNiTipoId
  etiqueta: string
  descripcion: string
}

type SubidaTemp = {
  tipo: DocumentoNiTipoId
  etiqueta: string
  nombreArchivo: string
  storageKey: string
  storageUrl: string
  size: number
}

type EstadoDocumentos = {
  alumno: {
    alumnoId: number
    alumnoRef: number
    nombre: string
    nivel: number
    grado: number
    nivelEtiqueta: string
    gradoEtiqueta: string
  }
  ciclo: { valor: number; nombre: string }
  requisitos: RequisitoDoc[]
  correoDestino: string | null
  enviado: boolean
  envio: {
    id: number
    enviadoAt: string
    correoDestino: string
    documentos: { tipo: string; etiqueta: string; nombreArchivo: string }[]
  } | null
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function PortalDocumentosNiView() {
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [estado, setEstado] = useState<EstadoDocumentos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [subiendoId, setSubiendoId] = useState<DocumentoNiTipoId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [subidas, setSubidas] = useState<Partial<Record<DocumentoNiTipoId, SubidaTemp>>>({})
  const [locales, setLocales] = useState<Partial<Record<DocumentoNiTipoId, File>>>({})
  const [dragId, setDragId] = useState<DocumentoNiTipoId | null>(null)

  const cargar = useCallback(async () => {
    if (alumnoId == null) {
      setError('Sesión de alumno no válida.')
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal-inscripciones/documentos?alumnoId=${alumnoId}`)
      const data = await res.json()
      if (!res.ok) {
        setEstado(null)
        setError(data.error ?? 'No se pudo cargar la carga de documentos.')
      } else {
        setEstado(data as EstadoDocumentos)
      }
    } catch {
      setEstado(null)
      setError('Error de conexión al cargar documentos.')
    }
    setCargando(false)
  }, [alumnoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const requisitos = estado?.requisitos ?? []
  const cargados = useMemo(
    () => requisitos.filter((r) => Boolean(subidas[r.id])).length,
    [requisitos, subidas]
  )
  const listos = requisitos.length > 0 && cargados === requisitos.length
  const pct = requisitos.length
    ? Math.round((cargados / requisitos.length) * 100)
    : 0

  const quitar = (id: DocumentoNiTipoId) => {
    setOkMsg(null)
    setError(null)
    setLocales((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setSubidas((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const subirUno = async (id: DocumentoNiTipoId, file: File) => {
    if (alumnoId == null) return
    setOkMsg(null)
    setError(null)

    const esPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!esPdf) {
      setError('Solo se aceptan archivos PDF.')
      return
    }
    if (file.size > DOCUMENTOS_NI_MAX_BYTES) {
      setError(`Cada PDF puede pesar máximo ${DOCUMENTOS_NI_MAX_BYTES / (1024 * 1024)} MB.`)
      return
    }

    setLocales((prev) => ({ ...prev, [id]: file }))
    setSubiendoId(id)
    try {
      const fd = new FormData()
      fd.set('alumnoId', String(alumnoId))
      fd.set('tipo', id)
      fd.set('archivo', file)
      const res = await fetch('/api/portal-inscripciones/documentos', {
        method: 'PUT',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        quitar(id)
        setError(data.error ?? 'No se pudo subir el PDF.')
      } else {
        setSubidas((prev) => ({ ...prev, [id]: data.subida as SubidaTemp }))
      }
    } catch {
      quitar(id)
      setError('Error de conexión al subir el PDF.')
    }
    setSubiendoId(null)
  }

  const enviar = async () => {
    if (alumnoId == null || !listos) return
    setEnviando(true)
    setError(null)
    setOkMsg(null)
    try {
      const payload = {
        alumnoId,
        subidas: requisitos.map((r) => subidas[r.id]).filter(Boolean),
      }
      const res = await fetch('/api/portal-inscripciones/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudieron enviar los documentos.')
      } else {
        setSubidas({})
        setLocales({})
        setOkMsg(
          `Documentos enviados a ${data.envio?.correoDestino ?? 'control escolar'}.`
        )
        await cargar()
      }
    } catch {
      setError('Error de conexión al enviar los documentos.')
    }
    setEnviando(false)
  }

  const refFmt = String(estado?.alumno.alumnoRef ?? session?.alumno_ref ?? '').padStart(5, '0')

  return (
    <div className="dashboard-container dashboard-home portal-inscripciones-page portal-docs-page">
      <div className="dashboard-home-bg" aria-hidden />
      <div className="dashboard-main portal-inscripciones-main portal-inscripciones-main--form">
        <header className="portal-docs-head">
          <Link href="/portal-inscripciones" className="servicios-back-btn">
            <ArrowLeft size={16} aria-hidden />
            Volver al proceso
          </Link>
        </header>

        {cargando && !estado && (
          <div className="portal-inscripciones-estado" role="status">
            <RefreshCw size={20} className="portal-inscripciones-spin" aria-hidden />
            Cargando expediente…
          </div>
        )}

        {error && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--error" role="alert">
            {error}
          </div>
        )}

        {okMsg && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--aviso" role="status">
            <CheckCircle2 size={18} aria-hidden />
            {okMsg}
          </div>
        )}

        {estado && (
          <>
            <section className="portal-docs-hero" aria-labelledby="portal-docs-titulo">
              <div className="portal-docs-hero-copy">
                <p className="portal-docs-eyebrow">Paso 04 · Nuevo ingreso</p>
                <h1 id="portal-docs-titulo" className="portal-docs-titulo">
                  Expediente digital
                </h1>
                <p className="portal-docs-lead">
                  Adjunta cada PDF. Cuando estén listos, se envían a control escolar de tu nivel.
                </p>
                <div className="portal-docs-alumno">
                  <span className="portal-docs-alumno-nombre">{estado.alumno.nombre}</span>
                  <span className="portal-docs-alumno-meta">
                    No. {refFmt} · {estado.alumno.gradoEtiqueta || estado.alumno.nivelEtiqueta} ·
                    Ciclo {estado.ciclo.nombre}
                  </span>
                </div>
              </div>

              <div className="portal-docs-progreso" aria-label="Avance de carga">
                <div
                  className="portal-docs-progreso-ring"
                  style={{ '--pd-pct': pct } as CSSProperties}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="portal-docs-progreso-inner">
                    <span className="portal-docs-progreso-num">
                      {cargados}/{requisitos.length}
                    </span>
                    <span className="portal-docs-progreso-lbl">listos</span>
                  </div>
                </div>
                <div className="portal-docs-progreso-side">
                  <p className="portal-docs-progreso-title">
                    {listos ? 'Todo listo para enviar' : 'Completa tu expediente'}
                  </p>
                  <div className="portal-docs-progreso-bar" aria-hidden>
                    <div
                      className="portal-docs-progreso-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {estado.correoDestino && (
                    <p className="portal-docs-progreso-mail">
                      <Mail size={14} aria-hidden />
                      {estado.correoDestino}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {estado.enviado && estado.envio && (
              <div className="portal-docs-enviado" role="status">
                <ShieldCheck size={22} aria-hidden />
                <div>
                  <p className="portal-docs-enviado-titulo">Expediente ya enviado</p>
                  <p className="portal-docs-enviado-desc">
                    Último envío el {fmtFecha(estado.envio.enviadoAt)} a{' '}
                    {estado.envio.correoDestino}. Puedes volver a cargar y reenviar si hace falta.
                  </p>
                </div>
              </div>
            )}

            <ol className="portal-docs-lista">
              {requisitos.map((req, idx) => {
                const file = locales[req.id]
                const subida = subidas[req.id]
                const inputId = `doc-ni-${req.id}`
                const ocupado = subiendoId === req.id
                const estadoItem = ocupado ? 'subiendo' : subida ? 'listo' : 'pendiente'

                return (
                  <li
                    key={req.id}
                    className={`portal-docs-item portal-docs-item--${estadoItem}`}
                    style={{ animationDelay: `${idx * 45}ms` }}
                  >
                    <div className="portal-docs-item-indice" aria-hidden>
                      {subida && !ocupado ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <span>{String(idx + 1).padStart(2, '0')}</span>
                      )}
                    </div>

                    <div className="portal-docs-item-cuerpo">
                      <div className="portal-docs-item-cabecera">
                        <div>
                          <h2 className="portal-docs-item-titulo">{req.etiqueta}</h2>
                          <p className="portal-docs-item-desc">{req.descripcion}</p>
                        </div>
                        <span className={`portal-docs-chip portal-docs-chip--${estadoItem}`}>
                          {ocupado ? 'Subiendo' : subida ? 'Listo' : 'Pendiente'}
                        </span>
                      </div>

                      <input
                        id={inputId}
                        className="portal-docs-file-input"
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={ocupado || enviando}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void subirUno(req.id, f)
                          e.target.value = ''
                        }}
                      />

                      <div className="portal-docs-item-accion">
                        <label
                          htmlFor={inputId}
                          className={`portal-docs-dropzone${subida ? ' has-file' : ''}${
                            dragId === req.id ? ' is-dragging' : ''
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragId(req.id)
                          }}
                          onDragLeave={() => setDragId(null)}
                          onDrop={(e) => {
                            e.preventDefault()
                            setDragId(null)
                            const f = e.dataTransfer.files?.[0]
                            if (f) void subirUno(req.id, f)
                          }}
                        >
                          {ocupado ? (
                            <>
                              <Loader2 size={22} className="portal-inscripciones-spin" aria-hidden />
                              <span className="portal-docs-dropzone-name">Subiendo PDF…</span>
                              <span className="portal-docs-dropzone-meta">Un momento</span>
                            </>
                          ) : subida ? (
                            <>
                              <FileText size={22} aria-hidden />
                              <span className="portal-docs-dropzone-name">
                                {file?.name ?? subida.nombreArchivo}
                              </span>
                              <span className="portal-docs-dropzone-meta">
                                {fmtBytes(file?.size ?? subida.size)} · toca para reemplazar
                              </span>
                            </>
                          ) : (
                            <>
                              <FileUp size={22} aria-hidden />
                              <span className="portal-docs-dropzone-name">
                                Elegir o soltar PDF
                              </span>
                              <span className="portal-docs-dropzone-meta">
                                Solo PDF · máx. {DOCUMENTOS_NI_MAX_BYTES / (1024 * 1024)} MB
                              </span>
                            </>
                          )}
                        </label>

                        {subida && !ocupado && (
                          <button
                            type="button"
                            className="portal-docs-quitar"
                            onClick={() => quitar(req.id)}
                            aria-label={`Quitar ${req.etiqueta}`}
                          >
                            <Trash2 size={15} aria-hidden />
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className={`portal-docs-footer${listos ? ' is-ready' : ''}`}>
              <div className="portal-docs-footer-copy">
                <p className="portal-docs-footer-title">
                  {listos
                    ? 'Expediente completo'
                    : `Faltan ${requisitos.length - cargados} documento${
                        requisitos.length - cargados === 1 ? '' : 's'
                      }`}
                </p>
                <p className="portal-docs-footer-hint">
                  {listos
                    ? 'Al enviar, control escolar recibe los PDF por correo.'
                    : 'Sube cada archivo para habilitar el envío.'}
                </p>
              </div>
              <button
                type="button"
                className="portal-docs-btn-enviar"
                disabled={!listos || enviando || subiendoId != null}
                onClick={() => void enviar()}
              >
                {enviando ? (
                  <>
                    <Loader2 size={18} className="portal-inscripciones-spin" aria-hidden />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send size={18} aria-hidden />
                    {estado.enviado ? 'Reenviar expediente' : 'Enviar a control escolar'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
