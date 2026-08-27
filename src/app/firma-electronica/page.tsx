'use client'

/**
 * Firma electrónica: sandbox (?sandbox=1) o modo real (papás con beca autorizada).
 */
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { useAuth } from '@/contexts/AuthContext'
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

type DatosUi = {
  tutorNombre: string
  alumnoNombre: string
  grado: string
  tipoBeca: string
  porcentaje: string
  cicloLabel: string
}

function bytesToObjectUrl(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes)
  return URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }))
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function esMovilViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px)').matches
}

function scrollSuaveA(
  el: HTMLElement | null,
  opts?: ScrollIntoViewOptions
) {
  if (!el || !esMovilViewport()) return
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
  const searchParams = useSearchParams()
  const { session, isAlumno, loading: authLoading } = useAuth()
  const sandbox = searchParams.get('sandbox') === '1'

  const alumnoId = session?.role === 'alumno' ? Number(session.alumno_id) : 0
  const modoReal = !sandbox && isAlumno && alumnoId > 0

  const colFirmaRef = useRef<HTMLDivElement | null>(null)
  const colFirmadoRef = useRef<HTMLDivElement | null>(null)
  const colOrigenRef = useRef<HTMLDivElement | null>(null)

  const [nivel, setNivel] = useState<NivelFirma>('maternal-kinder')
  const [datosUi, setDatosUi] = useState<DatosUi | null>(null)
  const [origenBytes, setOrigenBytes] = useState<Uint8Array | null>(null)
  const [origenUrl, setOrigenUrl] = useState<string | null>(null)
  const [firmaBox, setFirmaBox] = useState<FirmaBox | null>(null)
  const [firmadoUrl, setFirmadoUrl] = useState<string | null>(null)
  const [firmadoBytes, setFirmadoBytes] = useState<Uint8Array | null>(null)
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
  const [bloqueado, setBloqueado] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (sandbox) return
    if (!modoReal) {
      setBloqueado(
        'Inicia sesión como padre de familia o abre el sandbox de pruebas (?sandbox=1).'
      )
      setCargandoDoc(false)
    }
  }, [authLoading, sandbox, modoReal])

  useEffect(() => {
    if (authLoading) return
    if (!sandbox && !modoReal) return

    let cancelled = false
    let url: string | null = null

    ;(async () => {
      try {
        setCargandoDoc(true)
        setError(null)
        setOkMsg(null)
        setBloqueado(null)
        setEnviado(false)
        setMostrarFelicitaciones(false)
        setEnviando(false)
        setAcepto(false)
        setFirmaKey((k) => k + 1)
        setFirmadoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        setFirmadoBytes(null)

        if (sandbox) {
          const { bytes, firmaBox: box } = await crearCartaBecaPdf(nivel)
          const nextUrl = bytesToObjectUrl(bytes)
          if (cancelled) {
            URL.revokeObjectURL(nextUrl)
            return
          }
          url = nextUrl
          const datos = datosCartaParaPdf(nivel)
          setDatosUi({
            tutorNombre: datos.tutorNombre,
            alumnoNombre: datos.alumnoNombre,
            grado: datos.grado,
            tipoBeca: datos.tipoBeca,
            porcentaje: datos.porcentaje,
            cicloLabel: datos.cicloLabel,
          })
          setNombreTutor('')
          setOrigenBytes(bytes)
          setFirmaBox(box)
          setOrigenUrl(nextUrl)
          return
        }

        const estadoRes = await fetch('/api/firma-electronica/estado', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alumnoId }),
        })
        const estadoJson = await estadoRes.json().catch(() => ({}))
        if (!estadoRes.ok) {
          throw new Error(
            typeof estadoJson.error === 'string'
              ? estadoJson.error
              : 'No se pudo validar la autorización de beca.'
          )
        }
        if (!estadoJson.autorizada) {
          setBloqueado(
            estadoJson.pendienteApertura && typeof estadoJson.mensajeApertura === 'string'
              ? estadoJson.mensajeApertura
              : 'Tu beca aún no está autorizada por Control Escolar. Cuando lo esté, podrás firmar aquí la carta de aceptación.'
          )
          setOrigenBytes(null)
          setFirmaBox(null)
          setOrigenUrl(null)
          setDatosUi(null)
          return
        }

        if (estadoJson.activada) {
          const firmadaRes = await fetch(
            `/api/firma-electronica/carta-firmada?alumnoId=${alumnoId}`
          )
          if (firmadaRes.ok) {
            const buf = new Uint8Array(await firmadaRes.arrayBuffer())
            const nextUrl = bytesToObjectUrl(buf)
            if (cancelled) {
              URL.revokeObjectURL(nextUrl)
              return
            }
            url = nextUrl
            setOrigenUrl(nextUrl)
            setOrigenBytes(buf)
            setFirmadoUrl(nextUrl)
            setFirmadoBytes(buf)
            setEnviado(true)
            setFirmaBox(null)
          }

          const cartaRes = await fetch('/api/firma-electronica/carta-alumno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alumnoId }),
          })
          const cartaJson = await cartaRes.json().catch(() => ({}))
          if (cartaRes.ok && cartaJson.datos) {
            setDatosUi({
              tutorNombre: String(cartaJson.datos.tutorNombre || ''),
              alumnoNombre: String(cartaJson.datos.alumnoNombre || ''),
              grado: String(cartaJson.datos.grado || ''),
              tipoBeca: String(cartaJson.datos.tipoBeca || ''),
              porcentaje: String(cartaJson.datos.porcentaje || ''),
              cicloLabel: String(cartaJson.datos.cicloLabel || ''),
            })
            setNombreTutor(String(estadoJson.firmadoPor || ''))
            setNivel(cartaJson.nivel as NivelFirma)
          }
          return
        }

        const cartaRes = await fetch('/api/firma-electronica/carta-alumno', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alumnoId }),
        })
        const cartaJson = await cartaRes.json().catch(() => ({}))
        if (!cartaRes.ok) {
          throw new Error(
            typeof cartaJson.error === 'string'
              ? cartaJson.error
              : 'No se pudo generar la carta de aceptación.'
          )
        }

        const bytes = base64ToBytes(String(cartaJson.pdfBase64 || ''))
        const nextUrl = bytesToObjectUrl(bytes)
        if (cancelled) {
          URL.revokeObjectURL(nextUrl)
          return
        }
        url = nextUrl
        setNivel(cartaJson.nivel as NivelFirma)
        setDatosUi({
          tutorNombre: String(cartaJson.datos?.tutorNombre || ''),
          alumnoNombre: String(cartaJson.datos?.alumnoNombre || ''),
          grado: String(cartaJson.datos?.grado || ''),
          tipoBeca: String(cartaJson.datos?.tipoBeca || ''),
          porcentaje: String(cartaJson.datos?.porcentaje || ''),
          cicloLabel: String(cartaJson.datos?.cicloLabel || ''),
        })
        setNombreTutor('')
        setOrigenBytes(bytes)
        setFirmaBox(cartaJson.firmaBox as FirmaBox)
        setOrigenUrl(nextUrl)
      } catch (e) {
        if (!cancelled) {
          setOrigenBytes(null)
          setFirmaBox(null)
          setOrigenUrl(null)
          setError(
            e instanceof Error
              ? e.message
              : 'No se pudo cargar el documento.'
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
    // En modo real el nivel viene del expediente; no regenerar al setearlo.
  }, [authLoading, sandbox, modoReal, alumnoId, sandbox ? nivel : 'real'])

  useEffect(() => {
    return () => {
      if (firmadoUrl && firmadoUrl !== origenUrl) URL.revokeObjectURL(firmadoUrl)
    }
  }, [firmadoUrl, origenUrl])

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
        setFirmadoBytes(firmado)
        setFirmadoUrl((prev) => {
          if (prev && prev !== origenUrl) URL.revokeObjectURL(prev)
          return nextUrl
        })
        setEnviado(false)
        setOkMsg(
          'Firma aplicada al PDF. Revisa el documento y envía la carta para activar la beca.'
        )
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
    [origenBytes, firmaBox, acepto, nombreTutor, origenUrl]
  )

  const onEnviarCarta = useCallback(async () => {
    setError(null)
    if (!firmadoUrl || !firmadoBytes) {
      setError('Primero guarda la firma para generar el PDF firmado.')
      return
    }
    if (!acepto) {
      setError('Debes marcar que leíste y estás de acuerdo con la carta.')
      return
    }
    setEnviando(true)
    try {
      if (modoReal) {
        const res = await fetch('/api/firma-electronica/activar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alumnoId,
            firmadoPor: nombreTutor.trim(),
            pdfBase64: bytesToBase64(firmadoBytes),
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string'
              ? json.error
              : 'No se pudo activar la beca.'
          )
        }
      } else {
        await new Promise((r) => setTimeout(r, 450))
      }
      setEnviado(true)
      setMostrarFelicitaciones(true)
      setOkMsg(null)
      window.setTimeout(() => {
        scrollSuaveA(colFirmadoRef.current, { block: 'nearest' })
      }, 80)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la carta.')
    } finally {
      setEnviando(false)
    }
  }, [
    firmadoUrl,
    firmadoBytes,
    acepto,
    modoReal,
    alumnoId,
    nombreTutor,
  ])

  const onAceptoChange = useCallback((checked: boolean) => {
    setAcepto(checked)
    if (checked) {
      window.setTimeout(() => {
        scrollSuaveA(colFirmaRef.current)
      }, 60)
    }
  }, [])

  const reiniciarProceso = useCallback(() => {
    if (modoReal && enviado) return
    setFirmadoUrl((prev) => {
      if (prev && prev !== origenUrl) URL.revokeObjectURL(prev)
      return null
    })
    setFirmadoBytes(null)
    setEnviado(false)
    setMostrarFelicitaciones(false)
    setEnviando(false)
    setAcepto(false)
    if (!modoReal) setNombreTutor('')
    setError(null)
    setOkMsg(null)
    setFirmaKey((k) => k + 1)
    window.setTimeout(() => {
      scrollSuaveA(colOrigenRef.current)
    }, 60)
  }, [modoReal, enviado, origenUrl])

  const plantilla = plantillaPorNivel(nivel)
  const datosFallback = datosCartaParaPdf(nivel)
  const datos = datosUi || {
    tutorNombre: datosFallback.tutorNombre,
    alumnoNombre: datosFallback.alumnoNombre,
    grado: datosFallback.grado,
    tipoBeca: datosFallback.tipoBeca,
    porcentaje: datosFallback.porcentaje,
    cicloLabel: datosFallback.cicloLabel,
  }
  const tipoBecaLabel = tipoBecaCompleto(datos.tipoBeca, datos.porcentaje)
  const textoEnviar = `Enviar carta y Activar Beca ${tipoBecaLabel}`
  const puedeFirmar = !bloqueado && !enviado && Boolean(firmaBox)

  const kicker = useMemo(() => {
    if (sandbox) return 'Sandbox · pruebas'
    if (modoReal && enviado) return 'Beca activada'
    if (modoReal) return 'Firma electrónica · beca autorizada'
    return 'Firma electrónica'
  }, [sandbox, modoReal, enviado])

  if (authLoading) {
    return (
      <div className="fe-page">
        <main className="fe-main">
          <p className="fe-alert fe-alert--ok" role="status">
            <Loader2 size={16} className="fe-spin" aria-hidden /> Cargando…
          </p>
        </main>
      </div>
    )
  }

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
              {kicker}
            </span>
          </div>
          {sandbox ? (
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
          ) : null}
          {datosUi || sandbox ? (
            <p className="fe-nivel-hint">
              <span className="fe-nivel-hint-row">
                <span className="fe-nivel-hint-k">
                  {sandbox ? 'Prueba' : 'Alumno'}
                </span>
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
          ) : null}
        </div>
      </header>

      <main className="fe-main">
        {bloqueado ? (
          <p className="fe-alert fe-alert--err" role="alert">
            {bloqueado}
          </p>
        ) : null}
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

        {!bloqueado ? (
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
              {puedeFirmar ? (
                <FirmaCapture
                  key={`${nivel}-${firmaKey}`}
                  disabled={cargandoDoc || !origenBytes}
                  guardando={guardando}
                  firmaAplicada={Boolean(firmadoUrl && !enviado)}
                  enviado={enviado}
                  acepto={acepto}
                  nombreTutor={nombreTutor}
                  onNombreTutorChange={setNombreTutor}
                  checkboxDisabled={cargandoDoc || !origenBytes || enviado}
                  onAceptoChange={onAceptoChange}
                  onGuardarFirma={onGuardarFirma}
                  onError={setError}
                />
              ) : enviado ? (
                <section className="fe-doc-card" aria-label="Beca activada">
                  <header className="fe-doc-head">
                    <h2>2. Firma</h2>
                  </header>
                  <p className="fe-doc-empty">
                    La carta ya fue firmada y la beca está activada
                    {nombreTutor ? ` por ${nombreTutor}` : ''}.
                  </p>
                </section>
              ) : null}
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
                    Confirma el envío de la carta firmada y la activación de la
                    beca. Revisa el PDF abajo antes de continuar.
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
                  {sandbox ? (
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
                  ) : null}
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
        ) : null}
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

export default function FirmaElectronicaPage() {
  return (
    <Suspense
      fallback={
        <div className="fe-page">
          <main className="fe-main">
            <p className="fe-alert fe-alert--ok" role="status">
              Cargando…
            </p>
          </main>
        </div>
      }
    >
      <FirmaElectronicaView />
    </Suspense>
  )
}
