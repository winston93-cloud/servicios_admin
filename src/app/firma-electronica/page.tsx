'use client'

/**
 * 2026-08-21 - Prototipo firma electrónica (sandbox sin login).
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileSignature, Sparkles } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import DocumentoPreview from './components/DocumentoPreview'
import FirmaCapture from './components/FirmaCapture'
import { incrustarFirmaEnPdf } from './lib/incrustarFirmaPdf'
import {
  PLANTILLAS_NIVEL,
  plantillaPorNivel,
  type NivelFirma,
} from './lib/plantillasNivel'
import './firma-electronica.css'

function bytesToObjectUrl(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes)
  return URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }))
}

async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`No se pudo cargar la plantilla (${res.status}).`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

function FirmaElectronicaView() {
  const router = useRouter()

  const [nivel, setNivel] = useState<NivelFirma>('maternal-kinder')
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
        setOkMsg(null)
        setFirmadoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        const plantilla = plantillaPorNivel(nivel)
        const bytes = await fetchPdfBytes(plantilla.pdfUrl)
        const nextUrl = bytesToObjectUrl(bytes)
        if (cancelled) {
          URL.revokeObjectURL(nextUrl)
          return
        }
        url = nextUrl
        setOrigenBytes(bytes)
        setOrigenUrl(nextUrl)
      } catch (e) {
        if (!cancelled) {
          setOrigenBytes(null)
          setOrigenUrl(null)
          setError(
            e instanceof Error
              ? e.message
              : 'No se pudo cargar el documento de prueba.'
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
  }, [nivel])

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
        const { firmaBox } = plantillaPorNivel(nivel)
        const firmado = await incrustarFirmaEnPdf(
          origenBytes,
          firmaPng,
          firmaBox
        )
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
    [origenBytes, nivel]
  )

  const plantilla = plantillaPorNivel(nivel)

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
            Sandbox · sin login
          </p>
          <h1>
            <FileSignature size={28} aria-hidden />
            Pruebas firma electrónica
          </h1>
          <p className="fe-lead">
            Elige el nivel para cargar la carta de aceptación real (PDF). Dibuja
            o sube tu firma e incrústala sobre &quot;Fecha y Firma de
            Enterado&quot;.
          </p>

          <label className="fe-nivel">
            <span className="fe-nivel-label">Nivel / formato</span>
            <select
              className="fe-nivel-select"
              value={nivel}
              onChange={(e) => setNivel(e.target.value as NivelFirma)}
              disabled={guardando}
            >
              {PLANTILLAS_NIVEL.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="fe-nivel-hint">
              Plantilla: {plantilla.label} · PDF de muestra
            </span>
          </label>
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
                ? `Cargando carta ${plantilla.label}…`
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
