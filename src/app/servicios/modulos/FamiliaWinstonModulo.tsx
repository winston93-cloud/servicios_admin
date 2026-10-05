'use client'

/**
 * 2026-10-05 — Familia Winston: el papá beneficiado muestra el QR de AgendaW, se valida aquí y,
 * si el alumno recomendado ya pagó su primera colegiatura y lleva 30 días de clases, se condona
 * en automático la próxima colegiatura pendiente de su hijo y se le manda el correo.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import UsuariosPinGate from '../components/UsuariosPinGate'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import type {
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

type DetectorQr = { detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorQrCtor = new (opts: { formats: string[] }) => DetectorQr

function soloDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function FamiliaWinstonModulo() {
  const [qr, setQr] = useState('')
  const [ctrl, setCtrl] = useState('')
  const [referido, setReferido] = useState<AlumnoBusquedaResultado | null>(null)
  const [revision, setRevision] = useState<RevisionFamiliaWinston | null>(null)
  const [correoPreview, setCorreoPreview] = useState<string | null>(null)
  const [claveRevisada, setClaveRevisada] = useState('')
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
  const streamRef = useRef<MediaStream | null>(null)
  const [hayDetector, setHayDetector] = useState(false)

  const referidoRef = referido?.alumno_ref ? soloDigitos(String(referido.alumno_ref)) : ''
  const claveActual = `${qr}|${ctrl}|${referidoRef}`

  useEffect(() => {
    setHayDetector(typeof window !== 'undefined' && 'BarcodeDetector' in window)
  }, [])

  const cargarHistorial = useCallback(async () => {
    setCargandoHist(true)
    try {
      const res = await fetch('/api/servicios/familia-winston', { cache: 'no-store' })
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

  const detenerCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamara(false)
  }, [])

  useEffect(() => () => detenerCamara(), [detenerCamara])

  const iniciarCamara = async () => {
    setCamaraError(null)
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorQrCtor }).BarcodeDetector
    if (!Ctor) {
      setCamaraError('Este navegador no lee QR con la cámara. Usa Chrome/Edge, un lector USB o escribe el código.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setCamara(true)
      const detector = new Ctor({ formats: ['qr_code'] })
      requestAnimationFrame(async function leer() {
        const video = videoRef.current
        if (!streamRef.current || !video) return
        if (video.srcObject !== stream) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        try {
          const codigos = video.readyState >= 2 ? await detector.detect(video) : []
          const valor = soloDigitos(codigos[0]?.rawValue ?? '')
          if (valor) {
            setQr(valor)
            detenerCamara()
            return
          }
        } catch {
          /* siguiente cuadro */
        }
        requestAnimationFrame(leer)
      })
    } catch {
      setCamaraError('No se pudo abrir la cámara (revisa el permiso del navegador).')
      detenerCamara()
    }
  }

  const revisar = async () => {
    setError(null)
    setAplicado(null)
    setRevisando(true)
    try {
      const res = await fetch('/api/servicios/familia-winston', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'revisar', qr, ctrl, referidoRef }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        revision?: RevisionFamiliaWinston
        correoPreview?: string | null
        error?: string
      }
      if (!res.ok || !data.revision) {
        setRevision(null)
        setError(data.error ?? 'No se pudo revisar el comprobante.')
        return
      }
      setRevision(data.revision)
      setCorreoPreview(data.correoPreview ?? null)
      setClaveRevisada(claveActual)
    } catch {
      setError('Error de conexión al revisar.')
    } finally {
      setRevisando(false)
    }
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
      const res = await fetch('/api/servicios/familia-winston', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aplicar', qr, ctrl, referidoRef }),
      })
      const data = (await res.json().catch(() => ({}))) as ResultadoAplicado & {
        error?: string
        revision?: RevisionFamiliaWinston
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo aplicar el beneficio.')
        if (data.revision) setRevision(data.revision)
        return
      }
      setAplicado(data)
      setRevision(null)
      setCorreoPreview(null)
      setQr('')
      setCtrl('')
      setReferido(null)
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
      const res = await fetch('/api/servicios/familia-winston', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'inicio-clases', ciclo: valor, fecha: fechasInicio[valor] }),
      })
      const data = (await res.json().catch(() => ({}))) as { ciclos?: CicloInicio[]; error?: string }
      if (!res.ok) {
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

  const revisionVigente = revision && claveRevisada === claveActual
  const puedeRevisar = qr.length >= 4 && ctrl.length >= 3 && !revisando && !aplicando

  return (
    <UsuariosPinGate
      eyebrow="Servicios · Familia Winston"
      titulo="Acceso a Familia Winston"
      lead="Ingresa el PIN para validar comprobantes y condonar colegiaturas."
    >
      <div className="servicios-panel-inner fw">
        <header className="servicios-panel-header">
          <h1 className="servicios-panel-title">
            <HeartHandshake size={22} aria-hidden /> Familia Winston
          </h1>
          <p className="servicios-panel-lead">
            El papá que recomendó muestra su comprobante (QR de AgendaW). Si el alumno recomendado ya
            pagó su primera colegiatura y lleva 30 días de clases, al validar se condona la próxima
            colegiatura pendiente de su hijo y se les manda el correo «FAMILIA WINSTON».
          </p>
        </header>

        <section className="servicios-panel-card fw-card" aria-labelledby="fw-validar">
          <h2 id="fw-validar" className="fw-h2">
            Validar comprobante
          </h2>

          <div className="fw-campos">
            <label className="fw-campo">
              <strong>Código del QR</strong>
              <div className="fw-qr-fila">
                <input
                  className="fw-input"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej. 411841"
                  value={qr}
                  onChange={(e) => setQr(soloDigitos(e.target.value).slice(0, 9))}
                  autoFocus
                />
                {hayDetector ? (
                  <button
                    type="button"
                    className="usr-btn"
                    onClick={() => (camara ? detenerCamara() : void iniciarCamara())}
                    aria-label={camara ? 'Cerrar cámara' : 'Escanear QR con la cámara'}
                  >
                    {camara ? <CameraOff size={16} /> : <Camera size={16} />}
                  </button>
                ) : null}
              </div>
              Escanéalo con la cámara, con un lector USB o escribe el número.
            </label>

            <label className="fw-campo">
              <strong>Matrícula del alumno que recomienda</strong>
              <input
                className="fw-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej. 21334"
                value={ctrl}
                onChange={(e) => setCtrl(soloDigitos(e.target.value).slice(0, 7))}
              />
              Viene en el comprobante («número de control»). Es quien recibe el beneficio.
            </label>

            <div className="fw-campo">
              <strong>Alumno que se inscribió por la recomendación</strong>
              <AlumnoAutocomplete
                etiqueta="Nombre o No. control"
                alumnoSeleccionado={referido}
                onSeleccionar={setReferido}
              />
            </div>
          </div>

          {camara ? (
            <video ref={videoRef} className="fw-video" muted playsInline aria-label="Cámara" />
          ) : null}
          {camaraError ? <p className="fw-alert fw-alert--warn">{camaraError}</p> : null}

          <div className="fw-acciones">
            <button
              type="button"
              className="usr-btn"
              disabled={!puedeRevisar}
              onClick={() => void revisar()}
            >
              {revisando ? <Loader2 className="usr-spin" size={16} /> : <Search size={16} />}
              Revisar
            </button>
            <button
              type="button"
              className="usr-btn usr-btn--primary"
              disabled={!revisionVigente || !revision?.puedeAplicar || aplicando}
              onClick={() => void aplicar()}
            >
              {aplicando ? <Loader2 className="usr-spin" size={16} /> : <ShieldCheck size={16} />}
              Validar y aplicar beneficio
            </button>
          </div>

          {error ? (
            <p className="fw-alert fw-alert--err" role="alert">
              {error}
            </p>
          ) : null}

          {aplicado ? (
            <div className="fw-alert fw-alert--ok" role="status">
              <strong>¡Listo! Comprobante {aplicado.folio} validado.</strong> Se condonó la colegiatura
              de {aplicado.mes.mes.toUpperCase()} {aplicado.mes.cicloEtiqueta} (referencia{' '}
              {aplicado.pagoReferencia}).{' '}
              {aplicado.correo.enviado
                ? `Correo enviado a ${aplicado.correo.destinatarios.join(', ')}.`
                : `Correo no enviado: ${aplicado.correo.detalle}`}
            </div>
          ) : null}

          {revision ? (
            <>
              {!revisionVigente ? (
                <p className="fw-alert fw-alert--warn">
                  Cambiaste algún dato: vuelve a dar «Revisar» antes de validar.
                </p>
              ) : null}
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

              {revision.puedeAplicar && revision.mesPropuesto && revision.beneficiado ? (
                <div className="fw-resumen">
                  <div className="fw-dato">
                    <span>Recibe el beneficio</span>
                    <strong>{revision.beneficiado.nombre}</strong>
                  </div>
                  <div className="fw-dato">
                    <span>Colegiatura que se condona</span>
                    <strong>
                      {revision.mesPropuesto.mes} {revision.mesPropuesto.cicloEtiqueta}
                    </strong>
                  </div>
                  <div className="fw-dato">
                    <span>Correo a</span>
                    <strong>
                      {revision.destinatarios.length > 0
                        ? revision.destinatarios.map((d) => d.email).join(', ')
                        : 'Sin correo autorizado'}
                    </strong>
                  </div>
                </div>
              ) : null}

              {revision.puedeAplicar && correoPreview ? (
                <details>
                  <summary className="fw-hint">Ver el correo que se va a mandar</summary>
                  <p className="fw-correo">{correoPreview}</p>
                </details>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="servicios-panel-card fw-card" aria-labelledby="fw-historial">
          <div className="fw-acciones" style={{ justifyContent: 'space-between' }}>
            <h2 id="fw-historial" className="fw-h2">
              Beneficios aplicados
            </h2>
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
          <p className="fw-hint">Comprobantes de AgendaW sin usar: {pendientes}.</p>
          {historial.length === 0 ? (
            <p className="fw-hint">Todavía no hay beneficios validados desde este módulo.</p>
          ) : (
            <div className="fw-tabla-wrap">
              <table className="fw-tabla">
                <thead>
                  <tr>
                    <th scope="col">Folio</th>
                    <th scope="col">Recibe el beneficio</th>
                    <th scope="col">Recomendó a</th>
                    <th scope="col">Mes condonado</th>
                    <th scope="col">Validó</th>
                    <th scope="col">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id}>
                      <td>{h.folio}</td>
                      <td>
                        {h.beneficiadoNombre ?? '—'}
                        <span className="fw-sub">{h.ctrl}</span>
                      </td>
                      <td>
                        {h.referidoNombre ?? '—'}
                        {h.referidoRef ? <span className="fw-sub">{h.referidoRef}</span> : null}
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
                        {h.correoEnviadoEn ? 'Enviado' : h.correoResultado ? 'No enviado' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="servicios-panel-card fw-card" aria-labelledby="fw-inicio">
          <h2 id="fw-inicio" className="fw-h2">
            Inicio de clases
          </h2>
          <p className="fw-hint">
            Los 30 días de clases del alumno recomendado se cuentan desde esta fecha o desde su alta,
            la que sea más tarde.
          </p>
          <div className="fw-inicio">
            {ciclos.map((c) => (
              <div key={c.valor} className="fw-inicio">
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
        </section>
      </div>
    </UsuariosPinGate>
  )
}
