'use client'

import { useRef, useState } from 'react'
import { Film, Loader2, Trash2, Upload } from 'lucide-react'
import { videoEmbed } from '@/lib/videoEmbed'
import type { EstrategiaSubidaInsforge } from '@/lib/correoMasivoAdjuntosStorage'

const MAX_MB = 500
const ACEPTA = 'video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v'

function subirConProgreso(
  metodo: 'POST' | 'PUT',
  url: string,
  datos: FormData,
  onProgreso: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(metodo, url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`El almacenamiento rechazó el video (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Se cortó la conexión al subir el video'))
    xhr.send(datos)
  })
}

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
  return data
}

export default function WinstonUsaVideoCampo({
  ciclo,
  videoUrl,
  onCambio,
}: {
  ciclo: number | null
  videoUrl: string
  onCambio: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [quitando, setQuitando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const ocupado = progreso != null || quitando
  const video = videoUrl ? videoEmbed(videoUrl) : null

  const subir = async (file: File) => {
    if (ciclo == null) return
    setError(null)
    setMensaje(null)
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El video pesa más de ${MAX_MB} MB. Comprímelo antes de subirlo.`)
      return
    }
    setProgreso(0)
    try {
      const contentType = file.type || 'video/mp4'
      const { key, strategy } = await api<{ key: string; strategy: EstrategiaSubidaInsforge }>(
        '/api/costos/winston-usa/video',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'preparar',
            ciclo,
            filename: file.name,
            size: file.size,
            contentType,
          }),
        }
      )
      const datos = new FormData()
      if (strategy.method === 'presigned') {
        for (const [k, v] of Object.entries(strategy.fields ?? {})) datos.append(k, String(v))
      }
      datos.append('file', file)
      await subirConProgreso(strategy.method === 'presigned' ? 'POST' : 'PUT', strategy.uploadUrl, datos, setProgreso)
      const { video_url } = await api<{ video_url: string }>('/api/costos/winston-usa/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'confirmar',
          ciclo,
          key,
          size: file.size,
          contentType,
          confirmUrl: strategy.confirmRequired ? strategy.confirmUrl : undefined,
        }),
      })
      onCambio(video_url)
      setMensaje('Video subido. Ya aparece en el botón «Ver video» del portal de papás.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el video')
    } finally {
      setProgreso(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const quitar = async () => {
    if (ciclo == null || !window.confirm('¿Quitar el video del portal de papás?')) return
    setError(null)
    setMensaje(null)
    setQuitando(true)
    try {
      await api(`/api/costos/winston-usa/video?ciclo=${ciclo}`, { method: 'DELETE' })
      onCambio('')
      setMensaje('Video quitado del portal.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el video')
    } finally {
      setQuitando(false)
    }
  }

  return (
    <div className="ciclos-crud-field costos-usa-video">
      <span className="costos-usa-video-label">Video explicativo (opcional)</span>
      <p className="costos-field-hint">
        Sube el video (MP4, MOV o WebM, hasta {MAX_MB} MB). Se guarda al terminar de subir; no hace falta
        pulsar «Guardar». Sin video, el botón del portal no muestra la opción «Ver video».
      </p>

      {video ? (
        <div className="costos-usa-video-preview">
          {video.tipo === 'iframe' ? (
            <iframe src={video.src} title="Video Winston USA Program" allowFullScreen />
          ) : (
            <video src={video.src} controls playsInline preload="metadata" />
          )}
        </div>
      ) : null}

      {progreso != null ? (
        <div className="costos-usa-video-progreso" role="status" aria-live="polite">
          <div className="costos-usa-video-barra">
            <span style={{ width: `${progreso}%` }} />
          </div>
          <span>
            {progreso < 100 ? `Subiendo video… ${progreso}%` : 'Guardando…'}
          </span>
        </div>
      ) : null}

      <div className="costos-usa-video-acciones">
        <input
          ref={inputRef}
          id="usa-video-archivo"
          type="file"
          accept={ACEPTA}
          className="costos-usa-video-input"
          disabled={ocupado || ciclo == null}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void subir(f)
          }}
        />
        <label
          htmlFor="usa-video-archivo"
          className={`ciclos-crud-btn ciclos-crud-btn--primary${ocupado ? ' is-disabled' : ''}`}
          aria-disabled={ocupado}
        >
          {progreso != null ? (
            <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
          ) : video ? (
            <Film size={18} aria-hidden />
          ) : (
            <Upload size={18} aria-hidden />
          )}
          {video ? 'Reemplazar video' : 'Subir video'}
        </label>
        {videoUrl ? (
          <button type="button" className="ciclos-crud-btn ciclos-crud-btn--secondary" onClick={() => void quitar()} disabled={ocupado}>
            {quitando ? (
              <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
            ) : (
              <Trash2 size={18} aria-hidden />
            )}
            Quitar video
          </button>
        ) : null}
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
    </div>
  )
}
