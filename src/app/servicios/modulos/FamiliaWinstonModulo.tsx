'use client'

/**
 * 2026-10-05 — Familia Winston: el papá beneficiado muestra el QR de AgendaW, se valida aquí y,
 * si el alumno recomendado ya pagó su primera colegiatura y lleva 30 días de clases, se condona
 * en automático la próxima colegiatura pendiente de su hijo y se le manda el correo.
 * 2026-10-05 — Rediseño en 3 pasos: lectura del QR con cámara (jsQR, cualquier navegador),
 * búsqueda por nombre o número de control y «quién recomendó» se llena solo al leer el QR.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Mail,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import UsuariosPinGate from '../components/UsuariosPinGate'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import type {
  AlumnoQrFamiliaWinston,
  ComprobanteFamiliaWinston,
  FilaHistorialFamiliaWinston,
  RevisionFamiliaWinston,
} from '@/lib/familiaWinstonService'
import './familia-winston.css'

type CicloInicio = { valor: number; nombre: string; inicioClases: string | null; esActual: boolean }

type ResultadoAplicado = {
  folio: string
  mes: { mes: string; cicloEtiqueta: string }
  pagoReferencia: string
  correo: { enviado: boolean; destinatarios: string[]; detalle: string }
}

type ComprobanteQr = { comprobante: ComprobanteFamiliaWinston; alumno: AlumnoQrFamiliaWinston | null }

const API = '/api/servicios/familia-winston'
const DIGITOS_QR = 6

function soloDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function dinero(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

/** 2026-10-06 — «36 días (1 mes y 6 días)» para la antigüedad del alumno recomendado. */
function textoAntiguedad(dias: number): string {
  const meses = Math.floor(dias / 30)
  const resto = dias % 30
  const detalle =
    meses > 0
      ? ` (${meses} ${meses === 1 ? 'mes' : 'meses'}${resto ? ` y ${resto} ${resto === 1 ? 'día' : 'días'}` : ''})`
      : ''
  return `${dias} ${dias === 1 ? 'día' : 'días'}${detalle}`
}

function alumnoParaBuscador(a: AlumnoQrFamiliaWinston): AlumnoBusquedaResultado {
  return {
    ...a,
    nombre_completo: [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' '),
    puntuacion: 0,
    campos_coincidentes: [],
  }
}

async function postApi<T>(body: Record<string, unknown>): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, data }
}

