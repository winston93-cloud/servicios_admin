'use client'

/**
 * 2026-10-05 — Familia Winston: el papá beneficiado muestra el QR de AgendaW, se valida aquí y,
 * si el alumno recomendado ya pagó su primera colegiatura y lleva 30 días de clases, se condona
 * en automático la próxima colegiatura pendiente de su hijo y se le manda el correo.
 * 2026-10-05 — Rediseño en 3 pasos: lectura del QR con cámara (jsQR, cualquier navegador),
 * búsqueda por nombre o número de control y «quién recomendó» se llena solo al leer el QR.
 * 2026-10-06 — «A quién recomendó» también se llena solo con el interesado/cita que AgendaW
 * guarda en el comprobante; en comprobantes viejos se sugieren alumnos por apellido.
 * 2026-10-06 — «Subir comprobante (PDF)»: el servidor lee QR, control e interesado del PDF y se
 * llena todo solo; escribir el nombre a mano sigue disponible.
 * 2026-10-06 — Pestañas «Validar | Pendientes | Aplicados»: seguimiento por ciclo (por defecto el
 * «Ciclo activo» del panel) de los comprobantes que faltan y los beneficios aplicados
 * (FamiliaWinstonSeguimiento). «Validar» desde la lista abre el validador con ese comprobante.
 * 2026-10-06 — Rediseño de presentación y estructura: encabezado con reglas desplegables, pestañas con
 * descripción y contador, avance de 4 pasos con estado visible, resultado «Procede / No procede» con
 * motivos y qué sigue, y cierre al aplicar con «Validar otro» / «Ver aplicados». Sin cambios de lógica.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  HeartHandshake,
  Hourglass,
  Info,
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
import FamiliaWinstonSeguimiento, { type CicloFiltro, type VistaSeguimiento } from './FamiliaWinstonSeguimiento'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import type {
  AlumnoQrFamiliaWinston,
  ComprobanteQrFamiliaWinston,
  RecomendadoQrFamiliaWinston,
  RevisionFamiliaWinston,
  SeguimientoFamiliaWinston,
} from '@/lib/familiaWinstonService'
import type { DatosPdfFamiliaWinston } from '@/lib/familiaWinstonPdf'
import './familia-winston.css'

/* 2026-10-06 — Pestañas del módulo. */
type Pestana = 'validar' | VistaSeguimiento

/* 2026-10-06 — Estado visible de un paso del validador (solo presentación). */
type EstadoPaso = 'pendiente' | 'actual' | 'hecho' | 'error'
const TEXTO_PASO: Record<EstadoPaso, string> = {
  pendiente: 'Pendiente',
  actual: 'Siguiente',
  hecho: 'Completo',
  error: 'Revisar',
}

/** 2026-10-06 — Ícono del paso: número, palomita (completo) o equis (con error). */
function IconoPaso({ estado, n, chico = false }: { estado: EstadoPaso; n: number; chico?: boolean }) {
  const t = chico ? 13 : 16
  if (estado === 'hecho') return <Check size={t} strokeWidth={3} />
  if (estado === 'error') return <X size={t} strokeWidth={3} />
  return <>{n > 0 ? n : <span className="fw-punto" />}</>
}

type CicloInicio = { valor: number; nombre: string; inicioClases: string | null; esActual: boolean }

type ResultadoAplicado = {
  folio: string
  mes: { mes: string; cicloEtiqueta: string }
  pagoReferencia: string
  correo: { enviado: boolean; destinatarios: string[]; detalle: string }
}

type ComprobanteQr = ComprobanteQrFamiliaWinston

/* 2026-10-06 — Por qué «¿A quién recomendó?» se llenó solo. */
const TEXTO_FUENTE: Record<'guardado' | 'cita' | 'nombre' | 'pdf', string> = {
  guardado: 'ya estaba registrado en este comprobante.',
  cita: 'es el interesado de la cita de AgendaW con la que se generó el comprobante.',
  nombre: 'su nombre es el del interesado que trae el comprobante.',
  // 2026-10-06: comprobante viejo resuelto con el PDF subido
  pdf: 'su nombre es el del interesado que viene en el PDF que subiste.',
}

function nombreAlumnoQr(a: AlumnoQrFamiliaWinston): string {
  return [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' ')
}

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

