'use client'

/**
 * 2026-08-21 - Prototipo firma electrónica (dashboard empleados / tabla usuario).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Eraser,
  FileSignature,
  Loader2,
  PenLine,
  Save,
  Sparkles,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import DocumentoPreview from './components/DocumentoPreview'
import type { SignaturePadHandle } from './components/SignaturePad'
import { crearAcuerdoBecaPdfBytes } from './lib/crearAcuerdoBecaPdf'
import { incrustarFirmaEnPdf } from './lib/incrustarFirmaPdf'
import './firma-electronica.css'

const SignaturePad = dynamic(() => import('./components/SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="fe-pad-wrap fe-pad-loading">Cargando pad de firma…</div>
  ),
})

function bytesToObjectUrl(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes)
  return URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }))
}

function FirmaElectronicaView() {
  const router = useRouter()
  const padApiRef = useRef<SignaturePadHandle | null>(null)

  const [origenBytes, setOrigenBytes] = useState<Uint8Array | null>(null)
  const [origenUrl, setOrigenUrl] = useState<string | null>(null)
  const [firmadoUrl, setFirmadoUrl] = useState<string | null>(null)
  const [cargandoDoc, setCargandoDoc] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    ;(async () => {
      try {
        setCargandoDoc(true)
        setError(null)
        const bytes = await crearAcuerdoBecaPdfBytes()
        if (cancelled) return
        url = bytesToObjectUrl(bytes)
        setOrigenBytes(bytes)
        setOrigenUrl(url)
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : 'No se pudo generar el documento de prueba.'
          )
        }
      } finally {
        if (!cancelled) setCargandoDoc(false)
      }
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (firmadoUrl) URL.revokeObjectURL(firmadoUrl)
    }
  }, [firmadoUrl])

  const bindPad = useCallback((api: SignaturePadHandle) => {
    padApiRef.current = api
  }, [])

  const limpiar = useCallback(() => {
    padApiRef.current?.clear()
    setOkMsg(null)
    setError(null)
  }, [])

  const guardarFirma = useCallback(async () => {
    setError(null)
    setOkMsg(null)
    const pad = padApiRef.current
    if (!pad || pad.isEmpty()) {
      setError('Dibuja tu firma antes de guardar.')
      return
    }
    if (!origenBytes) {
      setError('Aún no está listo el documento de origen.')
      return
    }

    setGuardando(true)
    try {
      const png = pad.toDataURL()
      const firmado = await incrustarFirmaEnPdf(origenBytes, png)
      const nextUrl = bytesToObjectUrl(firmado)
      setFirmadoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return nextUrl
      })
      setOkMsg('Firma aplicada. Revisa el documento firmado a la derecha.')
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo incrustar la firma.'
      )
    } finally {
      setGuardando(false)
    }
  }, [origenBytes])

  return (
    <div className="fe-page">
      <div className="fe-atmosphere" aria-hidden>
        <span className="fe-orb fe-orb--a" />
        <span className="fe-orb fe-orb--b" />
      </div>

      <header className="fe-top">
        <button
          type="button"
          className="fe-back"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft size={16} aria-hidden />
          Volver al dashboard
        </button>
        <ThemeToggle />
      </header>

      <main className="fe-main">
        <section className="fe-hero">
          <p className="fe-kicker">
            <Sparkles size={14} aria-hidden />
            Prototipo · solo personal
          </p>
          <h1>
            <FileSignature size={28} aria-hidden />
            Pruebas firma electrónica
          </h1>
          <p className="fe-lead">
            Documento de ejemplo, pad para dibujar la firma y vista del PDF ya
            firmado. Pensado para PC, tablet o pantalla táctil.
          </p>
        </section>

        {error ? (
          <p className="fe-alert fe-alert--err" role="alert">
            {error}
          </p>
        ) : null}
        {okMsg ? (
          <p className="fe-alert fe-alert--ok" role="status">
            {okMsg}
          </p>
        ) : null}

        <div className="fe-grid">
          <DocumentoPreview
            title="1. Documento original"
            url={origenUrl}
            emptyLabel={
              cargandoDoc
                ? 'Generando acuerdo de beca de prueba…'
                : 'Sin documento.'
            }
          />

          <section className="fe-sign-card" aria-label="Captura de firma">
            <header className="fe-doc-head">
              <h2>
                <PenLine size={18} aria-hidden />
                2. Firmar aquí
              </h2>
            </header>
            <SignaturePad
              onBind={bindPad}
              disabled={guardando || cargandoDoc}
            />
            <div className="fe-actions">
              <button
                type="button"
                className="fe-btn fe-btn--ghost"
                onClick={limpiar}
                disabled={guardando}
              >
                <Eraser size={16} aria-hidden />
                Limpiar
              </button>
              <button
                type="button"
                className="fe-btn fe-btn--primary"
                onClick={() => void guardarFirma()}
                disabled={guardando || cargandoDoc || !origenBytes}
              >
                {guardando ? (
                  <Loader2 size={16} className="fe-spin" aria-hidden />
                ) : (
                  <Save size={16} aria-hidden />
                )}
                {guardando ? 'Guardando…' : 'Guardar firma'}
              </button>
            </div>
          </section>

          <DocumentoPreview
            title="3. Documento firmado"
            url={firmadoUrl}
            emptyLabel="Cuando guardes la firma, el PDF con la firma incrustada aparecerá aquí."
          />
        </div>
      </main>
    </div>
  )
}

export default function FirmaElectronicaPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <FirmaElectronicaView />
    </ProtectedRoute>
  )
}