export default function FamiliaWinstonModulo() {
  const [formKey, setFormKey] = useState(0)
  const [qr, setQr] = useState('')
  const [beneficiado, setBeneficiado] = useState<AlumnoBusquedaResultado | null>(null)
  const [referido, setReferido] = useState<AlumnoBusquedaResultado | null>(null)

  const [buscandoQr, setBuscandoQr] = useState(false)
  const [qrBuscado, setQrBuscado] = useState('')
  const [comprobantesQr, setComprobantesQr] = useState<ComprobanteQr[]>([])

  const [revision, setRevision] = useState<RevisionFamiliaWinston | null>(null)
  const [correoPreview, setCorreoPreview] = useState<string | null>(null)
  const [claveRevisada, setClaveRevisada] = useState('')
  /** 2026-10-05 — Mes a condonar elegido ('' = próxima colegiatura pendiente). */
  const [mesElegido, setMesElegido] = useState('')
  const [revisando, setRevisando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aplicado, setAplicado] = useState<ResultadoAplicado | null>(null)

  const [historial, setHistorial] = useState<FilaHistorialFamiliaWinston[]>([])
  const [pendientes, setPendientes] = useState(0)
  const [ciclos, setCiclos] = useState<CicloInicio[]>([])
  const [fechasInicio, setFechasInicio] = useState<Record<number, string>>({})
  const [cargandoHist, setCargandoHist] = useState(false)
  const [guardandoInicio, setGuardandoInicio] = useState<number | null>(null)

  const [camara, setCamara] = useState(false)
  const [camaraError, setCamaraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const ctrl = beneficiado ? soloDigitos(String(beneficiado.alumno_ref)) : ''
  const referidoRef = referido ? soloDigitos(String(referido.alumno_ref)) : ''
  const claveActual = `${qr}|${ctrl}|${referidoRef}|${mesElegido}`
  const completo = qr.length >= DIGITOS_QR && !!ctrl && !!referidoRef

  const cargarHistorial = useCallback(async () => {
    setCargandoHist(true)
    try {
      const res = await fetch(API, { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as {
        aplicados?: FilaHistorialFamiliaWinston[]
        pendientes?: number
        ciclos?: CicloInicio[]
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cargar el historial.')
        return
      }
      setHistorial(data.aplicados ?? [])
      setPendientes(data.pendientes ?? 0)
      setCiclos(data.ciclos ?? [])
      setFechasInicio(
        Object.fromEntries((data.ciclos ?? []).map((c) => [c.valor, c.inicioClases ?? '']))
      )
    } catch {
      setError('Error de conexión al cargar el historial.')
    } finally {
      setCargandoHist(false)
    }
  }, [])

  useEffect(() => {
    void cargarHistorial()
  }, [cargarHistorial])

  /* Cámara: getUserMedia + jsQR sobre cuadros reducidos (Chrome, Safari, Firefox, celular). */
  useEffect(() => {
    if (!camara) return
    let cancelado = false
    let stream: MediaStream | null = null
    let raf = 0
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('sin-camara')
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelado) return
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play().catch(() => undefined)
        const { default: jsQR } = await import('jsqr')
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        let ultimo = 0
        const leer = (t: number) => {
          if (cancelado) return
          raf = requestAnimationFrame(leer)
          if (!ctx || t - ultimo < 120 || video.readyState < 2) return
          ultimo = t
          const w = video.videoWidth
          const h = video.videoHeight
          if (!w || !h) return
          const escala = Math.min(1, 720 / Math.max(w, h))
          canvas.width = Math.round(w * escala)
          canvas.height = Math.round(h * escala)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const codigo = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
          const valor = soloDigitos(codigo?.data ?? '')
          if (valor) {
            cancelado = true
            navigator.vibrate?.(80)
            setQr(valor.slice(0, 9))
            setCamara(false)
          }
        }
        raf = requestAnimationFrame(leer)
      } catch {
        if (!cancelado) {
          setCamaraError(
            'No se pudo abrir la cámara. Revisa el permiso del navegador o escribe el código que viene debajo del QR.'
          )
          setCamara(false)
        }
      }
    })()
    return () => {
      cancelado = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [camara])

  /* Al tener el código completo: buscar el comprobante y llenar «quién recomendó». */
  useEffect(() => {
    if (qr.length < DIGITOS_QR || qr === qrBuscado) return
    const id = window.setTimeout(async () => {
      setBuscandoQr(true)
      try {
        const { ok, data } = await postApi<{ comprobantes?: ComprobanteQr[]; error?: string }>({
          accion: 'qr',
          qr,
        })
        if (!ok) {
          setError(data.error ?? 'No se pudo buscar el comprobante.')
          return
        }
        const lista = data.comprobantes ?? []
        setComprobantesQr(lista)
        setQrBuscado(qr)
        if (lista.length === 1 && lista[0].alumno) {
          setBeneficiado(alumnoParaBuscador(lista[0].alumno))
        }
      } catch {
        setError('Error de conexión al buscar el comprobante.')
      } finally {
        setBuscandoQr(false)
      }
    }, 250)
    return () => window.clearTimeout(id)
  }, [qr, qrBuscado])

  const revisar = useCallback(async () => {
    setError(null)
    setRevisando(true)
    const base = `${qr}|${ctrl}|${referidoRef}`
    if (!claveRevisada.startsWith(`${base}|`)) setRevision(null)
    setClaveRevisada(`${base}|${mesElegido}`)
    try {
      const { ok, data } = await postApi<{
        revision?: RevisionFamiliaWinston
        correoPreview?: string | null
        error?: string
      }>({ accion: 'revisar', qr, ctrl, referidoRef, conceptoNo: mesElegido })
      if (!ok || !data.revision) {
        setRevision(null)
        setError(data.error ?? 'No se pudo revisar el comprobante.')
        return
      }
      setRevision(data.revision)
      setCorreoPreview(data.correoPreview ?? null)
    } catch {
      setError('Error de conexión al revisar.')
    } finally {
      setRevisando(false)
    }
  }, [qr, ctrl, referidoRef, mesElegido, claveRevisada])

  /* Otro beneficiado = otras colegiaturas pendientes: volver a proponer la próxima. */
  useEffect(() => {
    setMesElegido('')
  }, [ctrl])

  /* 2026-10-06 — Si quien recomendó quedó también como recomendado, se quita (no puede ser el mismo). */
  useEffect(() => {
    if (ctrl && referidoRef === ctrl) {
      setReferido(null)
      setFormKey((k) => k + 1)
    }
  }, [ctrl, referidoRef])

  /* Revisión automática en cuanto están los 3 datos. */
  useEffect(() => {
    if (!completo || revisando || aplicando || claveRevisada === claveActual) return
    const id = window.setTimeout(() => void revisar(), 300)
    return () => window.clearTimeout(id)
  }, [completo, revisando, aplicando, claveRevisada, claveActual, revisar])

  const limpiar = () => {
    setQr('')
    setQrBuscado('')
    setComprobantesQr([])
    setBeneficiado(null)
    setReferido(null)
    setRevision(null)
    setCorreoPreview(null)
    setClaveRevisada('')
    setMesElegido('')
    setError(null)
    setAplicado(null)
    setCamara(false)
    setCamaraError(null)
    setFormKey((k) => k + 1)
  }

  const aplicar = async () => {
    if (!revision?.puedeAplicar || !revision.mesPropuesto || !revision.beneficiado) return
    const ok = window.confirm(
      `¿Validar el comprobante y condonar la colegiatura de ${revision.mesPropuesto.mes.toUpperCase()} ${revision.mesPropuesto.cicloEtiqueta} a ${revision.beneficiado.nombre}?\n\nSe registra el pago en $0 y se manda el correo a los papás.`
    )
    if (!ok) return
    setError(null)
    setAplicando(true)
    try {
      const { ok: okRes, data } = await postApi<
        ResultadoAplicado & { error?: string; revision?: RevisionFamiliaWinston }
      >({ accion: 'aplicar', qr, ctrl, referidoRef, conceptoNo: revision.mesPropuesto.conceptoNo })
      if (!okRes) {
        setError(data.error ?? 'No se pudo aplicar el beneficio.')
        if (data.revision) setRevision(data.revision)
        return
      }
      setAplicado(data)
      void cargarHistorial()
    } catch {
      setError('Error de conexión al aplicar.')
    } finally {
      setAplicando(false)
    }
  }

  const guardarInicio = async (valor: number) => {
    setGuardandoInicio(valor)
    setError(null)
    try {
      const { ok, data } = await postApi<{ ciclos?: CicloInicio[]; error?: string }>({
        accion: 'inicio-clases',
        ciclo: valor,
        fecha: fechasInicio[valor],
      })
      if (!ok) {
        setError(data.error ?? 'No se pudo guardar el inicio de clases.')
        return
      }
      setCiclos(data.ciclos ?? [])
    } catch {
      setError('Error de conexión al guardar.')
    } finally {
      setGuardandoInicio(null)
    }
  }

  const revisionVigente =
    !!revision && claveRevisada.startsWith(`${qr}|${ctrl}|${referidoRef}|`)
  const mesActivo = mesElegido || revision?.mesesDisponibles[0]?.conceptoNo || ''
  const cambiandoMes = revisando && !!revision && claveRevisada !== claveActual
  const errores = revision?.checks.filter((c) => c.nivel === 'error') ?? []
  const soloFaltanDias = errores.length === 1 && errores[0].id === 'dias-clases'
  const qrSinComprobante = qrBuscado === qr && qr.length >= DIGITOS_QR && comprobantesQr.length === 0

  return (
    <UsuariosPinGate
      eyebrow="Servicios · Familia Winston"
      titulo="Acceso a Familia Winston"
      lead="Ingresa el PIN para validar comprobantes y condonar colegiaturas."
    >
      <div className="servicios-panel-inner fw">
        <header className="fw-hero">
          <span className="fw-hero-icono" aria-hidden>
            <HeartHandshake size={26} />
          </span>
          <div>
            <h1 className="fw-hero-titulo">Familia Winston</h1>
            <p className="fw-hero-lead">
              Cuando una familia recomienda a otra y el alumno nuevo ya cumplió su primer mes, su hijo
              recibe gratis su próxima colegiatura.
            </p>
          </div>
        </header>

        <ol className="fw-pasos-guia" aria-label="Cómo funciona">
          <li>
            <QrCode size={18} aria-hidden /> Escanea el QR del comprobante
          </li>
          <li>
            <UserPlus size={18} aria-hidden /> Elige al alumno que se inscribió
          </li>
          <li>
            <ShieldCheck size={18} aria-hidden /> Revisa los requisitos y valida
          </li>
        </ol>

        <div className="fw-layout">
          {/* ── Captura ─────────────────────────────────────────── */}
          <section className="servicios-panel-card fw-card" aria-labelledby="fw-validar">
            <div className="fw-card-cabeza">
              <h2 id="fw-validar" className="fw-h2">
                Validar comprobante
              </h2>
              {qr || beneficiado || referido ? (
                <button type="button" className="fw-btn-link" onClick={limpiar}>
                  <RotateCcw size={14} aria-hidden /> Empezar de nuevo
                </button>
              ) : null}
            </div>

            {/* Paso 1 — QR */}
            <div className={`fw-paso ${qr.length >= DIGITOS_QR ? 'fw-paso--hecho' : ''}`}>
              <div className="fw-paso-num" aria-hidden>
                {qr.length >= DIGITOS_QR ? <CheckCircle2 size={18} /> : 1}
              </div>
              <div className="fw-paso-cuerpo">
                <p className="fw-paso-titulo">Código QR del comprobante</p>
                <p className="fw-paso-ayuda">
                  Escanéalo con la cámara o escribe el número que viene debajo del QR.
                </p>

                {camara ? (
                  <div className="fw-scanner">
                    <video ref={videoRef} className="fw-scanner-video" muted playsInline />
                    <span className="fw-scanner-marco" aria-hidden />
                    <p className="fw-scanner-texto">Acerca el QR al recuadro…</p>
                    <button
                      type="button"
                      className="fw-scanner-cerrar"
                      onClick={() => setCamara(false)}
                      aria-label="Cerrar cámara"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="fw-qr-captura">
                    <button
                      type="button"
                      className="usr-btn usr-btn--primary fw-btn-camara"
                      onClick={() => {
                        setCamaraError(null)
                        setCamara(true)
                      }}
                    >
                      <Camera size={18} /> Escanear con cámara
                    </button>
                    <span className="fw-o">o</span>
                    <input
                      className="fw-input fw-input-qr"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000000"
                      aria-label="Código del QR"
                      value={qr}
                      onChange={(e) => setQr(soloDigitos(e.target.value).slice(0, 9))}
                    />
                  </div>
                )}

                {camaraError ? <p className="fw-alert fw-alert--warn">{camaraError}</p> : null}
                {buscandoQr ? (
                  <p className="fw-nota">
                    <Loader2 className="usr-spin" size={14} /> Buscando comprobante…
                  </p>
                ) : null}
                {qrSinComprobante ? (
                  <p className="fw-alert fw-alert--err">
                    No hay ningún comprobante de AgendaW con el código {qr}. Revisa el número.
                  </p>
                ) : null}
                {qrBuscado === qr && comprobantesQr.length > 0 ? (
                  <div className="fw-comprobantes">
                    {comprobantesQr.map(({ comprobante: c, alumno }) => {
                      const usado = c.status === 'autorizado'
                      const elegido = alumno && ctrl === soloDigitos(String(alumno.alumno_ref))
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`fw-comprobante ${elegido ? 'fw-comprobante--activo' : ''}`}
                          onClick={() => alumno && setBeneficiado(alumnoParaBuscador(alumno))}
                          disabled={!alumno}
                        >
                          <span className="fw-comprobante-folio">{c.folio}</span>
                          <span className={`fw-chip ${usado ? 'fw-chip--err' : 'fw-chip--ok'}`}>
                            {usado ? 'Ya usado' : 'Sin usar'}
                          </span>
                          <span className="fw-comprobante-alumno">
                            {alumno
                              ? `${[alumno.alumno_nombre, alumno.alumno_app, alumno.alumno_apm]
                                  .filter(Boolean)
                                  .join(' ')} · No. control ${alumno.alumno_ref}`
                              : `No. control ${c.ctrl} (no encontrado)`}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Paso 2 — quién recomendó */}
            <div className={`fw-paso ${beneficiado ? 'fw-paso--hecho' : ''}`}>
              <div className="fw-paso-num" aria-hidden>
                {beneficiado ? <CheckCircle2 size={18} /> : 2}
              </div>
              <div className="fw-paso-cuerpo">
                <p className="fw-paso-titulo">
                  <UserCheck size={16} aria-hidden /> ¿Quién recomendó?
                </p>
                <p className="fw-paso-ayuda">
                  Alumno de la familia que recomendó; él recibe el beneficio. Se llena solo al leer el
                  QR.
                </p>
                <AlumnoAutocomplete
                  key={`ben-${formKey}`}
                  etiqueta="Nombre o número de control"
                  alumnoSeleccionado={beneficiado}
                  onSeleccionar={setBeneficiado}
                  autoFocus={false}
                />
              </div>
            </div>

            {/* Paso 3 — a quién recomendó */}
            <div className={`fw-paso ${referido ? 'fw-paso--hecho' : ''}`}>
              <div className="fw-paso-num" aria-hidden>
                {referido ? <CheckCircle2 size={18} /> : 3}
              </div>
              <div className="fw-paso-cuerpo">
                <p className="fw-paso-titulo">
                  <UserPlus size={16} aria-hidden /> ¿A quién recomendó?
                </p>
                {/* 2026-10-06: el número del comprobante es el de quien recomienda → se ponía aquí por error */}
                <p className="fw-paso-ayuda">
                  El alumno nuevo que se inscribió gracias a la recomendación: búscalo por el nombre del
                  «interesado» que viene en el comprobante. El número de control del comprobante es el de
                  quien recomendó, no va aquí.
                </p>
                <AlumnoAutocomplete
                  key={`ref-${formKey}`}
                  etiqueta="Nombre o número de control"
                  alumnoSeleccionado={referido}
                  onSeleccionar={setReferido}
                  autoFocus={false}
                  excluirRefs={ctrl ? [ctrl] : undefined}
                  mensajeExcluido={`${beneficiado?.nombre_completo ?? 'Ese alumno'} es quien recomendó; no se puede recomendar a sí mismo. Busca al alumno nuevo por su nombre.`}
                />
              </div>
            </div>
          </section>

          {/* ── Resultado ───────────────────────────────────────── */}
          <section
            className="servicios-panel-card fw-card fw-resultado"
            aria-labelledby="fw-res"
            aria-live="polite"
          >
            <h2 id="fw-res" className="fw-h2">
              Resultado
            </h2>

            {error ? (
              <p className="fw-alert fw-alert--err" role="alert">
                {error}
              </p>
            ) : null}

            {aplicado ? (
              <div className="fw-exito">
                <CheckCircle2 size={44} aria-hidden />
                <p className="fw-exito-titulo">¡Beneficio aplicado!</p>
                <dl className="fw-exito-datos">
                  <div>
                    <dt>Comprobante</dt>
                    <dd>{aplicado.folio}</dd>
                  </div>
                  <div>
                    <dt>Colegiatura condonada</dt>
                    <dd>
                      {aplicado.mes.mes} {aplicado.mes.cicloEtiqueta}
                    </dd>
                  </div>
                  <div>
                    <dt>Referencia del pago</dt>
                    <dd>{aplicado.pagoReferencia}</dd>
                  </div>
                  <div>
                    <dt>Correo</dt>
                    <dd>
                      {aplicado.correo.enviado
                        ? `Enviado a ${aplicado.correo.destinatarios.join(', ')}`
                        : `No enviado: ${aplicado.correo.detalle}`}
                    </dd>
                  </div>
                </dl>
                <button type="button" className="usr-btn usr-btn--primary" onClick={limpiar}>
                  <QrCode size={16} /> Validar otro comprobante
                </button>
              </div>
            ) : revisando && !revision ? (
              <div className="fw-vacio">
                <Loader2 className="usr-spin" size={28} aria-hidden />
                <p>Revisando requisitos…</p>
              </div>
            ) : revision && revisionVigente ? (
              <>
                <div
                  className={`fw-veredicto ${
                    revision.puedeAplicar ? 'fw-veredicto--ok' : 'fw-veredicto--err'
                  }`}
                >
                  {revision.puedeAplicar ? (
                    <CheckCircle2 size={30} aria-hidden />
                  ) : (
                    <XCircle size={30} aria-hidden />
                  )}
                  <div>
                    <p className="fw-veredicto-titulo">
                      {revision.puedeAplicar
                        ? 'Procede el beneficio'
                        : soloFaltanDias
                          ? 'Todavía no cumple su primer mes de clases'
                          : 'Todavía no procede'}
                    </p>
                    <p className="fw-veredicto-sub">
                      {revision.puedeAplicar
                        ? 'Revisa los datos, elige el mes si quieres otro y presiona «Validar y aplicar».'
                        : soloFaltanDias && revision.fechaDisponible
                          ? `Se podrá validar a partir del ${fechaCorta(revision.fechaDisponible)}.`
                          : errores[0]?.texto}
                    </p>
                  </div>
                </div>

                {/* 2026-10-06 — Alumno recomendado: cuándo pagó su inscripción y cuánto lleva estudiando */}
                {revision.referido && revision.infoReferido ? (
                  <div className="fw-resumen fw-referido">
                    <div className="fw-dato">
                      <span>
                        <UserPlus size={14} aria-hidden /> Alumno recomendado
                      </span>
                      <strong>{revision.referido.nombre}</strong>
                      <small className="fw-sub">No. control {revision.referido.alumno_ref}</small>
                    </div>
                    <div className="fw-dato">
                      <span>
                        <Receipt size={14} aria-hidden /> Pagó su inscripción
                      </span>
                      <strong>
                        {revision.infoReferido.inscripcion
                          ? `${fechaCorta(revision.infoReferido.inscripcion.fecha)} · ${dinero(revision.infoReferido.inscripcion.importe)}`
                          : 'Sin pago de inscripción registrado'}
                      </strong>
                      {revision.infoReferido.primeraColegiatura ? (
                        <small className="fw-sub">
                          Primera colegiatura ({revision.infoReferido.primeraColegiatura.mes}):{' '}
                          {fechaCorta(revision.infoReferido.primeraColegiatura.fecha)}
                        </small>
                      ) : null}
                    </div>
                    <div className="fw-dato">
                      <span>
                        <GraduationCap size={14} aria-hidden /> Lleva estudiando
                      </span>
                      <strong>
                        {revision.infoReferido.diasEstudiando != null
                          ? textoAntiguedad(revision.infoReferido.diasEstudiando)
                          : '—'}
                      </strong>
                      {revision.infoReferido.estudiaDesde ? (
                        <small className="fw-sub">
                          Desde el {fechaCorta(revision.infoReferido.estudiaDesde)}
                        </small>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {revision.beneficiado &&
                revision.mesesDisponibles.length > 0 &&
                (revision.puedeAplicar || errores.every((e) => e.id === 'mes')) ? (
                  <div className="fw-resumen">
                    <div className="fw-dato">
                      <span>
                        <UserCheck size={14} aria-hidden /> Recibe el beneficio
                      </span>
                      <strong>{revision.beneficiado.nombre}</strong>
                    </div>
                    {/* 2026-10-05 — Elegir el mes a condonar entre las colegiaturas pendientes. */}
                    <div className="fw-dato fw-dato--acento">
                      <span>
                        <CalendarDays size={14} aria-hidden /> Colegiatura que se condona
                        {cambiandoMes ? <Loader2 className="usr-spin" size={13} aria-hidden /> : null}
                      </span>
                      <strong>
                        {revision.mesPropuesto
                          ? `${revision.mesPropuesto.mes} ${revision.mesPropuesto.cicloEtiqueta}`
                          : 'Elige un mes'}
                      </strong>
                      {revision.mesesDisponibles.length > 1 ? (
                        <div className="fw-meses" role="radiogroup" aria-label="Mes a condonar">
                          {revision.mesesDisponibles.map((m, i) => (
                            <button
                              key={m.conceptoNo}
                              type="button"
                              role="radio"
                              aria-checked={mesActivo === m.conceptoNo}
                              className={`fw-mes ${mesActivo === m.conceptoNo ? 'fw-mes--activo' : ''}`}
                              disabled={aplicando}
                              onClick={() => setMesElegido(i === 0 ? '' : m.conceptoNo)}
                            >
                              {m.mes}
                              {i === 0 ? <small>próxima</small> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="fw-dato">
                      <span>
                        <Mail size={14} aria-hidden /> Se avisará por correo a
                      </span>
                      <strong className="fw-dato-correos">
                        {revision.destinatarios.length > 0
                          ? revision.destinatarios.map((d) => (
                              <span key={d.email}>
                                {d.tutorId === 1 ? 'Mamá' : d.tutorId === 2 ? 'Papá' : 'Familiar'}:{' '}
                                {d.email}
                              </span>
                            ))
                          : 'Sin correo autorizado'}
                      </strong>
                    </div>
                  </div>
                ) : null}

                <details className="fw-plegable" open={!revision.puedeAplicar}>
                  <summary>
                    <ClipboardCheck size={16} aria-hidden /> Requisitos revisados (
                    {revision.checks.filter((c) => c.nivel === 'ok').length}/{revision.checks.length})
                    <ChevronDown size={16} className="fw-plegable-flecha" aria-hidden />
                  </summary>
                  <ul className="fw-checks">
                    {revision.checks.map((c) => (
                      <li key={c.id} className={`fw-check fw-check--${c.nivel}`}>
                        {c.nivel === 'ok' ? (
                          <CheckCircle2 size={18} aria-hidden />
                        ) : c.nivel === 'aviso' ? (
                          <AlertTriangle size={18} aria-hidden />
                        ) : (
                          <XCircle size={18} aria-hidden />
                        )}
                        <span>{c.texto}</span>
                      </li>
                    ))}
                  </ul>
                </details>

                {revision.puedeAplicar && correoPreview ? (
                  <details className="fw-plegable">
                    <summary>
                      <Mail size={16} aria-hidden /> Ver el correo que se va a mandar
                      <ChevronDown size={16} className="fw-plegable-flecha" aria-hidden />
                    </summary>
                    <p className="fw-correo">{correoPreview}</p>
                  </details>
                ) : null}

                <div className="fw-acciones">
                  <button
                    type="button"
                    className="usr-btn"
                    disabled={revisando || aplicando}
                    onClick={() => void revisar()}
                  >
                    {revisando ? <Loader2 className="usr-spin" size={16} /> : <RefreshCw size={16} />}
                    Volver a revisar
                  </button>
                  {revision.puedeAplicar ? (
                    <button
                      type="button"
                      className="usr-btn usr-btn--primary fw-btn-aplicar"
                      disabled={aplicando || revisando}
                      onClick={() => void aplicar()}
                    >
                      {aplicando ? (
                        <Loader2 className="usr-spin" size={18} />
                      ) : (
                        <ShieldCheck size={18} />
                      )}
                      Validar y aplicar beneficio
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="fw-vacio">
                <ClipboardCheck size={34} aria-hidden />
                <p>
                  Completa los 3 pasos y aquí verás si procede el beneficio, qué mes se condona y a
                  quién se le avisa.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ── Historial ─────────────────────────────────────────── */}
        <section className="servicios-panel-card fw-card" aria-labelledby="fw-historial">
          <div className="fw-card-cabeza">
            <h2 id="fw-historial" className="fw-h2">
              Beneficios aplicados
            </h2>
            <div className="fw-cabeza-der">
              <span className="fw-chip">Comprobantes sin usar: {pendientes}</span>
              <button
                type="button"
                className="usr-btn"
                disabled={cargandoHist}
                onClick={() => void cargarHistorial()}
              >
                {cargandoHist ? <Loader2 className="usr-spin" size={16} /> : <RefreshCw size={16} />}
                Actualizar
              </button>
            </div>
          </div>
          {historial.length === 0 ? (
            <p className="fw-hint">Todavía no hay beneficios validados desde este módulo.</p>
          ) : (
            <div className="fw-tabla-wrap">
              <table className="fw-tabla">
                <thead>
                  <tr>
                    <th scope="col">Comprobante</th>
                    <th scope="col">Recibió el beneficio</th>
                    <th scope="col">Recomendó a</th>
                    <th scope="col">Mes condonado</th>
                    <th scope="col">Validó</th>
                    <th scope="col">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <strong>{h.folio}</strong>
                      </td>
                      <td>
                        {h.beneficiadoNombre ?? '—'}
                        <span className="fw-sub">No. control {h.ctrl}</span>
                      </td>
                      <td>
                        {h.referidoNombre ?? '—'}
                        {h.referidoRef ? (
                          <span className="fw-sub">No. control {h.referidoRef}</span>
                        ) : null}
                      </td>
                      <td>
                        {h.mes ?? '—'}
                        {h.pagoReferencia ? <span className="fw-sub">{h.pagoReferencia}</span> : null}
                      </td>
                      <td>
                        {h.validadoPor ?? '—'}
                        <span className="fw-sub">{fmtFechaHora(h.validadoEn)}</span>
                      </td>
                      <td>
                        {h.correoEnviadoEn ? (
                          <span className="fw-chip fw-chip--ok">Enviado</span>
                        ) : h.correoResultado ? (
                          <span className="fw-chip fw-chip--err">No enviado</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Configuración ─────────────────────────────────────── */}
        <details className="servicios-panel-card fw-card fw-plegable fw-config">
          <summary>
            <CalendarDays size={16} aria-hidden /> Inicio de clases por ciclo
            <ChevronDown size={16} className="fw-plegable-flecha" aria-hidden />
          </summary>
          <p className="fw-hint">
            El primer mes (30 días) del alumno recomendado se cuenta desde esta fecha o desde su alta,
            la que sea más tarde.
          </p>
          <div className="fw-inicio">
            {ciclos.map((c) => (
              <div key={c.valor} className="fw-inicio-item">
                <label className="fw-campo">
                  <strong>
                    {c.nombre}
                    {c.esActual ? ' (actual)' : ''}
                  </strong>
                  <input
                    type="date"
                    className="fw-input"
                    value={fechasInicio[c.valor] ?? ''}
                    onChange={(e) =>
                      setFechasInicio((prev) => ({ ...prev, [c.valor]: e.target.value }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="usr-btn"
                  disabled={
                    guardandoInicio === c.valor ||
                    !fechasInicio[c.valor] ||
                    fechasInicio[c.valor] === (c.inicioClases ?? '')
                  }
                  onClick={() => void guardarInicio(c.valor)}
                >
                  {guardandoInicio === c.valor ? <Loader2 className="usr-spin" size={16} /> : null}
                  Guardar
                </button>
              </div>
            ))}
          </div>
        </details>
      </div>
    </UsuariosPinGate>
  )
}
