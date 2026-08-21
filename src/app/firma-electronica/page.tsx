'use client'

/**
 * 2026-08-21 - Prototipo firma electrónica (sandbox sin login).
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileSignature, Sparkles } from 'lucide-react'
import { Dancing_Script } from 'next/font/google'
import ThemeToggle from '@/components/ThemeToggle'
import DocumentoPreview from './components/DocumentoPreview'
import FirmaCapture from './components/FirmaCapture'
import { crearAcuerdoBecaPdfBytes } from './lib/crearAcuerdoBecaPdf'
import { incrustarFirmaEnPdf } from './lib/incrustarFirmaPdf'
import './firma-electronica.css'

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-firma-script',
  display: 'swap',
})

function bytesToObjectUrl(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes)
  return URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }))
}

function FirmaElectronicaView() {
  const router = useRouter()

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

  const onGuardar = useCallback(
    async (firmaPng: string) => {
      setError(null)
      setOkMsg(null)
      if (!origenBytes) {
        setError('Aún no está listo el documento de origen.')
        return
      }
      setGuardando(true)
      try {
        const firmado = await incrustarFirmaEnPdf(origenBytes, firmaPng)
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
    },
    [origenBytes]
  )

  return (
    <div className={`fe-page ${dancingScript.variable} ${dancingScript.className}`}>
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
            Sandbox · sin login
          </p>
          <h1>
            <FileSignature size={28} aria-hidden />
            Pruebas firma electrónica
          </h1>
          <p className="fe-lead">
            Dibuja, escribe o sube tu firma. Vista previa grande antes de
            incrustarla en el PDF. Cómodo en PC, tablet o celular.
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

          <FirmaCapture
            disabled={cargandoDoc || !origenBytes}
            guardando={guardando}
            onGuardar={onGuardar}
            onError={setError}
          />

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

/** 2026-08-21 - Sandbox abierto: sin login (prototipo de firma). */
export default function FirmaElectronicaPage() {
  return <FirmaElectronicaView />
}
