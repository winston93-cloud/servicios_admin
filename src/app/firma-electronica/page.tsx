'use client'

/**
 * 2026-08-21 - Prototipo firma electrónica (sandbox sin login).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import DocumentoPreview from './components/DocumentoPreview'
import FirmaCapture from './components/FirmaCapture'
import FelicitacionesModal from './components/FelicitacionesModal'
import { crearCartaBecaPdf } from './lib/crearCartaBecaPdf'
import { datosCartaParaPdf, tipoBecaCompleto } from './lib/datosPruebaCartas'
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

/** Autoscroll solo en viewport móvil (stack vertical). */
function esMovilViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px)').matches
}

function scrollSuaveA(
  el: HTMLElement | null,
  opts?: ScrollIntoViewOptions
) {
  if (!el || !esMovilViewport()) return
  // Espera un frame para que el layout (PDF/botón) ya esté montado.
  requestAnimationFrame(() => {
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      ...opts,
    })
  })
}

function FirmaElectronicaView() {
  const router = useRouter()
  const colFirmaRef = useRef<HTMLDivElement | null>(null)
  const colFirmadoRef = useRef<HTMLDivElement | null>(null)
  const colOrigenRef = useRef<HTMLDivElement | null>(null)

  const [nivel, setNivel] = useState<NivelFirma>('maternal-kinder')
  const [origenBytes, setOrigenBytes] = useState<Uint8Array | null>(null)
  const [origenUrl, setOrigenUrl] = useState<string | null>(null)
  const [firmaBox, setFirmaBox] = useState<FirmaBox | null>(null)
  const [firmadoUrl, setFirmadoUrl] = useState<string | null>(null)
  const [cargandoDoc, setCargandoDoc] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [mostrarFelicitaciones, setMostrarFelicitaciones] = useState(false)
  const [acepto, setAcepto] = useState(false)
  const [nombreTutor, setNombreTutor] = useState('')
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
        setMostrarFelicitaciones(false)
        setEnviando(false)
        setAcepto(false)
        setNombreTutor('')
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

  const onGuardarFirma = useCallback(
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
      if (nombreTutor.trim().length < 3) {
        setError('Escribe tu nombre completo antes de firmar.')
        return
      }
      setGuardando(true)
      try {
        const firmado = await incrustarFirmaEnPdf(
          origenBytes,
          firmaPng,
          firmaBox,
          nombreTutor
        )
        const nextUrl = bytesToObjectUrl(firmado)
        setFirmadoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return nextUrl
        })
        setEnviado(false)
        setOkMsg(
          'Firma aplicada al PDF. Revisa el documento y envía la carta para activar la beca.'
        )
        // Tras pintar el PDF firmado, bajar al paso 3 + Enviar.
        window.setTimeout(() => {
          scrollSuaveA(colFirmadoRef.current)
        }, 120)
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'No se pudo incrustar la firma.'
        )
      } finally {
        setGuardando(false)
      }
    },
    [origenBytes, firmaBox, acepto, nombreTutor]
  )

  const onEnviarCarta = useCallback(async () => {
    setError(null)
    if (!firmadoUrl) {
      setError('Primero guarda la firma para generar el PDF firmado.')
      return
    }
    if (!acepto) {
      setError('Debes marcar que leíste y estás de acuerdo con la carta.')
      return
    }
    setEnviando(true)
    try {
      // Sandbox: simula guardado/envío de la carta ya firmada.
      await new Promise((r) => setTimeout(r, 450))
      setEnviado(true)
      setMostrarFelicitaciones(true)
      setOkMsg(null)
      window.setTimeout(() => {
        scrollSuaveA(colFirmadoRef.current, { block: 'nearest' })
      }, 80)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo enviar la carta.'
      )
    } finally {
      setEnviando(false)
    }
  }, [firmadoUrl, acepto])

  const onAceptoChange = useCallback((checked: boolean) => {
    setAcepto(checked)
    if (checked) {
      window.setTimeout(() => {
        scrollSuaveA(colFirmaRef.current)
      }, 60)
    }
  }, [])

  const reiniciarProceso = useCallback(() => {
    setFirmadoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setEnviado(false)
    setMostrarFelicitaciones(false)
    setEnviando(false)
    setAcepto(false)
    setNombreTutor('')
    setError(null)
    setOkMsg(null)
    setFirmaKey((k) => k + 1)
    window.setTimeout(() => {
      scrollSuaveA(colOrigenRef.current)
    }, 60)
  }, [])

  const plantilla = plantillaPorNivel(nivel)
  const datos = datosCartaParaPdf(nivel)
  const tipoBecaLabel = tipoBecaCompleto(datos.tipoBeca, datos.porcentaje)
  const textoEnviar = `Enviar carta y Activar Beca ${tipoBecaLabel}`

  return (
    <div className="fe-page">
      <div className="fe-atmosphere" aria-hidden>
        <span className="fe-orb fe-orb--a" />
        <span className="fe-orb fe-orb--b" />
      </div>

      <header className="fe-top">
        <div className="fe-top-nav">
          <button
            type="button"
            className="fe-back"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={16} aria-hidden />
            <span className="fe-back-text">Volver</span>
          </button>
          <ThemeToggle />
        </div>

        <div className="fe-top-bar" role="group" aria-label="Firma electrónica">
          <div className="fe-top-brand">
            <h1 className="fe-top-title">
              <FileSignature size={20} aria-hidden />
              Firma Electrónica
            </h1>
            <span className="fe-kicker fe-kicker--inline">
              <Sparkles size={12} aria-hidden />
              Sandbox · sin login
            </span>
          </div>
          <label className="fe-nivel">
            <span className="fe-nivel-label">Nivel</span>
            <select
              className="fe-nivel-select"
              value={nivel}
              onChange={(e) => setNivel(e.target.value as NivelFirma)}
              disabled={guardando || enviando}
            >
              {PLANTILLAS_NIVEL.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <p className="fe-nivel-hint">
            <span className="fe-nivel-hint-row">
              <span className="fe-nivel-hint-k">Prueba</span>
              <strong className="fe-nivel-alumno">{datos.alumnoNombre}</strong>
            </span>
            <span className="fe-nivel-meta">
              <span>{datos.grado}</span>
              <span className="fe-nivel-sep" aria-hidden>
                ·
              </span>
              <span>
                {datos.tipoBeca} {datos.porcentaje}
              </span>
              <span className="fe-nivel-sep" aria-hidden>
                ·
              </span>
              <span>ciclo {datos.cicloLabel}</span>
            </span>
          </p>
        </div>
      </header>

      <main className="fe-main">
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
          <div className="fe-col-origen" ref={colOrigenRef}>
            <DocumentoPreview
              title="1. Documento original"
              url={origenUrl}
              downloadFileName={`carta-aceptacion-beca-${nivel}.pdf`}
              emptyLabel={
                cargandoDoc
                  ? `Generando carta ${plantilla.label}…`
                  : 'Sin documento.'
              }
            />
          </div>

          <div className="fe-col-firma" ref={colFirmaRef}>
            <FirmaCapture
              key={`${nivel}-${firmaKey}`}
              disabled={cargandoDoc || !origenBytes}
              guardando={guardando}
              firmaAplicada={Boolean(firmadoUrl)}
              enviado={enviado}
              acepto={acepto}
              nombreTutor={nombreTutor}
              onNombreTutorChange={setNombreTutor}
              checkboxDisabled={cargandoDoc || !origenBytes || enviado}
              onAceptoChange={onAceptoChange}
              onGuardarFirma={onGuardarFirma}
              onError={setError}
            />
          </div>

          <div className="fe-col-firmado" ref={colFirmadoRef}>
            {firmadoUrl && !enviado ? (
              <div className="fe-enviar-block fe-enviar-block--top">
                <button
                  type="button"
                  className="fe-btn fe-btn--enviar"
                  onClick={() => void onEnviarCarta()}
                  disabled={enviando || guardando}
                >
                  {enviando ? (
                    <Loader2 size={16} className="fe-spin" aria-hidden />
                  ) : (
                    <Send size={16} aria-hidden />
                  )}
                  {enviando ? 'Activando beca…' : textoEnviar}
                </button>
                <p className="fe-enviar-hint">
                  Confirma el envío de la carta firmada y la activación de la beca. Revisa el
                  PDF abajo antes de continuar.
                </p>
              </div>
            ) : null}

            {enviado ? (
              <div className="fe-enviar-block fe-enviar-block--top">
                <button
                  type="button"
                  className="fe-btn fe-btn--enviar is-sent"
                  disabled
                >
                  <CheckCircle2 size={16} aria-hidden />
                  Beca activada · carta enviada
                </button>
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
                    Borra la carta firmada enviada y vuelve al inicio para
                    firmar de nuevo.
                  </p>
                </div>
              </div>
            ) : null}

            <DocumentoPreview
              title="3. Documento firmado"
              url={firmadoUrl}
              downloadFileName="carta-aceptacion-beca-firmada.pdf"
              emptyLabel="Cuando apliques la firma, el PDF firmado aparecerá aquí."
            />
          </div>
        </div>
      </main>

      <FelicitacionesModal
        open={mostrarFelicitaciones}
        onClose={() => setMostrarFelicitaciones(false)}
        alumnoNombre={datos.alumnoNombre}
        tipoBecaLabel={tipoBecaLabel}
        cicloLabel={datos.cicloLabel}
        grado={datos.grado}
      />
    </div>
  )
}

/** 2026-08-21 - Sandbox abierto: sin login (prototipo de firma). */
export default function FirmaElectronicaPage() {
  return <FirmaElectronicaView />
}
