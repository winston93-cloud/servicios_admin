'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { NIVELES_ESCOLARES_OPCIONES } from '@/lib/nivelEscolar'

type ReglamentoFila = {
  id: number
  nivel: number
  ciclo_valor: number
  storage_key: string
  storage_url: string
  nombre_archivo: string | null
  updated_at: string
  etiqueta: string
  href: string
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ReglamentosEscolaresModulo() {
  const { cicloSeleccionado, cicloActualSistema, opcionesCatalogo } = useCicloEscolar()
  const [ciclo, setCiclo] = useState<number | null>(null)
  const [nivel, setNivel] = useState(1)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [lista, setLista] = useState<ReglamentoFila[]>([])
  const [cargando, setCargando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminandoNivel, setEliminandoNivel] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cicloId = useId()
  const nivelId = useId()
  const fileId = useId()

  const cicloEfectivo = ciclo ?? cicloSeleccionado ?? cicloActualSistema ?? null

  const cargar = useCallback(async (cicloValor: number) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/reglamentos?ciclo=${cicloValor}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        setLista([])
        return
      }
      setLista((data.reglamentos ?? []) as ReglamentoFila[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
      setLista([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (cicloEfectivo == null) return
    cargar(cicloEfectivo)
  }, [cicloEfectivo, cargar])

  const tomarArchivo = (file: File | null | undefined) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se aceptan archivos PDF.')
      return
    }
    setError(null)
    setArchivo(file)
  }

  const onSubir = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (cicloEfectivo == null) {
      setError('Selecciona un ciclo escolar.')
      return
    }
    if (!archivo) {
      setError('Selecciona un PDF.')
      return
    }

    setSubiendo(true)
    setMensaje(null)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('nivel', String(nivel))
      fd.set('ciclo', String(cicloEfectivo))
      fd.set('archivo', archivo)
      const res = await fetch('/api/reglamentos', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir el reglamento')
        return
      }
      setMensaje(
        `Reglamento de ${data.reglamento?.etiqueta ?? 'nivel'} cargado para el ciclo ${cicloEfectivo}.`
      )
      setArchivo(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await cargar(cicloEfectivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setSubiendo(false)
    }
  }

  const onEliminar = async (fila: ReglamentoFila) => {
    if (
      !window.confirm(
        `¿Eliminar el reglamento de ${fila.etiqueta} (ciclo ${fila.ciclo_valor})?`
      )
    ) {
      return
    }
    setEliminandoNivel(fila.nivel)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch(
        `/api/reglamentos?nivel=${fila.nivel}&ciclo=${fila.ciclo_valor}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo eliminar')
        return
      }
      setMensaje('Reglamento eliminado.')
      if (cicloEfectivo != null) await cargar(cicloEfectivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setEliminandoNivel(null)
    }
  }

  const porNivel = new Map(lista.map((r) => [r.nivel, r]))
  const publicados = lista.length
  const pendientes = NIVELES_ESCOLARES_OPCIONES.length - publicados

  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Reglamentos escolares</h1>
        <p className="servicios-panel-lead">
          Sube un PDF por nivel (reglamento + carta compromiso). El portal de inscripciones lo
          muestra en el paso «Reglamento escolar».
        </p>
      </header>

      <div className="reglamentos-layout">
        <section className="ciclos-crud-form-card reglamentos-upload-card" aria-labelledby="reglamentos-form-titulo">
          <h2 id="reglamentos-form-titulo" className="ciclos-crud-form-title">
            Subir PDF
          </h2>

          <form className="ciclos-crud-form" onSubmit={onSubir}>
            <div className="ciclos-crud-field-row">
              <div className="ciclos-crud-field">
                <label htmlFor={cicloId}>Ciclo escolar</label>
                <select
                  id={cicloId}
                  value={cicloEfectivo ?? ''}
                  onChange={(e) => setCiclo(Number(e.target.value))}
                  required
                >
                  <option value="" disabled>
                    Selecciona ciclo
                  </option>
                  {opcionesCatalogo.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ciclos-crud-field">
                <label htmlFor={nivelId}>Nivel</label>
                <select
                  id={nivelId}
                  value={nivel}
                  onChange={(e) => setNivel(Number(e.target.value))}
                >
                  {NIVELES_ESCOLARES_OPCIONES.map((n) => (
                    <option key={n.valor} value={n.valor}>
                      {n.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ciclos-crud-field">
              <span className="reglamentos-file-label" id={`${fileId}-label`}>
                Archivo PDF
              </span>
              <p className="reglamentos-file-hint">
                Un solo archivo con el reglamento y la carta compromiso. Máximo 15 MB.
              </p>

              <input
                ref={fileInputRef}
                id={fileId}
                name="archivo"
                type="file"
                accept="application/pdf,.pdf"
                className="reglamentos-file-input"
                aria-labelledby={`${fileId}-label`}
                onChange={(e) => tomarArchivo(e.target.files?.[0])}
              />

              <button
                type="button"
                className={`reglamentos-dropzone${arrastrando ? ' is-dragging' : ''}${archivo ? ' has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setArrastrando(true)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setArrastrando(false)
                  tomarArchivo(e.dataTransfer.files?.[0])
                }}
              >
                {archivo ? (
                  <>
                    <FileText size={28} aria-hidden />
                    <span className="reglamentos-dropzone-name">{archivo.name}</span>
                    <span className="reglamentos-dropzone-meta">
                      {formatearTamano(archivo.size)} · clic para cambiar
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={28} aria-hidden />
                    <span className="reglamentos-dropzone-name">
                      Arrastra el PDF aquí o haz clic para elegir
                    </span>
                    <span className="reglamentos-dropzone-meta">Solo PDF</span>
                  </>
                )}
              </button>
            </div>

            {mensaje ? (
              <p className="ciclos-crud-msg ciclos-crud-msg--ok" role="status">
                {mensaje}
              </p>
            ) : null}
            {error ? (
              <p className="ciclos-crud-msg ciclos-crud-msg--error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="ciclos-crud-form-actions">
              <button
                type="submit"
                className="ciclos-crud-btn ciclos-crud-btn--primary"
                disabled={subiendo || !archivo || cicloEfectivo == null}
              >
                {subiendo ? (
                  <>
                    <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
                    Subiendo…
                  </>
                ) : (
                  <>
                    <Upload size={18} aria-hidden />
                    Cargar reglamento
                  </>
                )}
              </button>
              {archivo ? (
                <button
                  type="button"
                  className="ciclos-crud-btn ciclos-crud-btn--ghost"
                  disabled={subiendo}
                  onClick={() => {
                    setArchivo(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  Quitar archivo
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="ciclos-crud-table-card reglamentos-list-card" aria-labelledby="reglamentos-lista-titulo">
          <div className="ciclos-crud-table-header">
            <h2 id="reglamentos-lista-titulo" className="ciclos-crud-form-title">
              Publicados
              {cicloEfectivo != null ? ` · ciclo ${cicloEfectivo}` : ''}
            </h2>
            {!cargando && cicloEfectivo != null ? (
              <p className="reglamentos-list-summary">
                {publicados} de {NIVELES_ESCOLARES_OPCIONES.length} niveles
                {pendientes > 0 ? ` · faltan ${pendientes}` : ''}
              </p>
            ) : null}
          </div>

          {cargando ? (
            <p className="ciclos-crud-loading">
              <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
              Cargando…
            </p>
          ) : (
            <ul className="reglamentos-nivel-grid">
              {NIVELES_ESCOLARES_OPCIONES.map((n) => {
                const fila = porNivel.get(n.valor)
                return (
                  <li
                    key={n.valor}
                    className={`reglamentos-nivel-card${fila ? ' is-ready' : ''}`}
                  >
                    <div className="reglamentos-nivel-card-top">
                      <span className="reglamentos-nivel-name">{n.etiqueta}</span>
                      {fila ? (
                        <span className="reglamentos-nivel-badge reglamentos-nivel-badge--ok">
                          <CheckCircle2 size={14} aria-hidden />
                          Publicado
                        </span>
                      ) : (
                        <span className="reglamentos-nivel-badge">Pendiente</span>
                      )}
                    </div>

                    {fila ? (
                      <>
                        <p className="reglamentos-nivel-file" title={fila.nombre_archivo ?? undefined}>
                          <FileText size={15} aria-hidden />
                          {fila.nombre_archivo ?? 'reglamento.pdf'}
                        </p>
                        <p className="reglamentos-nivel-date">
                          Actualizado{' '}
                          {new Date(fila.updated_at).toLocaleString('es-MX', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                        <div className="reglamentos-nivel-actions">
                          <a
                            className="ciclos-crud-btn ciclos-crud-btn--secondary"
                            href={fila.href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver PDF
                            <ExternalLink size={14} aria-hidden />
                          </a>
                          <button
                            type="button"
                            className="ciclos-crud-icon-btn ciclos-crud-icon-btn--danger"
                            disabled={eliminandoNivel === fila.nivel}
                            onClick={() => onEliminar(fila)}
                            title="Eliminar"
                            aria-label={`Eliminar reglamento de ${n.etiqueta}`}
                          >
                            {eliminandoNivel === fila.nivel ? (
                              <Loader2 size={14} className="ciclos-crud-spin" aria-hidden />
                            ) : (
                              <Trash2 size={14} aria-hidden />
                            )}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="reglamentos-nivel-empty">
                        Aún no hay PDF para este nivel en el ciclo seleccionado.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
