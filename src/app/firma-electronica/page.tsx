'use client'

/**
 * 2026-08-21 - Prototipo firma electrónica (sandbox sin login).
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  FileSignature,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import DocumentoPreview from './components/DocumentoPreview'
import FirmaCapture from './components/FirmaCapture'
import { crearCartaBecaPdf } from './lib/crearCartaBecaPdf'
import { DATOS_PRUEBA_POR_NIVEL } from './lib/datosPruebaCartas'
import { incrustarFirmaEnPdf } from './lib/incrustarFirmaPdf'
import {
  PLANTILLAS_NIVEL,
  plantillaPorNivel,
  type FirmaBox,
  type NivelFirma,
} from './lib/plantillasNivel'
import './firma-electronica.css'

function bytesToObjectUrl(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes)
  return URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }))
}

function FirmaElectronicaView() {
  const router = useRouter()

  const [nivel, setNivel] = useState<NivelFirma>('maternal-kinder')
  const [origenBytes, setOrigenBytes] = useState<Uint8Array | null>(null)
  const [origenUrl, setOrigenUrl] = useState<string | null>(null)
  const [firmaBox, setFirmaBox] = useState<FirmaBox | null>(null)
  const [firmadoUrl, setFirmadoUrl] = useState<string | null>(null)
  const [cargandoDoc, setCargandoDoc] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [acepto, setAcepto] = useState(false)
  const [firmaKey, setFirmaKey] = useState(0)
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
        setEnviado(false)
        setAcepto(false)
        setFirmaKey((k) => k + 1)
        setFirmadoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        const { bytes, firmaBox: box } = await crearCartaBecaPdf(nivel)
        const nextUrl = bytesToObjectUrl(bytes)
        if (cancelled) {
          URL.revokeObjectURL(nextUrl)
          return
        }
        url = nextUrl
        setOrigenBytes(bytes)
        setFirmaBox(box)
        setOrigenUrl(nextUrl)
      } catch (e) {
        if (!cancelled) {
          setOrigenBytes(null)
          setFirmaBox(null)
          setOrigenUrl(null)
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
      if (!origenBytes || !firmaBox) {
        setError('Aún no está listo el documento de origen.')
        return
      }
      if (!acepto) {
        setError('Debes marcar que leíste y estás de acuerdo con la carta.')
        return
      }
      setGuardando(true)
      try {
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
        setEnviado(true)
        setOkMsg(
          'Carta de aceptación de beca firmada y enviada. Revisa el PDF a la derecha.'
        )
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'No se pudo incrustar la firma.'
        )
      } finally {
        setGuardando(false)
      }
    },
    [origenBytes, firmaBox, acepto]
  )

  const reiniciarProceso = useCallback(() => {
    setFirmadoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setEnviado(false)
    setAcepto(false)
    setError(null)
    setOkMsg(null)
    setFirmaKey((k) => k + 1)
  }, [])

  const plantilla = plantillaPorNivel(nivel)
  const datos = DATOS_PRUEBA_POR_NIVEL[nivel]

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
            Firma Electrónica
          </h1>

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
              Prueba: <strong>{datos.alumnoNombre}</strong> · {datos.grado} ·{' '}
              {datos.tipoBeca} {datos.porcentaje} · ciclo {datos.cicloLabel}
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
          <div className="fe-col-origen">
            <DocumentoPreview
              title="1. Documento original"
              url={origenUrl}
              emptyLabel={
                cargandoDoc
                  ? `Generando carta ${plantilla.label}…`
                  : 'Sin documento.'
              }
            />

            <label
              className={`fe-acepto fe-acepto--bajo-pdf${acepto ? ' is-checked' : ''}`}
            >
              <input
                type="checkbox"
                className="fe-acepto-input"
                checked={acepto}
                disabled={cargandoDoc || !origenBytes || enviado}
                onChange={(e) => setAcepto(e.target.checked)}
              />
              <span className="fe-acepto-box" aria-hidden />
              <span className="fe-acepto-text">
                He leído y confirmo que estoy de acuerdo con el contenido de la
                carta de aceptación de beca. Entiendo las condiciones para
                conservar el beneficio y autorizo el uso de mi firma electrónica
                en este documento.
              </span>
            </label>
          </div>

          <div className="fe-col-firma">
            <FirmaCapture
              key={`${nivel}-${firmaKey}`}
              disabled={cargandoDoc || !origenBytes}
              guardando={guardando}
              enviado={enviado}
              acepto={acepto}
              onGuardar={onGuardar}
              onError={setError}
            />

            {enviado ? (
              <div className="fe-reinicio">
                <button
                  type="button"
                  className="fe-btn fe-btn--restart"
                  onClick={reiniciarProceso}
                >
                  <RotateCcw size={16} aria-hidden />
                  Eliminar y reiniciar proceso
                </button>
                <p className="fe-reinicio-hint">
                  Borra la carta firmada guardada y vuelve al inicio para firmar
                  de nuevo (útil en pruebas).
                </p>
              </div>
            ) : null}
          </div>

          <DocumentoPreview
            title="3. Documento firmado"
            url={firmadoUrl}
            emptyLabel="Cuando envíes la carta, el PDF firmado aparecerá aquí."
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