function FamiliaWinstonContenido() {
  const [formKey, setFormKey] = useState(0)
  const [qr, setQr] = useState('')
  const [beneficiado, setBeneficiado] = useState<AlumnoBusquedaResultado | null>(null)
  const [referido, setReferido] = useState<AlumnoBusquedaResultado | null>(null)

  const [buscandoQr, setBuscandoQr] = useState(false)
  const [qrBuscado, setQrBuscado] = useState('')
  const [comprobantesQr, setComprobantesQr] = useState<ComprobanteQr[]>([])
  const [recomendadoQr, setRecomendadoQr] = useState<RecomendadoQrFamiliaWinston | null>(null)
  /** 2026-10-06 — Comprobante viejo: nombre del interesado escrito del PDF (el servidor lo cruza). */
  const [interesadoPdf, setInteresadoPdf] = useState('')
  /** 2026-10-06 — Comprobante subido en PDF: datos leídos por el servidor (se reenvían al revisar). */
  const [pdfLeido, setPdfLeido] = useState<DatosPdfFamiliaWinston | null>(null)
  const [pdfArchivo, setPdfArchivo] = useState('')
  const [leyendoPdf, setLeyendoPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)

  const [revision, setRevision] = useState<RevisionFamiliaWinston | null>(null)
  const [correoPreview, setCorreoPreview] = useState<string | null>(null)
  const [claveRevisada, setClaveRevisada] = useState('')
  /** 2026-10-05 — Mes a condonar elegido ('' = próxima colegiatura pendiente). */
  const [mesElegido, setMesElegido] = useState('')
  const [revisando, setRevisando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aplicado, setAplicado] = useState<ResultadoAplicado | null>(null)

  /* 2026-10-06: la tabla «Beneficios aplicados» pasó a la pestaña «Aplicados» (seguimiento). */
  const [ciclos, setCiclos] = useState<CicloInicio[]>([])
  const [fechasInicio, setFechasInicio] = useState<Record<number, string>>({})
  const [guardandoInicio, setGuardandoInicio] = useState<number | null>(null)

  const [camara, setCamara] = useState(false)
  const [camaraError, setCamaraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  /* 2026-10-06 — Pestañas y seguimiento por ciclo (por defecto el «Ciclo activo» del panel). */
  const { cicloSeleccionado, opcionesSelector } = useCicloEscolar()
  const [pestana, setPestana] = useState<Pestana>('validar')
  const [seguimiento, setSeguimiento] = useState<SeguimientoFamiliaWinston | null>(null)
  const [cargandoSeg, setCargandoSeg] = useState(false)
  const [errorSeg, setErrorSeg] = useState<string | null>(null)
  const [cicloFiltro, setCicloFiltro] = useState<CicloFiltro>(cicloSeleccionado)
  /** Al abrir «Validar» desde la lista: control de quien recomienda para elegir su comprobante. */
  const ctrlPreferidoRef = useRef<number | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)

  const ctrl = beneficiado ? soloDigitos(String(beneficiado.alumno_ref)) : ''
  const referidoRef = referido ? soloDigitos(String(referido.alumno_ref)) : ''
  const pdfLimpio = interesadoPdf.trim().replace(/\s+/g, ' ')
  // 2026-10-06: el PDF subido también forma parte de lo revisado
  const pdfEnvio = useMemo(
    () =>
      pdfLeido
        ? {
            qr: pdfLeido.qr,
            ctrl: pdfLeido.ctrl,
            interesado: pdfLeido.interesado,
            folio: pdfLeido.folio,
            // 2026-10-06: el aviso de «PDF re-impreso» también sale en los requisitos
            integridad: { nivel: pdfLeido.integridad.nivel, texto: pdfLeido.integridad.texto },
          }
        : null,
    [pdfLeido]
  )
  const pdfClave = pdfEnvio
    ? `${pdfEnvio.qr}-${pdfEnvio.ctrl}-${pdfEnvio.interesado}-${pdfEnvio.integridad.nivel}`
    : ''
  const claveActual = `${qr}|${ctrl}|${referidoRef}|${pdfLimpio}|${mesElegido}|${pdfClave}`
  const completo = qr.length >= DIGITOS_QR && !!ctrl && !!referidoRef

  /* 2026-10-06: ya solo trae los ciclos (inicio de clases); el historial está en «Aplicados». */
  const cargarHistorial = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as {
        ciclos?: CicloInicio[]
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cargar el inicio de clases.')
        return
      }
      setCiclos(data.ciclos ?? [])
      setFechasInicio(
        Object.fromEntries((data.ciclos ?? []).map((c) => [c.valor, c.inicioClases ?? '']))
      )
    } catch {
      setError('Error de conexión al cargar el inicio de clases.')
    }
  }, [])

  useEffect(() => {
    void cargarHistorial()
  }, [cargarHistorial])

  /* 2026-10-06 — Seguimiento (pendientes y aplicados de todos los ciclos; se filtra en pantalla). */
  const cargarSeguimiento = useCallback(async () => {
    setCargandoSeg(true)
    setErrorSeg(null)
    try {
      const res = await fetch(`${API}?vista=seguimiento`, { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as SeguimientoFamiliaWinston & { error?: string }
      if (!res.ok) {
        setErrorSeg(data.error ?? 'No se pudo cargar el seguimiento.')
        return
      }
      setSeguimiento({ filas: data.filas ?? [], ciclos: data.ciclos ?? [], generadoEn: data.generadoEn })
    } catch {
      setErrorSeg('Error de conexión al cargar el seguimiento.')
    } finally {
      setCargandoSeg(false)
    }
  }, [])

  useEffect(() => {
    void cargarSeguimiento()
  }, [cargarSeguimiento])

  /* El filtro sigue al «Ciclo activo» del panel cuando este cambia. */
  useEffect(() => {
    setCicloFiltro(cicloSeleccionado)
  }, [cicloSeleccionado])

  const opcionesCiclo = useMemo(() => {
    const m = new Map<number, string>()
    for (const o of opcionesSelector) m.set(o.valor, o.etiqueta)
    for (const f of seguimiento?.filas ?? []) {
      if (f.ciclo == null || m.has(f.ciclo)) continue
      m.set(f.ciclo, seguimiento?.ciclos.find((c) => c.valor === f.ciclo)?.nombre ?? `${f.ciclo + 2003}-${f.ciclo + 2004}`)
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([valor, etiqueta]) => ({ valor, etiqueta }))
  }, [opcionesSelector, seguimiento])

  const conteoPestanas = useMemo(() => {
    const filas = (seguimiento?.filas ?? []).filter((f) => cicloFiltro === 'todos' || f.ciclo === cicloFiltro)
    return {
      pendientes: filas.filter((f) => f.status !== 'autorizado').length,
      aplicados: filas.filter((f) => f.status === 'autorizado').length,
    }
  }, [seguimiento, cicloFiltro])

  const cambiarPestana = useCallback((p: Pestana) => {
    setPestana(p)
    if (p !== 'validar') setCamara(false)
  }, [])

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

  /* 2026-10-06 — Elegir comprobante llena los dos alumnos: quién recomendó y a quién recomendó. */
  const elegirComprobante = useCallback((item: ComprobanteQr) => {
    if (item.alumno) setBeneficiado(alumnoParaBuscador(item.alumno))
    setRecomendadoQr(item.recomendado)
    setInteresadoPdf('')
    setReferido(item.recomendado.alumno ? alumnoParaBuscador(item.recomendado.alumno) : null)
  }, [])

  /* 2026-10-06 — Subir comprobante (PDF): el servidor lee QR, control e interesado, valida que
     sean del mismo comprobante y devuelve todo para llenar los 3 pasos sin capturar nada. */
  const subirPdf = useCallback(
    async (archivo: File) => {
      setPdfError(null)
      setError(null)
      setLeyendoPdf(true)
      setCamara(false)
      try {
        const form = new FormData()
        form.append('pdf', archivo)
        const res = await fetch(API, { method: 'POST', body: form })
        const data = (await res.json().catch(() => ({}))) as {
          pdf?: DatosPdfFamiliaWinston
          comprobante?: ComprobanteQr
          error?: string
        }
        if (!res.ok || !data.pdf || !data.comprobante || data.pdf.qr == null) {
          // PDF que no cuadra: no se deja nada de un comprobante anterior en pantalla.
          setPdfLeido(null)
          setPdfArchivo('')
          setQr('')
          setQrBuscado('')
          setComprobantesQr([])
          setRecomendadoQr(null)
          setInteresadoPdf('')
          setBeneficiado(null)
          setReferido(null)
          setRevision(null)
          setClaveRevisada('')
          setFormKey((k) => k + 1)
          setPdfError(data.error ?? 'No se pudo leer el PDF.')
          return
        }
        const codigo = String(data.pdf.qr)
        setQr(codigo)
        setQrBuscado(codigo)
        setComprobantesQr([data.comprobante])
        setRevision(null)
        setClaveRevisada('')
        elegirComprobante(data.comprobante)
        setInteresadoPdf(data.pdf.interesado ?? '')
        setPdfLeido(data.pdf)
        setPdfArchivo(archivo.name)
        setFormKey((k) => k + 1)
      } catch {
        setPdfError('Error de conexión al subir el PDF.')
      } finally {
        setLeyendoPdf(false)
        if (pdfInputRef.current) pdfInputRef.current.value = ''
      }
    },
    [elegirComprobante]
  )

  const quitarPdf = () => {
    setPdfLeido(null)
    setPdfArchivo('')
    setPdfError(null)
  }

  /* Al tener el código completo: buscar el comprobante y llenar los dos alumnos. */
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
        setRecomendadoQr(null)
        // 2026-10-06: desde «Pendientes» se elige el comprobante de ese recomendador
        const preferido = ctrlPreferidoRef.current
        ctrlPreferidoRef.current = null
        const elegido =
          (preferido != null ? lista.find((i) => i.comprobante.ctrl === preferido) : undefined) ??
          (lista.length === 1 ? lista[0] : undefined)
        if (elegido) elegirComprobante(elegido)
      } catch {
        setError('Error de conexión al buscar el comprobante.')
      } finally {
        setBuscandoQr(false)
      }
    }, 250)
    return () => window.clearTimeout(id)
  }, [qr, qrBuscado, elegirComprobante])

  const revisar = useCallback(async () => {
    setError(null)
    setRevisando(true)
    const base = `${qr}|${ctrl}|${referidoRef}`
    if (!claveRevisada.startsWith(`${base}|`)) setRevision(null)
    setClaveRevisada(`${base}|${pdfLimpio}|${mesElegido}|${pdfClave}`)
    try {
      const { ok, data } = await postApi<{
        revision?: RevisionFamiliaWinston
        correoPreview?: string | null
        error?: string
      }>({
        accion: 'revisar',
        qr,
        ctrl,
        referidoRef,
        conceptoNo: mesElegido,
        interesadoPdf: pdfLimpio,
        pdf: pdfEnvio,
      })
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
  }, [qr, ctrl, referidoRef, mesElegido, pdfLimpio, claveRevisada, pdfClave, pdfEnvio])

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
    setRecomendadoQr(null)
    setInteresadoPdf('')
    quitarPdf()
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

  /* 2026-10-06 — «Validar» desde la lista: abre el validador con ese QR y su recomendador. */
  const validarDesdeSeguimiento = (qrComprobante: number, ctrlComprobante: number) => {
    limpiar()
    ctrlPreferidoRef.current = ctrlComprobante
    setQr(String(qrComprobante))
    setPestana('validar')
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      >({
        accion: 'aplicar',
        qr,
        ctrl,
        referidoRef,
        conceptoNo: revision.mesPropuesto.conceptoNo,
        interesadoPdf: pdfLimpio,
        pdf: pdfEnvio,
      })
      if (!okRes) {
        setError(data.error ?? 'No se pudo aplicar el beneficio.')
        if (data.revision) setRevision(data.revision)
        return
      }
      setAplicado(data)
      void cargarSeguimiento()
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

  /* 2026-10-06 — Estado visible de cada paso del validador (pendiente, siguiente, completo o con error).
     Solo lee lo que ya existe en pantalla; no cambia ninguna regla ni llamada a la API. */
  const idsError = new Set(revisionVigente ? errores.map((e) => e.id) : [])
  const hayRevision = !!revision && revisionVigente
  const estadoComprobante: EstadoPaso =
    pdfError || qrSinComprobante ? 'error' : qr.length >= DIGITOS_QR ? 'hecho' : 'pendiente'
  const estadoRecomendo: EstadoPaso = idsError.has('beneficiado') ? 'error' : beneficiado ? 'hecho' : 'pendiente'
  const estadoRecomendado: EstadoPaso = ['referido', 'interesado', 'interesado-pdf', 'referido-unico', 'nuevo-ingreso'].some(
    (id) => idsError.has(id)
  )
    ? 'error'
    : referido
      ? 'hecho'
      : 'pendiente'
  const estadoValidacion: EstadoPaso = aplicado
    ? 'hecho'
    : hayRevision
      ? revision?.puedeAplicar
        ? 'hecho'
        : 'error'
      : revisando
        ? 'actual'
        : 'pendiente'
  const textoValidacion = aplicado
    ? 'Aplicado'
    : hayRevision
      ? revision?.puedeAplicar
        ? 'Procede'
        : 'No procede'
      : revisando
        ? 'Revisando…'
        : completo
          ? 'Por revisar'
          : 'Pendiente'
  // El primer paso sin resolver es el «siguiente» (guía visual de dónde seguir).
  const pasosBase: { id: string; titulo: string; estado: EstadoPaso; texto?: string }[] = [
    { id: 'comprobante', titulo: 'Comprobante', estado: estadoComprobante },
    { id: 'recomendo', titulo: 'Quién recomendó', estado: estadoRecomendo },
    { id: 'recomendado', titulo: 'A quién recomendó', estado: estadoRecomendado },
    { id: 'validacion', titulo: 'Validación', estado: estadoValidacion, texto: textoValidacion },
  ]
  const idxSiguiente = pasosBase.findIndex((p) => p.estado === 'pendiente')
  const pasos = pasosBase.map((p, i) => ({
    ...p,
    estado: i === idxSiguiente ? ('actual' as EstadoPaso) : p.estado,
  }))
  const [pComprobante, pRecomendo, pRecomendado] = pasos

  const resultadoRef = useRef<HTMLElement | null>(null)

  /* 2026-10-06 — En pantallas de una sola columna el resultado queda debajo del formulario:
     al revisar o aplicar se baja hasta él (sin animación si el usuario prefiere menos movimiento). */
  useEffect(() => {
    if (!hayRevision && !aplicado) return
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1100px)').matches) return
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    resultadoRef.current?.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' })
  }, [hayRevision, aplicado])

  /* 2026-10-06 — Pestañas con teclado: flechas, Inicio y Fin cambian de pestaña (patrón WAI-ARIA). */
  const teclaPestana = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const ids: Pestana[] = ['validar', 'pendientes', 'aplicados']
    const destino =
      e.key === 'ArrowRight' ? (i + 1) % ids.length : e.key === 'ArrowLeft' ? (i + ids.length - 1) % ids.length : e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : -1
    if (destino < 0) return
    e.preventDefault()
    cambiarPestana(ids[destino])
    document.getElementById(`fw-tab-${ids[destino]}`)?.focus()
  }

  const listaPestanas = [
    { id: 'validar', texto: 'Validar', ayuda: 'Revisar un comprobante', icono: <QrCode size={18} aria-hidden />, n: null as number | null },
    {
      id: 'pendientes',
      texto: 'Pendientes',
      ayuda: 'Faltan por aplicar',
      icono: <Hourglass size={18} aria-hidden />,
      n: seguimiento ? conteoPestanas.pendientes : null,
    },
    {
      id: 'aplicados',
      texto: 'Aplicados',
      ayuda: 'Ya entregados',
      icono: <CheckCircle2 size={18} aria-hidden />,
      n: seguimiento ? conteoPestanas.aplicados : null,
    },
  ] as const

  const avisosRevision = revision?.checks.filter((c) => c.nivel === 'aviso') ?? []
  const nombreBeneficiado = revision?.beneficiado?.nombre ?? 'Quien recomendó'

  return (
    <div className="servicios-panel-inner fw">
      {/* 2026-10-06 — Encabezado: qué es el programa en una frase y, desplegable, cuándo procede. */}
      <header className="fw-hero">
        <span className="fw-hero-icono" aria-hidden>
          <HeartHandshake size={26} />
        </span>
        <div className="fw-hero-texto">
          <h1 className="fw-hero-titulo">Familia Winston</h1>
          <p className="fw-hero-intro">
            Cuando una familia recomienda a otra y el alumno nuevo ya cumplió su primer mes, el alumno que
            recomendó recibe gratis su próxima colegiatura.
          </p>
          <details className="fw-reglas">
            <summary>
              <Info size={15} aria-hidden /> ¿Cuándo procede el beneficio?
              <ChevronDown size={15} className="fw-plegable-flecha" aria-hidden />
            </summary>
            <ul className="fw-reglas-lista">
              <li>El comprobante es auténtico y nunca se ha usado.</li>
              <li>Quien recomendó sigue activo y tiene una colegiatura pendiente que condonar.</li>
              <li>El alumno recomendado es el interesado del comprobante, es de nuevo ingreso y está activo.</li>
              <li>Ya pagó su primera colegiatura del ciclo.</li>
              <li>
                Lleva al menos 30 días de clases (desde el inicio de clases del ciclo o su alta, lo que ocurra
                después).
              </li>
              <li>Un alumno recomendado solo genera un beneficio.</li>
            </ul>
            <p className="fw-reglas-cierre">
              Al aplicarlo, la colegiatura queda en $0 (Beca 100%) y se avisa por correo a mamá y papá.
            </p>
          </details>
        </div>
      </header>

      {/* 2026-10-06 — Pestañas con descripción y contador: validar, comprobantes que faltan y beneficios aplicados. */}
      <div ref={tabsRef} className="fw-tabs" role="tablist" aria-label="Secciones de Familia Winston">
        {listaPestanas.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`fw-tab-${t.id}`}
            aria-selected={pestana === t.id}
            aria-controls={`fw-panel-${t.id === 'validar' ? 'validar' : 'seguimiento'}`}
            tabIndex={pestana === t.id ? 0 : -1}
            className={`fw-tab ${pestana === t.id ? 'fw-tab--activa' : ''}`}
            onClick={() => cambiarPestana(t.id)}
            onKeyDown={(e) => teclaPestana(e, i)}
          >
            <span className="fw-tab-icono">{t.icono}</span>
            <span className="fw-tab-texto">
              <span className="fw-tab-nombre">{t.texto}</span>
              <span className="fw-tab-ayuda">{t.ayuda}</span>
            </span>
            {t.n != null ? (
              <span className="fw-tab-n" aria-label={`${t.n} ${t.n === 1 ? 'comprobante' : 'comprobantes'}`}>
                {t.n}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        id="fw-panel-validar"
        role="tabpanel"
        aria-labelledby="fw-tab-validar"
        className="fw-panel"
        hidden={pestana !== 'validar'}
      >
        {/* 2026-10-06 — Avance de la validación: los mismos 4 pasos que el formulario, con su estado. */}
        <ol className="fw-stepper" aria-label="Avance de la validación">
          {pasos.map((p, i) => (
            <li
              key={p.id}
              className={`fw-stepper-item fw-stepper-item--${p.estado}`}
              aria-current={p.estado === 'actual' ? 'step' : undefined}
            >
              <span className="fw-stepper-num" aria-hidden>
                <IconoPaso estado={p.estado} n={i + 1} />
              </span>
              <span className="fw-stepper-texto">
                <span className="fw-stepper-nombre">{p.titulo}</span>
                <span className="fw-stepper-estado">{p.texto ?? TEXTO_PASO[p.estado]}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="fw-layout">
          {/* ── Captura ─────────────────────────────────────────── */}
          <section
            className={`servicios-panel-card fw-card fw-captura ${aplicado ? 'fw-captura--cerrada' : ''}`}
            aria-labelledby="fw-validar"
          >
            <div className="fw-card-cabeza">
              <div className="fw-card-enc">
                <h2 id="fw-validar" className="fw-h2">
                  Datos del comprobante
                </h2>
                <p className="fw-card-sub">
                  {aplicado
                    ? 'Este comprobante ya se aplicó. Empieza de nuevo para validar otro.'
                    : 'Completa los 3 pasos; los requisitos se revisan solos al terminar.'}
                </p>
              </div>
              {qr || beneficiado || referido ? (
                <button type="button" className="fw-btn-link" onClick={limpiar}>
                  <RotateCcw size={14} aria-hidden /> Empezar de nuevo
                </button>
              ) : null}
            </div>

            {/* inert: ya aplicado, el formulario queda de solo lectura para no cambiar datos de algo cerrado */}
            <div className="fw-pasos" inert={!!aplicado}>
              {/* Paso 1 — comprobante (PDF, cámara o número del QR) */}
              <div className={`fw-paso fw-paso--${pComprobante.estado}`}>
                <div className="fw-paso-num" aria-hidden>
                  <IconoPaso estado={pComprobante.estado} n={1} />
                </div>
                <div className="fw-paso-cuerpo">
                  <div className="fw-paso-cab">
                    <p className="fw-paso-nombre">Comprobante de la familia</p>
                    <span className="fw-paso-estado">{TEXTO_PASO[pComprobante.estado]}</span>
                  </div>
                  {/* 2026-10-06: o sube el PDF */}
                  <p className="fw-paso-ayuda">
                    La familia lo trae en PDF o con un código QR. Con el PDF se llena todo solo.
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
                    <div className="fw-metodos">
                      {/* 2026-10-06 — Subir comprobante (PDF): lo lee el servidor. */}
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        className="fw-pdf-input"
                        aria-label="Comprobante en PDF"
                        onChange={(e) => {
                          const archivo = e.target.files?.[0]
                          if (archivo) void subirPdf(archivo)
                        }}
                      />
                      <button
                        type="button"
                        className="usr-btn usr-btn--primary fw-btn-camara fw-btn-pdf"
                        disabled={leyendoPdf}
                        onClick={() => pdfInputRef.current?.click()}
                      >
                        {leyendoPdf ? <Loader2 className="usr-spin" size={18} /> : <FileUp size={18} />}
                        {leyendoPdf ? 'Leyendo PDF…' : pdfLeido ? 'Cambiar PDF' : 'Subir comprobante (PDF)'}
                      </button>
                      <p className="fw-metodos-o">
                        <span>o usa el código QR</span>
                      </p>
                      <div className="fw-qr-captura">
                        <button
                          type="button"
                          className="usr-btn fw-btn-camara"
                          onClick={() => {
                            setCamaraError(null)
                            setCamara(true)
                          }}
                        >
                          <Camera size={18} /> Escanear con cámara
                        </button>
                        <label className="fw-qr-campo" htmlFor="fw-qr-numero">
                          <span>Número debajo del QR</span>
                          <input
                            id="fw-qr-numero"
                            className="fw-input fw-input-qr"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="000000"
                            value={qr}
                            onChange={(e) => setQr(soloDigitos(e.target.value).slice(0, 9))}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {camaraError ? <p className="fw-aviso fw-aviso--warn">{camaraError}</p> : null}
                  {/* 2026-10-06 — Lo que se leyó del PDF (o por qué no procede). */}
                  {pdfError ? (
                    <p className="fw-aviso fw-aviso--err" role="alert">
                      {pdfError}
                    </p>
                  ) : null}
                  {pdfLeido ? (
                    <div className="fw-pdf-leido">
                      <p className="fw-pdf-leido-cab">
                        <FileUp size={15} aria-hidden />
                        <span className="fw-pdf-leido-nombre">
                          Leído del PDF{pdfArchivo ? ` «${pdfArchivo}»` : ''}
                        </span>
                        <button type="button" className="fw-btn-link" onClick={quitarPdf}>
                          <X size={13} aria-hidden /> Quitar PDF
                        </button>
                      </p>
                      <dl className="fw-pdf-datos">
                        <div>
                          <dt>QR</dt>
                          <dd>
                            {pdfLeido.qr ?? '—'}
                            <small>{pdfLeido.qrFuente === 'imagen' ? ' (imagen)' : ' (número impreso)'}</small>
                          </dd>
                        </div>
                        <div>
                          <dt>Recomienda</dt>
                          <dd>No. control {pdfLeido.ctrl ?? '—'}</dd>
                        </div>
                        <div>
                          <dt>Interesado</dt>
                          <dd>
                            {pdfLeido.interesado ?? '—'}
                            {pdfLeido.nivel ? <small> · {pdfLeido.nivel}</small> : null}
                          </dd>
                        </div>
                        {pdfLeido.folio ? (
                          <div>
                            <dt>Folio</dt>
                            <dd>{pdfLeido.folio}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {/* 2026-10-06 — PDF re-impreso o de generador desconocido: aviso, no bloquea. */}
                      {pdfLeido.integridad.nivel === 'aviso' && pdfLeido.integridad.texto ? (
                        <p className="fw-aviso fw-aviso--warn">{pdfLeido.integridad.texto}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {buscandoQr ? (
                    <p className="fw-nota" role="status">
                      <Loader2 className="usr-spin" size={14} aria-hidden /> Buscando comprobante…
                    </p>
                  ) : null}
                  {qrSinComprobante ? (
                    <p className="fw-aviso fw-aviso--err" role="alert">
                      No hay ningún comprobante de AgendaW con el código {qr}. Revisa el número o sube el PDF.
                    </p>
                  ) : null}
                  {qrBuscado === qr && comprobantesQr.length > 0 ? (
                    <div className="fw-comprobantes">
                      {comprobantesQr.length > 1 ? (
                        <p className="fw-nota">Este código tiene varios comprobantes; elige el correcto:</p>
                      ) : null}
                      {comprobantesQr.map((item) => {
                        const { comprobante: c, alumno } = item
                        const usado = c.status === 'autorizado'
                        const elegido = alumno && ctrl === soloDigitos(String(alumno.alumno_ref))
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className={`fw-comprobante ${elegido ? 'fw-comprobante--activo' : ''}`}
                            aria-pressed={!!elegido}
                            onClick={() => elegirComprobante(item)}
                            disabled={!alumno}
                          >
                            <span className="fw-comprobante-folio">{c.folio}</span>
                            <span className={`fw-chip fw-chip--punto ${usado ? 'fw-chip--err' : 'fw-chip--ok'}`}>
                              {usado ? 'Ya usado' : 'Sin usar'}
                            </span>
                            <span className="fw-comprobante-alumno">
                              {alumno
                                ? `${[alumno.alumno_nombre, alumno.alumno_app, alumno.alumno_apm]
                                    .filter(Boolean)
                                    .join(' ')} · No. control ${alumno.alumno_ref}`
                                : `No. control ${c.ctrl} (no encontrado)`}
                            </span>
                            {item.recomendado.interesadoNombre ? (
                              <span className="fw-comprobante-alumno">
                                Interesado: {item.recomendado.interesadoNombre}
                                {c.interesadoNivelGrado ? ` · ${c.interesadoNivelGrado}` : ''}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Paso 2 — quién recomendó */}
              <div className={`fw-paso fw-paso--${pRecomendo.estado}`}>
                <div className="fw-paso-num" aria-hidden>
                  <IconoPaso estado={pRecomendo.estado} n={2} />
                </div>
                <div className="fw-paso-cuerpo">
                  <div className="fw-paso-cab">
                    <p className="fw-paso-nombre">
                      <UserCheck size={16} aria-hidden /> ¿Quién recomendó?
                    </p>
                    <span className="fw-paso-estado">{TEXTO_PASO[pRecomendo.estado]}</span>
                  </div>
                  <p className="fw-paso-ayuda">
                    El alumno de la familia que recomendó: él recibe el beneficio. Se llena solo al leer el
                    comprobante.
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
              <div className={`fw-paso fw-paso--${pRecomendado.estado}`}>
                <div className="fw-paso-num" aria-hidden>
                  <IconoPaso estado={pRecomendado.estado} n={3} />
                </div>
                <div className="fw-paso-cuerpo">
                  <div className="fw-paso-cab">
                    <p className="fw-paso-nombre">
                      <UserPlus size={16} aria-hidden /> ¿A quién recomendó?
                    </p>
                    <span className="fw-paso-estado">{TEXTO_PASO[pRecomendado.estado]}</span>
                  </div>
                  {/* 2026-10-06: el número del comprobante es el de quien recomienda → se ponía aquí por error */}
                  <p className="fw-paso-ayuda">
                    El alumno nuevo que se inscribió gracias a la recomendación; él debe cumplir su primer mes. Se
                    llena solo si el comprobante trae al interesado.
                  </p>
                  <p className="fw-paso-ayuda fw-paso-ayuda--nota">
                    <Info size={14} aria-hidden /> El número de control del comprobante es el de quien recomendó, no el del
                    alumno nuevo.
                  </p>
                  {/* 2026-10-06 — Explica de dónde salió el alumno o muestra sugerencias para elegir. */}
                  {recomendadoQr?.alumno &&
                  recomendadoQr.fuente &&
                  recomendadoQr.fuente !== 'apellido' &&
                  referidoRef === soloDigitos(recomendadoQr.alumno.alumno_ref) ? (
                    <p className="fw-aviso fw-aviso--ok">
                      Se llenó solo: {nombreAlumnoQr(recomendadoQr.alumno)} {TEXTO_FUENTE[recomendadoQr.fuente]}
                    </p>
                  ) : null}
                  {!referido && recomendadoQr && !recomendadoQr.alumno ? (
                    recomendadoQr.candidatos.length > 0 ? (
                      <div className="fw-sugerencias">
                        <p className="fw-nota">
                          {recomendadoQr.fuente === 'apellido'
                            ? 'Este comprobante es anterior y no trae el nombre del interesado. Alumnos de nuevo ingreso que comparten apellido con quien recomendó; elige el que aparece en el PDF:'
                            : recomendadoQr.fuente === 'pdf'
                              ? `Varios alumnos coinciden con el interesado del PDF (${pdfLeido?.interesado ?? interesadoPdf}); elige uno:`
                              : `Hay varios alumnos llamados ${recomendadoQr.interesadoNombre ?? 'como el interesado'}; elige uno:`}
                        </p>
                        <div className="fw-comprobantes">
                          {recomendadoQr.candidatos.map((a) => (
                            <button
                              key={a.alumno_ref}
                              type="button"
                              className="fw-comprobante"
                              onClick={() => setReferido(alumnoParaBuscador(a))}
                            >
                              <span className="fw-comprobante-alumno fw-comprobante-alumno--fuerte">
                                {nombreAlumnoQr(a)} · No. control {a.alumno_ref}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : recomendadoQr.interesadoNombre ? (
                      <p className="fw-aviso fw-aviso--warn">
                        Interesado del comprobante: {recomendadoQr.interesadoNombre}. Todavía no aparece como alumno
                        inscrito; búscalo por su nombre.
                      </p>
                    ) : recomendadoQr.fuente === 'pdf' ? (
                      <p className="fw-aviso fw-aviso--warn">
                        Interesado del PDF: {pdfLeido?.interesado ?? interesadoPdf}. No aparece como alumno
                        inscrito con ese nombre; búscalo por su nombre o número de control.
                      </p>
                    ) : (
                      <p className="fw-aviso fw-aviso--warn">
                        Este comprobante es anterior y no trae el nombre del interesado: búscalo por el nombre
                        que viene en el PDF.
                      </p>
                    )
                  ) : null}
                  <AlumnoAutocomplete
                    key={`ref-${formKey}`}
                    etiqueta="Nombre o número de control"
                    alumnoSeleccionado={referido}
                    onSeleccionar={setReferido}
                    autoFocus={false}
                    excluirRefs={ctrl ? [ctrl] : undefined}
                    mensajeExcluido={`${beneficiado?.nombre_completo ?? 'Ese alumno'} es quien recomendó; no se puede recomendar a sí mismo. Busca al alumno nuevo por su nombre.`}
                  />
                  {/* 2026-10-06 — Comprobante viejo: se escribe el interesado del PDF y el servidor
                      lo cruza con el alumno elegido (si no coincide, no procede). */}
                  {(recomendadoQr && !recomendadoQr.interesadoNombre) || revision?.requiereNombrePdf ? (
                    <label className="fw-campo fw-campo-pdf">
                      <strong>Nombre del interesado según el PDF</strong>
                      <input
                        type="text"
                        className="fw-input"
                        autoComplete="off"
                        placeholder="Ej. Luca Mazatini Bustamante"
                        value={interesadoPdf}
                        onChange={(e) => setInteresadoPdf(e.target.value)}
                      />
                      <span className="fw-sub">
                        {pdfLeido?.interesado
                          ? 'Se llenó con el nombre que viene en el PDF subido. Si no coincide con el alumno elegido, no procede.'
                          : 'Cópialo del comprobante («Este documento certifica que el interesado…») o sube el PDF. Si no coincide con el alumno elegido, no procede.'}
                      </span>
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* ── Resultado ───────────────────────────────────────── */}
          <section
            ref={resultadoRef}
            className="servicios-panel-card fw-card fw-resultado"
            aria-labelledby="fw-res"
            aria-live="polite"
          >
            <div className="fw-card-enc">
              <h2 id="fw-res" className="fw-h2">
                Resultado
              </h2>
              <p className="fw-card-sub">
                {aplicado
                  ? 'Qué se hizo con este comprobante y cuál es el siguiente paso.'
                  : 'Aquí ves si procede el beneficio y qué se va a aplicar.'}
              </p>
            </div>

            {error ? (
              <p className="fw-aviso fw-aviso--err" role="alert">
                {error}
              </p>
            ) : null}

            {aplicado ? (
              /* 2026-10-06 — Cierre: qué se hizo y cuál es el siguiente paso. */
              <div className="fw-exito">
                <span className="fw-exito-icono" aria-hidden>
                  <CheckCircle2 size={34} />
                </span>
                <div>
                  <p className="fw-exito-encab">Beneficio aplicado</p>
                  <p className="fw-exito-sub">
                    Se condonó la colegiatura de {aplicado.mes.mes} {aplicado.mes.cicloEtiqueta} a {nombreBeneficiado}.
                  </p>
                </div>
                <ol className="fw-hecho-lista">
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span>
                      Comprobante <strong>{aplicado.folio}</strong> marcado como usado.
                    </span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span>
                      Pago en $0 registrado. Referencia <strong>{aplicado.pagoReferencia}</strong>.
                    </span>
                  </li>
                  <li className={aplicado.correo.enviado ? '' : 'fw-hecho--aviso'}>
                    {aplicado.correo.enviado ? (
                      <CheckCircle2 size={16} aria-hidden />
                    ) : (
                      <AlertTriangle size={16} aria-hidden />
                    )}
                    <span>
                      {aplicado.correo.enviado
                        ? `Correo enviado a ${aplicado.correo.destinatarios.join(', ')}.`
                        : `El correo no se envió (${aplicado.correo.detalle}). Avisa a la familia por otro medio.`}
                    </span>
                  </li>
                </ol>
                <div className="fw-acciones fw-acciones--cierre">
                  <button type="button" className="usr-btn usr-btn--primary" onClick={limpiar}>
                    <QrCode size={16} aria-hidden /> Validar otro comprobante
                  </button>
                  <button
                    type="button"
                    className="usr-btn"
                    onClick={() => {
                      limpiar()
                      cambiarPestana('aplicados')
                    }}
                  >
                    <CheckCircle2 size={16} aria-hidden /> Ver aplicados
                  </button>
                </div>
              </div>
            ) : revisando && !revision ? (
              <div className="fw-vacio" role="status">
                <Loader2 className="usr-spin" size={28} aria-hidden />
                <p className="fw-vacio-encab">Revisando requisitos…</p>
                <p>Se comprueba el comprobante, los pagos y los días de clases del alumno recomendado.</p>
              </div>
            ) : revision && revisionVigente ? (
              <>
                <div
                  className={`fw-veredicto ${
                    revision.puedeAplicar ? 'fw-veredicto--ok' : 'fw-veredicto--err'
                  }`}
                >
                  {revision.puedeAplicar ? (
                    <CheckCircle2 size={34} aria-hidden />
                  ) : (
                    <XCircle size={34} aria-hidden />
                  )}
                  <div className="fw-veredicto-cuerpo">
                    <p className="fw-veredicto-etiqueta">{revision.puedeAplicar ? 'Procede' : 'No procede'}</p>
                    <p className="fw-veredicto-encab">
                      {revision.puedeAplicar
                        ? `${nombreBeneficiado} recibe gratis su próxima colegiatura`
                        : soloFaltanDias
                          ? 'Todavía no cumple su primer mes de clases'
                          : 'El comprobante no cumple los requisitos'}
                    </p>
                    <p className="fw-veredicto-sub">
                      {revision.puedeAplicar
                        ? 'Revisa los datos, elige el mes si quieres otro y presiona «Validar y aplicar beneficio». Hasta entonces no se registra nada.'
                        : soloFaltanDias && revision.fechaDisponible
                          ? `Se podrá validar a partir del ${fechaCorta(revision.fechaDisponible)}.`
                          : 'Estos requisitos no se cumplen:'}
                    </p>
                    {!revision.puedeAplicar && !(soloFaltanDias && revision.fechaDisponible) ? (
                      <ul className="fw-motivos">
                        {errores.map((c) => (
                          <li key={c.id + c.texto}>{c.texto}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>

                {!revision.puedeAplicar ? (
                  <p className="fw-sigue">
                    <Info size={15} aria-hidden />
                    <span>
                      <strong>Qué sigue:</strong> no se aplicó nada y el comprobante sigue en Pendientes.{' '}
                      {soloFaltanDias
                        ? 'Vuelve a validarlo en la fecha indicada.'
                        : 'Corrige el dato que falta o empieza con otro comprobante.'}
                    </span>
                  </p>
                ) : null}

                {revision.puedeAplicar && avisosRevision.length > 0 ? (
                  <ul className="fw-avisos">
                    {avisosRevision.map((c) => (
                      <li key={c.id + c.texto} className="fw-aviso fw-aviso--warn">
                        <AlertTriangle size={15} aria-hidden /> {c.texto}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* 2026-10-06 — Alumno recomendado: cuándo pagó su inscripción y cuánto lleva estudiando */}
                {revision.referido && revision.infoReferido ? (
                  <div className="fw-bloque">
                    <h3 className="fw-h3">Alumno recomendado</h3>
                    <dl className="fw-ficha">
                      <div className="fw-ficha-fila">
                        <dt>
                          <UserPlus size={15} aria-hidden /> Alumno
                        </dt>
                        <dd>
                          <strong>{revision.referido.nombre}</strong>
                          <small className="fw-sub">No. control {revision.referido.alumno_ref}</small>
                        </dd>
                      </div>
                      <div className="fw-ficha-fila">
                        <dt>
                          <Receipt size={15} aria-hidden /> Pagó su inscripción
                        </dt>
                        <dd>
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
                        </dd>
                      </div>
                      <div className="fw-ficha-fila">
                        <dt>
                          <GraduationCap size={15} aria-hidden /> Lleva estudiando
                        </dt>
                        <dd>
                          <strong>
                            {revision.infoReferido.diasEstudiando != null
                              ? textoAntiguedad(revision.infoReferido.diasEstudiando)
                              : '—'}
                          </strong>
                          {revision.infoReferido.estudiaDesde ? (
                            <small className="fw-sub">
                              Desde el {fechaCorta(revision.infoReferido.estudiaDesde)} · se piden 30 días
                            </small>
                          ) : null}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}

                {revision.beneficiado &&
                revision.mesesDisponibles.length > 0 &&
                (revision.puedeAplicar || errores.every((e) => e.id === 'mes')) ? (
                  <div className="fw-bloque">
                    <h3 className="fw-h3">Qué se aplicará</h3>
                    <dl className="fw-ficha">
                      <div className="fw-ficha-fila">
                        <dt>
                          <UserCheck size={15} aria-hidden /> Recibe el beneficio
                        </dt>
                        <dd>
                          <strong>{revision.beneficiado.nombre}</strong>
                        </dd>
                      </div>
                      {/* 2026-10-05 — Elegir el mes a condonar entre las colegiaturas pendientes. */}
                      <div className="fw-ficha-fila fw-ficha-fila--acento">
                        <dt>
                          <CalendarDays size={15} aria-hidden /> Colegiatura que se condona
                          {cambiandoMes ? <Loader2 className="usr-spin" size={13} aria-hidden /> : null}
                        </dt>
                        <dd>
                          <strong>
                            {revision.mesPropuesto
                              ? `${revision.mesPropuesto.mes} ${revision.mesPropuesto.cicloEtiqueta}`
                              : 'Elige un mes'}
                          </strong>
                          {revision.mesesDisponibles.length > 1 ? (
                            <>
                              <small className="fw-sub">Por defecto es la próxima; elige otro mes si hace falta.</small>
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
                            </>
                          ) : null}
                        </dd>
                      </div>
                      <div className="fw-ficha-fila">
                        <dt>
                          <Mail size={15} aria-hidden /> Se avisará por correo a
                        </dt>
                        <dd>
                          {revision.destinatarios.length > 0 ? (
                            <span className="fw-dato-correos">
                              {revision.destinatarios.map((d) => (
                                <span key={d.email}>
                                  {d.tutorId === 1 ? 'Mamá' : d.tutorId === 2 ? 'Papá' : 'Familiar'}: {d.email}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <strong>Sin correo autorizado</strong>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}

                <details className="fw-plegable">
                  <summary>
                    <ClipboardCheck size={16} aria-hidden /> Requisitos revisados (
                    {revision.checks.filter((c) => c.nivel === 'ok').length}/{revision.checks.length} cumplidos)
                    <ChevronDown size={16} className="fw-plegable-flecha" aria-hidden />
                  </summary>
                  <ul className="fw-checks">
                    {revision.checks.map((c) => (
                      <li key={c.id + c.texto} className={`fw-check fw-check--${c.nivel}`}>
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
                  ) : (
                    <button type="button" className="usr-btn" onClick={() => cambiarPestana('pendientes')}>
                      <Hourglass size={16} aria-hidden /> Ver pendientes
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* 2026-10-06 — Vacío con guía: qué falta para poder revisar y que nada se aplica solo. */
              <div className="fw-vacio fw-vacio--guia">
                <ClipboardCheck size={32} aria-hidden />
                <p className="fw-vacio-encab">Todavía no hay nada que revisar</p>
                <ul className="fw-faltan">
                  {[
                    { p: pComprobante, falta: 'Falta el comprobante (PDF o QR)', listo: 'Comprobante leído' },
                    { p: pRecomendo, falta: 'Falta elegir quién recomendó', listo: 'Quién recomendó elegido' },
                    { p: pRecomendado, falta: 'Falta elegir a quién recomendó', listo: 'Alumno recomendado elegido' },
                  ].map(({ p, falta, listo }) => (
                    <li key={p.id} className={`fw-faltan-item fw-faltan-item--${p.estado}`}>
                      <span className="fw-faltan-punto" aria-hidden>
                        <IconoPaso estado={p.estado} n={0} chico />
                      </span>
                      {p.estado === 'hecho' ? listo : p.estado === 'error' ? 'Revisa este paso' : falta}
                    </li>
                  ))}
                </ul>
                <p className="fw-vacio-nota">
                  Al completarlos se revisan los requisitos solos. No se aplica nada hasta que presiones
                  «Validar y aplicar beneficio».
                </p>
                {error && completo && !revisando ? (
                  <button type="button" className="usr-btn" onClick={() => void revisar()}>
                    <RefreshCw size={16} aria-hidden /> Volver a revisar
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </div>

        {/* ── Configuración ─────────────────────────────────────── */}
        <details className="servicios-panel-card fw-card fw-plegable fw-config">
          <summary>
            <CalendarDays size={16} aria-hidden /> Inicio de clases por ciclo
            <span className="fw-config-ayuda">Define desde cuándo cuentan los 30 días</span>
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

      {/* 2026-10-06 — Seguimiento: comprobantes que faltan y beneficios aplicados por ciclo. */}
      {pestana !== 'validar' ? (
        <div
          id="fw-panel-seguimiento"
          role="tabpanel"
          aria-labelledby={`fw-tab-${pestana}`}
          className="fw-panel"
        >
          <FamiliaWinstonSeguimiento
            vista={pestana}
            datos={seguimiento}
            cargando={cargandoSeg}
            error={errorSeg}
            cicloFiltro={cicloFiltro}
            onCambiarCiclo={setCicloFiltro}
            opcionesCiclo={opcionesCiclo}
            onCambiarVista={cambiarPestana}
            onRecargar={() => void cargarSeguimiento()}
            onValidar={validarDesdeSeguimiento}
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * 2026-10-06 — El contenido se monta hasta que el PIN es válido: antes sus cargas iniciales
 * (inicio de clases, seguimiento) salían sin la cookie del PIN y recibían 401.
 */
export default function FamiliaWinstonModulo() {
  return (
    <UsuariosPinGate
      eyebrow="Servicios · Familia Winston"
      titulo="Acceso a Familia Winston"
      lead="Ingresa el PIN para validar comprobantes y condonar colegiaturas."
    >
      <FamiliaWinstonContenido />
    </UsuariosPinGate>
  )
}
