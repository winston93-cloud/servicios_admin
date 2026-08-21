'use client'

/**
 * 2026-08-21 - Captura de firma: dibujar / subir → guardar firma en el PDF.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  CheckCircle2,
  Eraser,
  ImagePlus,
  Loader2,
  PenLine,
  Save,
} from 'lucide-react'
import type { SignaturePadHandle } from './SignaturePad'
import { imagenArchivoAFirmaPng } from '../lib/firmaAssets'

const SignaturePad = dynamic(() => import('./SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="fe-pad-wrap fe-pad-loading">Cargando pad de firma…</div>
  ),
})

export type FirmaModo = 'dibujar' | 'subir'

type Props = {
  disabled?: boolean
  guardando?: boolean
  /** Ya hay PDF con firma aplicada (aún no enviada). */
  firmaAplicada?: boolean
  enviado?: boolean
  acepto: boolean
  onGuardarFirma: (firmaPngDataUrl: string) => void | Promise<void>
  onError?: (mensaje: string) => void
}

export default function FirmaCapture({
  disabled = false,
  guardando = false,
  firmaAplicada = false,
  enviado = false,
  acepto,
  onGuardarFirma,
  onError,
}: Props) {
  const padApiRef = useRef<SignaturePadHandle | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [modo, setModo] = useState<FirmaModo>('dibujar')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [drawEmpty, setDrawEmpty] = useState(true)

  const firmaBloqueada = disabled || !acepto || enviado
  const busy = disabled || guardando || preparando || enviado
  const puedeGuardar =
    Boolean(previewUrl) && acepto && !busy && !enviado && !disabled

  const bindPad = useCallback((api: SignaturePadHandle) => {
    padApiRef.current = api
  }, [])

  const limpiarPad = useCallback(() => {
    padApiRef.current?.clear()
    setDrawEmpty(true)
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  useEffect(() => {
    if (!acepto && !enviado) limpiarPad()
  }, [acepto, enviado, limpiarPad])

  const limpiar = useCallback(() => {
    if (enviado) return
    limpiarPad()
  }, [enviado, limpiarPad])

  const cambiarModo = useCallback(
    (next: FirmaModo) => {
      if (enviado) return
      setModo(next)
      limpiarPad()
    },
    [enviado, limpiarPad]
  )

  const onPadChange = useCallback((empty: boolean) => {
    setDrawEmpty(empty)
    if (empty) {
      setPreviewUrl(null)
      return
    }
    const png = padApiRef.current?.toDataURL() || ''
    setPreviewUrl(png || null)
  }, [])

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

  const guardarFirma = useCallback(async () => {
    if (!acepto) {
      onError?.('Debes marcar que leíste y estás de acuerdo con la carta.')
      return
    }
    if (!previewUrl) {
      onError?.('Agrega una firma válida antes de guardar.')
      return
    }
    await onGuardarFirma(previewUrl)
  }, [acepto, previewUrl, onGuardarFirma, onError])

  return (
    <section className="fe-sign-card" aria-label="Captura de firma">
      <header className="fe-doc-head">
        <h2>
          <PenLine size={18} aria-hidden />
          2. Firmar
        </h2>
      </header>

      {!acepto && !enviado ? (
        <p className="fe-acepto-hint" role="status">
          Marca «He leído…» debajo del documento original para habilitar la
          firma.
        </p>
      ) : null}

      <div
        className={`fe-sign-body${firmaBloqueada && !enviado ? ' is-locked' : ''}`}
        aria-disabled={firmaBloqueada}
      >
        <div className="fe-mode-tabs" role="tablist" aria-label="Modo de firma">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'dibujar'}
            className={`fe-mode-tab${modo === 'dibujar' ? ' is-active' : ''}`}
            onClick={() => cambiarModo('dibujar')}
            disabled={busy || !acepto}
          >
            <PenLine size={15} aria-hidden />
            Dibujar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'subir'}
            className={`fe-mode-tab${modo === 'subir' ? ' is-active' : ''}`}
            onClick={() => cambiarModo('subir')}
            disabled={busy || !acepto}
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
            disabled={firmaBloqueada || busy}
          />
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
              disabled={firmaBloqueada || busy}
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
            />
            <p className="fe-upload-hint">PNG, JPG o WEBP · máx. 4 MB</p>
          </div>
        ) : null}
      </div>

      <div className="fe-actions">
        <button
          type="button"
          className="fe-btn fe-btn--ghost"
          onClick={limpiar}
          disabled={busy || !acepto || enviado}
        >
          <Eraser size={16} aria-hidden />
          Limpiar
        </button>
        <button
          type="button"
          className={`fe-btn fe-btn--send${firmaAplicada && !guardando ? ' is-saved' : ''}`}
          onClick={() => void guardarFirma()}
          disabled={!puedeGuardar}
          aria-live="polite"
        >
          {guardando || preparando ? (
            <Loader2 size={16} className="fe-spin" aria-hidden />
          ) : firmaAplicada ? (
            <CheckCircle2 size={16} aria-hidden />
          ) : (
            <Save size={16} aria-hidden />
          )}
          {guardando
            ? 'Guardando firma…'
            : firmaAplicada
              ? 'Firma guardada · actualizar'
              : 'Guardar firma'}
        </button>
      </div>
    </section>
  )
}
