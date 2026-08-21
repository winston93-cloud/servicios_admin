'use client'

/**
 * 2026-08-21 - Captura de firma: dibujar / escribir / subir + vista previa.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Eraser,
  ImagePlus,
  Keyboard,
  Loader2,
  PenLine,
  Save,
} from 'lucide-react'
import type { SignaturePadHandle } from './SignaturePad'
import {
  imagenArchivoAFirmaPng,
  textoAFirmaPng,
} from '../lib/firmaAssets'

const SignaturePad = dynamic(() => import('./SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="fe-pad-wrap fe-pad-loading">Cargando pad de firma…</div>
  ),
})

export type FirmaModo = 'dibujar' | 'escribir' | 'subir'

type Props = {
  disabled?: boolean
  guardando?: boolean
  onGuardar: (firmaPngDataUrl: string) => void | Promise<void>
  onError?: (mensaje: string) => void
}

export default function FirmaCapture({
  disabled = false,
  guardando = false,
  onGuardar,
  onError,
}: Props) {
  const padApiRef = useRef<SignaturePadHandle | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [modo, setModo] = useState<FirmaModo>('dibujar')
  const [texto, setTexto] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [drawEmpty, setDrawEmpty] = useState(true)

  const busy = disabled || guardando || preparando
  const puedeGuardar = Boolean(previewUrl) && !busy

  const bindPad = useCallback((api: SignaturePadHandle) => {
    padApiRef.current = api
  }, [])

  const limpiar = useCallback(() => {
    padApiRef.current?.clear()
    setDrawEmpty(true)
    setTexto('')
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const cambiarModo = useCallback((next: FirmaModo) => {
    setModo(next)
    padApiRef.current?.clear()
    setDrawEmpty(true)
    setTexto('')
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  // Dibujar → vista previa al terminar el trazo
  const onPadChange = useCallback((empty: boolean) => {
    setDrawEmpty(empty)
    if (empty) {
      setPreviewUrl(null)
      return
    }
    const png = padApiRef.current?.toDataURL() || ''
    setPreviewUrl(png || null)
  }, [])

  // Escribir → regenerar preview con debounce
  useEffect(() => {
    if (modo !== 'escribir') return
    const t = texto.trim()
    if (!t) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setPreparando(true)
          const png = await textoAFirmaPng(t)
          if (!cancelled) setPreviewUrl(png)
        } catch (e) {
          if (!cancelled) {
            setPreviewUrl(null)
            onError?.(e instanceof Error ? e.message : 'No se pudo generar la firma.')
          }
        } finally {
          if (!cancelled) setPreparando(false)
        }
      })()
    }, 320)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [modo, texto, onError])

  const onFileChange = useCallback(
    async (file: File | null) => {
      if (!file) {
        setPreviewUrl(null)
        return
      }
      try {
        setPreparando(true)
        const png = await imagenArchivoAFirmaPng(file)
        setPreviewUrl(png)
      } catch (e) {
        setPreviewUrl(null)
        onError?.(e instanceof Error ? e.message : 'No se pudo leer la imagen.')
        if (fileRef.current) fileRef.current.value = ''
      } finally {
        setPreparando(false)
      }
    },
    [onError]
  )

  const guardar = useCallback(async () => {
    if (!previewUrl) {
      onError?.('Agrega una firma válida antes de guardar.')
      return
    }
    await onGuardar(previewUrl)
  }, [previewUrl, onGuardar, onError])

  return (
    <section className="fe-sign-card" aria-label="Captura de firma">
      <header className="fe-doc-head">
        <h2>
          <PenLine size={18} aria-hidden />
          2. Firmar aquí
        </h2>
      </header>

      <div className="fe-mode-tabs" role="tablist" aria-label="Modo de firma">
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'dibujar'}
          className={`fe-mode-tab${modo === 'dibujar' ? ' is-active' : ''}`}
          onClick={() => cambiarModo('dibujar')}
          disabled={busy}
        >
          <PenLine size={15} aria-hidden />
          Dibujar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'escribir'}
          className={`fe-mode-tab${modo === 'escribir' ? ' is-active' : ''}`}
          onClick={() => cambiarModo('escribir')}
          disabled={busy}
        >
          <Keyboard size={15} aria-hidden />
          Escribir
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'subir'}
          className={`fe-mode-tab${modo === 'subir' ? ' is-active' : ''}`}
          onClick={() => cambiarModo('subir')}
          disabled={busy}
        >
          <ImagePlus size={15} aria-hidden />
          Subir imagen
        </button>
      </div>

      <p className="fe-help">
        Recomendado: firma con el dedo en celular o despacio con el mouse
      </p>

      {modo === 'dibujar' ? (
        <SignaturePad
          onBind={bindPad}
          onChange={onPadChange}
          disabled={busy}
        />
      ) : null}

      {modo === 'escribir' ? (
        <div className="fe-write-block">
          <label className="fe-field-label" htmlFor="fe-firma-texto">
            Nombre a firmar
          </label>
          <input
            id="fe-firma-texto"
            className="fe-input"
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej. María López García"
            disabled={busy}
            autoComplete="name"
            maxLength={80}
          />
          <div className="fe-write-preview" aria-live="polite">
            {texto.trim() ? (
              <span className="fe-write-script">{texto.trim()}</span>
            ) : (
              <span className="fe-write-placeholder">Vista previa cursiva</span>
            )}
          </div>
        </div>
      ) : null}

      {modo === 'subir' ? (
        <div className="fe-upload-block">
          <label className="fe-field-label" htmlFor="fe-firma-file">
            Foto o escaneo de tu firma
          </label>
          <input
            id="fe-firma-file"
            ref={fileRef}
            className="fe-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
          />
          <p className="fe-upload-hint">PNG, JPG o WEBP · máx. 4 MB</p>
        </div>
      ) : null}

      <div className="fe-preview-block">
        <p className="fe-preview-label">Vista previa de la firma</p>
        <div className="fe-preview-frame">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Vista previa de la firma"
              className="fe-preview-img"
            />
          ) : (
            <p className="fe-preview-empty">
              {modo === 'dibujar' && drawEmpty
                ? 'Dibuja en el área de arriba'
                : modo === 'escribir'
                  ? 'Escribe tu nombre para ver la firma'
                  : 'Sube una imagen para ver la firma'}
            </p>
          )}
        </div>
      </div>

      <div className="fe-actions">
        <button
          type="button"
          className="fe-btn fe-btn--ghost"
          onClick={limpiar}
          disabled={busy}
        >
          <Eraser size={16} aria-hidden />
          Limpiar
        </button>
        <button
          type="button"
          className="fe-btn fe-btn--primary"
          onClick={() => void guardar()}
          disabled={!puedeGuardar}
        >
          {guardando || preparando ? (
            <Loader2 size={16} className="fe-spin" aria-hidden />
          ) : (
            <Save size={16} aria-hidden />
          )}
          {guardando ? 'Guardando…' : 'Guardar firma'}
        </button>
      </div>
    </section>
  )
}
