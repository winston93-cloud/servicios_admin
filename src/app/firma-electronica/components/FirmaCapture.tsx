'use client'

/**
 * 2026-08-21 - Captura de firma: dibujar → guardar firma en el PDF.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  CheckCircle2,
  Eraser,
  Loader2,
  PenLine,
  Save,
} from 'lucide-react'
import type { SignaturePadHandle } from './SignaturePad'

const SignaturePad = dynamic(() => import('./SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="fe-pad-wrap fe-pad-loading">Cargando pad de firma…</div>
  ),
})

type Props = {
  disabled?: boolean
  guardando?: boolean
  /** Ya hay PDF con firma aplicada (aún no enviada). */
  firmaAplicada?: boolean
  enviado?: boolean
  acepto: boolean
  nombreTutor: string
  onNombreTutorChange: (value: string) => void
  checkboxDisabled?: boolean
  onAceptoChange: (checked: boolean) => void
  onGuardarFirma: (firmaPngDataUrl: string) => void | Promise<void>
  onError?: (mensaje: string) => void
}

export default function FirmaCapture({
  disabled = false,
  guardando = false,
  firmaAplicada = false,
  enviado = false,
  acepto,
  nombreTutor,
  onNombreTutorChange,
  checkboxDisabled = false,
  onAceptoChange,
  onGuardarFirma,
  onError,
}: Props) {
  const padApiRef = useRef<SignaturePadHandle | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const nombreListo = nombreTutor.trim().length >= 3
  const firmaBloqueada = disabled || !acepto || !nombreListo || enviado
  const busy = disabled || guardando || enviado
  const puedeGuardar =
    Boolean(previewUrl) && acepto && nombreListo && !busy && !enviado && !disabled

  const bindPad = useCallback((api: SignaturePadHandle) => {
    padApiRef.current = api
  }, [])

  const limpiarPad = useCallback(() => {
    padApiRef.current?.clear()
    setPreviewUrl(null)
  }, [])

  useEffect(() => {
    if ((!acepto || !nombreListo) && !enviado) limpiarPad()
  }, [acepto, nombreListo, enviado, limpiarPad])

  const limpiar = useCallback(() => {
    if (enviado) return
    limpiarPad()
  }, [enviado, limpiarPad])

  const onPadChange = useCallback((empty: boolean) => {
    if (empty) {
      setPreviewUrl(null)
      return
    }
    const png = padApiRef.current?.toDataURL() || ''
    setPreviewUrl(png || null)
  }, [])

  const guardarFirma = useCallback(async () => {
    if (!acepto) {
      onError?.('Debes marcar que leíste y estás de acuerdo con la carta.')
      return
    }
    if (!nombreListo) {
      onError?.('Escribe tu nombre completo antes de firmar.')
      return
    }
    if (!previewUrl) {
      onError?.('Dibuja tu firma antes de guardar.')
      return
    }
    await onGuardarFirma(previewUrl)
  }, [acepto, nombreListo, previewUrl, onGuardarFirma, onError])

  return (
    <section className="fe-sign-card" aria-label="Captura de firma">
      <header className="fe-doc-head">
        <h2>
          <PenLine size={18} aria-hidden />
          2. Firmar
        </h2>
      </header>

      <label
        className={`fe-acepto fe-acepto--sobre-firma${acepto ? ' is-checked' : ''}`}
      >
        <input
          type="checkbox"
          className="fe-acepto-input"
          checked={acepto}
          disabled={checkboxDisabled}
          onChange={(e) => onAceptoChange(e.target.checked)}
        />
        <span className="fe-acepto-box" aria-hidden />
        <span className="fe-acepto-copy">
          {!acepto ? (
            <span className="fe-acepto-badge">Acción requerida</span>
          ) : null}
          <span className="fe-acepto-text">
            He leído y confirmo que estoy de acuerdo con el contenido de la
            carta de aceptación de beca. Entiendo las condiciones para conservar
            el beneficio y autorizo el uso de mi firma electrónica en este
            documento.
          </span>
        </span>
      </label>

      <label className="fe-nombre-tutor">
        <span className="fe-nombre-tutor-label">
          Nombre del padre, madre o tutor(a)
          {!nombreListo && acepto ? (
            <span className="fe-nombre-tutor-badge">Requerido</span>
          ) : null}
        </span>
        <input
          type="text"
          className="fe-nombre-tutor-input"
          value={nombreTutor}
          onChange={(e) => onNombreTutorChange(e.target.value)}
          placeholder="Como aparecerá debajo de la firma en la carta"
          autoComplete="name"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={120}
          disabled={!acepto || enviado || disabled || guardando}
          aria-required="true"
        />
        <span className="fe-nombre-tutor-hint">
          Usa tu nombre completo. Se imprimirá en la carta con tipografía formal.
        </span>
      </label>

      <div
        className={`fe-sign-body${firmaBloqueada && !enviado ? ' is-locked' : ''}`}
        aria-disabled={firmaBloqueada}
      >
        <p className="fe-help">
          Firma con el dedo en celular o despacio con el mouse
        </p>

        <SignaturePad
          onBind={bindPad}
          onChange={onPadChange}
          disabled={firmaBloqueada || busy}
        />
      </div>

      <div className="fe-actions">
        <button
          type="button"
          className="fe-btn fe-btn--ghost"
          onClick={limpiar}
          disabled={busy || !acepto || !nombreListo || enviado}
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
          {guardando ? (
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
