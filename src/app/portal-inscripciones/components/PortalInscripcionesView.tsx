'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  AlertTriangle,
  Code2,
  FileText,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type {
  EstadoPortalInscripciones,
  FacturaPasoInscripcion,
  PasoEstadoInscripcion,
  PasoInscripcion,
} from '@/lib/portalInscripcionesTypes'
import type { MatrizPortalPagos } from '@/lib/portalPagosMatrizService'
import {
  aplicarReglamentoVistoEnEstado,
  leerReglamentoVisto,
  marcarReglamentoVisto,
} from '@/lib/portalReglamentoVisto'
import {
  aplicarReciboFinalVistoEnEstado,
  leerReciboFinalVisto,
  marcarReciboFinalVisto,
} from '@/lib/portalReciboFinalVisto'
import {
  leerPlanPagosConfirmado,
  marcarPlanPagosConfirmado,
  limpiarPlanPagosConfirmado,
  planMesesNormalizado,
} from '@/lib/portalPlanPagosConfirmado'
import PortalColegiaturasSecciones from '@/app/portal-pagos/components/PortalColegiaturasSecciones'
import PortalDocumentoModal, {
  type TipoDocumentoPortal,
} from '@/app/portal-pagos/components/PortalDocumentoModal'
import PortalPlanPagosModal, {
  type PlanMesesOpcion,
} from '@/app/portal-inscripciones/components/PortalPlanPagosModal'

function nombreAlumno(estado: EstadoPortalInscripciones | null, fallback?: string): string {
  if (!estado) return fallback?.trim() || 'Alumno'
  const a = estado.alumno
  const n = `${a.alumno_nombre ?? ''} ${a.alumno_app ?? ''} ${a.alumno_apm ?? ''}`.trim()
  return n || fallback?.trim() || 'Alumno'
}

function iconoPaso(estado: PasoEstadoInscripcion) {
  switch (estado) {
    case 'completado':
      return <CheckCircle2 size={18} className="pi-paso-icon pi-paso-icon--ok" aria-hidden />
    case 'disponible':
      return <Circle size={18} className="pi-paso-icon pi-paso-icon--activo" aria-hidden />
    case 'atencion':
      return <AlertTriangle size={18} className="pi-paso-icon pi-paso-icon--warn" aria-hidden />
    default:
      return <Lock size={18} className="pi-paso-icon pi-paso-icon--lock" aria-hidden />
  }
}

function etiquetaEstado(estado: PasoEstadoInscripcion): string {
  switch (estado) {
    case 'completado':
      return 'Completado'
    case 'disponible':
      return 'Disponible'
    case 'atencion':
      return 'Pendiente'
    default:
      return 'Bloqueado'
  }
}

function AccionesPasoInscripcion({
  paso,
  onReglamento,
  onRecibo,
  onVerFactura,
}: {
  paso: PasoInscripcion
  onReglamento: () => void
  onRecibo: () => void
  onVerFactura: (tipo: TipoDocumentoPortal, factura: FacturaPasoInscripcion) => void
}) {
  const facturas = paso.facturas?.filter((f) => f.pdf) ?? []
  if (!paso.accion && facturas.length === 0) return null

  return (
    <div className="portal-inscripciones-paso-accion">
      {paso.accion?.tipo === 'proximo' ? (
        <button
          type="button"
          className="portal-inscripciones-paso-link portal-inscripciones-paso-link--proximo"
          disabled
          aria-disabled="true"
          title="Disponible próximamente"
        >
          {paso.accion.etiqueta}
          <span className="portal-inscripciones-paso-proximo-tag">Próximamente</span>
        </button>
      ) : paso.accion?.tipo === 'ruta-interna' ? (
        <Link href={paso.accion.href} className="portal-inscripciones-paso-link">
          {paso.accion.etiqueta}
          <ArrowRight size={20} aria-hidden />
        </Link>
      ) : paso.accion ? (
        <a
          href={paso.accion.href}
          className="portal-inscripciones-paso-link"
          target="_blank"
          rel="noopener noreferrer"
          onClick={
            paso.id === 'reglamento'
              ? onReglamento
              : paso.id === 'recibo-final'
                ? onRecibo
                : undefined
          }
        >
          {paso.accion.etiqueta}
          <ArrowRight size={20} aria-hidden />
        </a>
      ) : null}

      {facturas.length > 0 && (
        <div className="portal-inscripciones-paso-facturas" role="group" aria-label="Facturas CFDI">
          {facturas.map((f) => (
            <div key={f.conceptoNo} className="portal-inscripciones-paso-factura-grupo">
              {facturas.length > 1 && (
                <span className="portal-inscripciones-paso-factura-etiq">{f.etiqueta}</span>
              )}
              <div className="portal-matriz-facturas">
                <button
                  type="button"
                  className="portal-pagos-btn-pdf portal-inscripciones-paso-btn-factura"
                  onClick={() => onVerFactura('pdf', f)}
                >
                  <FileText size={16} aria-hidden />
                  PDF
                </button>
                {f.xml && (
                  <button
                    type="button"
                    className="portal-pagos-btn-xml portal-inscripciones-paso-btn-factura"
                    onClick={() => onVerFactura('xml', f)}
                  >
                    <Code2 size={16} aria-hidden />
                    XML
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProgresoInscripcion({
  pct,
  completados,
  totales,
}: {
  pct: number
  completados: number
  totales: number
}) {
  return (
    <section className="portal-inscripciones-progreso" aria-label="Progreso general">
      <div
        className="portal-inscripciones-progreso-ring"
        style={{ '--pi-pct': pct } as CSSProperties}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="portal-inscripciones-progreso-ring-inner">
          <span className="portal-inscripciones-progreso-pct">{pct}%</span>
          <span className="portal-inscripciones-progreso-sublabel">Progreso</span>
        </div>
      </div>
      <div className="portal-inscripciones-progreso-meta">
        <div className="portal-inscripciones-progreso-bar" aria-hidden>
          <div className="portal-inscripciones-progreso-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="portal-inscripciones-progreso-hint">
          <strong>{completados}</strong> de <strong>{totales}</strong> pasos completados
        </p>
      </div>
    </section>
  )
}

export default function PortalInscripcionesView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [estado, setEstado] = useState<EstadoPortalInscripciones | null>(null)
  const [reglamentoVisto, setReglamentoVisto] = useState(false)
  const [reciboFinalVisto, setReciboFinalVisto] = useState(false)
  const [pasosExpandidos, setPasosExpandidos] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [matriz, setMatriz] = useState<MatrizPortalPagos | null>(null)
  const [matrizCierre, setMatrizCierre] = useState<MatrizPortalPagos | null>(null)
  const [cargandoMatriz, setCargandoMatriz] = useState(false)
  const [cargandoMatrizCierre, setCargandoMatrizCierre] = useState(false)
  const [errorMatriz, setErrorMatriz] = useState<string | null>(null)
  const [errorMatrizCierre, setErrorMatrizCierre] = useState<string | null>(null)
  const [docModal, setDocModal] = useState<{
    abierto: boolean
    tipo: TipoDocumentoPortal
    url: string
    titulo: string
  }>({ abierto: false, tipo: 'pdf', url: '', titulo: '' })
  const [planConfirmado, setPlanConfirmado] = useState(false)
  const [planModalAbierto, setPlanModalAbierto] = useState(false)
  const [planGuardando, setPlanGuardando] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planPuedeCambiar, setPlanPuedeCambiar] = useState(true)
  const colegiaturasRef = useRef<HTMLElement>(null)
  const cierreRef = useRef<HTMLElement>(null)
  const revalidarCierreRef = useRef(false)

  const cargar = useCallback(async () => {
    if (alumnoId == null) {
      setError('Sesión de alumno no válida.')
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/portal-inscripciones/estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEstado(null)
        setError(data.error ?? 'No se pudo cargar el portal de inscripciones.')
      } else {
        const siguiente = data.estado as EstadoPortalInscripciones
        setEstado(siguiente)
        const cicloValor = Number(siguiente.ciclo?.valor ?? 0)
        const cicloColeg = Number(siguiente.cicloColegiaturas?.valor ?? 0)
        if (cicloValor > 0) {
          setReglamentoVisto(leerReglamentoVisto(alumnoId, cicloValor))
          setReciboFinalVisto(leerReciboFinalVisto(alumnoId, cicloValor))
        } else {
          setReglamentoVisto(false)
          setReciboFinalVisto(false)
        }
        if (cicloColeg > 0) {
          setPlanConfirmado(leerPlanPagosConfirmado(alumnoId, cicloColeg))
        } else {
          setPlanConfirmado(false)
        }
        setPlanError(null)
        setPlanModalAbierto(false)
      }
    } catch {
      setEstado(null)
      setError('Error de conexión al cargar inscripciones.')
    }
    setCargando(false)
  }, [alumnoId])

  const cargarMatriz = useCallback(async () => {
    if (alumnoId == null) return
    const cicloColeg = Number(estado?.cicloColegiaturas?.valor ?? 0)
    setCargandoMatriz(true)
    setErrorMatriz(null)
    try {
      const res = await fetch('/api/portal-pagos/matriz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId,
          ...(cicloColeg > 0 ? { cicloValor: cicloColeg } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMatriz(null)
        setErrorMatriz(data.error ?? 'No se pudieron cargar las colegiaturas.')
      } else {
        setMatriz(data.matriz)
      }
    } catch {
      setMatriz(null)
      setErrorMatriz('Error de conexión al cargar colegiaturas.')
    }
    setCargandoMatriz(false)
  }, [alumnoId, estado?.cicloColegiaturas?.valor])

  const cargarMatrizCierre = useCallback(
    async (cicloValor: number) => {
      if (alumnoId == null) return
      setCargandoMatrizCierre(true)
      setErrorMatrizCierre(null)
      try {
        const res = await fetch('/api/portal-pagos/matriz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alumnoId,
            cicloValor,
            soloColegiatura: true,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setMatrizCierre(null)
          setErrorMatrizCierre(data.error ?? 'No se pudo cargar el cierre de ciclo.')
        } else {
          setMatrizCierre(data.matriz)
        }
      } catch {
        setMatrizCierre(null)
        setErrorMatrizCierre('Error de conexión al cargar el cierre de ciclo.')
      }
      setCargandoMatrizCierre(false)
    },
    [alumnoId]
  )

  useEffect(() => {
    void cargar()
  }, [cargar])

  const esReinscrito = estado?.formaIngreso === 0

  const estadoVista = useMemo(() => {
    if (!estado) return null
    const conReglamento = aplicarReglamentoVistoEnEstado(estado, reglamentoVisto)
    return aplicarReciboFinalVistoEnEstado(conReglamento, reciboFinalVisto)
  }, [estado, reglamentoVisto, reciboFinalVisto])

  const cierrePendiente = Boolean(
    estadoVista?.cierreCiclo?.requerido && !estadoVista.cierreCiclo.liquidado
  )
  const cicloCierreValorUi = estadoVista?.cierreCiclo?.ciclo.valor ?? null

  const reciboPaso = estadoVista?.pasos.find((p) => p.id === 'recibo-final') ?? null
  // Colegiaturas del ciclo nuevo: solo con el proceso completo (todos los pasos
  // en completado). "Disponible" = aún falta generar/abrir algo.
  const procesoCompleto = Boolean(
    estadoVista &&
      !cierrePendiente &&
      estadoVista.pasos.length > 0 &&
      estadoVista.pasos.every((p) => p.estado === 'completado')
  )
  const colegiaturasDesbloqueadas = Boolean(
    estadoVista && !estadoVista.bloqueo && procesoCompleto
  )

  // Antes de armar la matriz del ciclo nuevo: confirmar / elegir plan 10 u 11
  // (reinscritos y nuevo ingreso). Abrir modal en sync; no saltar en silencio.
  useEffect(() => {
    if (!colegiaturasDesbloqueadas || alumnoId == null) {
      setPlanModalAbierto(false)
      return
    }
    const cicloColeg = Number(estadoVista?.cicloColegiaturas?.valor ?? 0)
    if (cicloColeg <= 0) return

    const yaConfirmado =
      planConfirmado || leerPlanPagosConfirmado(alumnoId, cicloColeg)

    if (yaConfirmado) {
      setPlanConfirmado(true)
      setPlanModalAbierto(false)
    } else {
      // Abrir ya: no esperar al GET (evita saltarse la modal si el fetch falla / se cancela).
      setPlanModalAbierto(true)
    }

    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/portal-inscripciones/plan-pagos?alumnoId=${alumnoId}&cicloValor=${cicloColeg}`
        )
        const data = await res.json().catch(() => null)
        if (cancelado) return
        if (res.ok) {
          setPlanPuedeCambiar(data?.puedeCambiar !== false)
        }
      } catch {
        /* modal ya abierta si hace falta */
      }
    })()

    return () => {
      cancelado = true
    }
  }, [
    colegiaturasDesbloqueadas,
    alumnoId,
    planConfirmado,
    estadoVista?.cicloColegiaturas?.valor,
  ])

  useEffect(() => {
    if (colegiaturasDesbloqueadas && planConfirmado) void cargarMatriz()
  }, [colegiaturasDesbloqueadas, planConfirmado, cargarMatriz])

  const confirmarPlanPagos = useCallback(
    async (plan: PlanMesesOpcion) => {
      if (alumnoId == null) return
      const cicloColeg = Number(estado?.cicloColegiaturas?.valor ?? 0)
      if (cicloColeg <= 0) {
        setPlanError('No se pudo determinar el ciclo de colegiaturas.')
        return
      }
      setPlanGuardando(true)
      setPlanError(null)
      try {
        const res = await fetch('/api/portal-inscripciones/plan-pagos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alumnoId,
            planMeses: plan,
            cicloValor: cicloColeg,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setPlanError(data?.error ?? 'No se pudo guardar el plan de pagos.')
          setPlanGuardando(false)
          return
        }
        const planFinal = planMesesNormalizado(data.planMeses ?? plan)
        marcarPlanPagosConfirmado(alumnoId, cicloColeg)
        setEstado((prev) =>
          prev
            ? {
                ...prev,
                alumno: { ...prev.alumno, mes: planFinal },
              }
            : prev
        )
        setPlanPuedeCambiar(!data.bloqueadoPorPagos)
        setMatriz(null)
        setPlanConfirmado(true)
        setPlanModalAbierto(false)
      } catch {
        setPlanError('Error de conexión al guardar el plan.')
      }
      setPlanGuardando(false)
    },
    [alumnoId, estado?.cicloColegiaturas?.valor]
  )

  const abrirCambioPlan = useCallback(() => {
    if (alumnoId == null || !planPuedeCambiar) return
    const cicloColeg = Number(estado?.cicloColegiaturas?.valor ?? 0)
    if (cicloColeg <= 0) return
    limpiarPlanPagosConfirmado(alumnoId, cicloColeg)
    setPlanConfirmado(false)
    setPlanError(null)
    setPlanModalAbierto(true)
  }, [alumnoId, planPuedeCambiar, estado?.cicloColegiaturas?.valor])

  useEffect(() => {
    if (cierrePendiente && cicloCierreValorUi != null) {
      void cargarMatrizCierre(cicloCierreValorUi)
    } else {
      setMatrizCierre(null)
      revalidarCierreRef.current = false
    }
  }, [cierrePendiente, cicloCierreValorUi, cargarMatrizCierre])

  // Si la matriz de cierre ya trae todos los conceptos pagados pero el estado
  // aún marca adeudo, revalidar una vez (misma fuente de verdad al estado).
  useEffect(() => {
    if (!cierrePendiente || !matrizCierre || revalidarCierreRef.current) return
    const filas = matrizCierre.secciones.flatMap((s) => s.filas)
    if (filas.length === 0 || filas.some((f) => !f.pagado)) return
    revalidarCierreRef.current = true
    void cargar()
  }, [cierrePendiente, matrizCierre, cargar])

  const refrescarTrasPagoCierre = useCallback(async () => {
    revalidarCierreRef.current = false
    await cargar()
    if (cicloCierreValorUi != null) await cargarMatrizCierre(cicloCierreValorUi)
  }, [cargar, cargarMatrizCierre, cicloCierreValorUi])

  const marcarReglamentoConsultado = useCallback(() => {
    if (alumnoId == null || !estado?.ciclo?.valor) return
    marcarReglamentoVisto(alumnoId, Number(estado.ciclo.valor))
    setReglamentoVisto(true)
  }, [alumnoId, estado?.ciclo?.valor])

  const marcarReciboConsultado = useCallback(() => {
    if (alumnoId == null || !estado?.ciclo?.valor) return
    marcarReciboFinalVisto(alumnoId, Number(estado.ciclo.valor))
    setReciboFinalVisto(true)
  }, [alumnoId, estado?.ciclo?.valor])

  const abrirFacturaPaso = useCallback(
    (tipo: TipoDocumentoPortal, factura: FacturaPasoInscripcion) => {
      const url = tipo === 'pdf' ? factura.pdf : factura.xml
      if (!url) return
      setDocModal({
        abierto: true,
        tipo,
        url,
        titulo:
          tipo === 'pdf'
            ? `Factura PDF — ${factura.etiqueta}`
            : `Factura XML — ${factura.etiqueta}`,
      })
    },
    []
  )

  const refFmt = String(session?.alumno_ref ?? '').padStart(5, '0')

  return (
    <div className="dashboard-container dashboard-home portal-inscripciones-page">
      <div className="dashboard-home-bg" aria-hidden />
      <div className="dashboard-main portal-inscripciones-main">
        <header className="portal-inscripciones-encabezado">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al inicio
          </button>

          <div className="portal-inscripciones-encabezado-grid">
            <div>
              <p className="portal-inscripciones-kicker">Proceso escolar</p>
              <h1 className="dashboard-title portal-inscripciones-titulo">
                Inscripciones y Colegiaturas
              </h1>
              <p className="dashboard-subtitle portal-inscripciones-lead">
                {esReinscrito
                  ? 'Reinscribe a tu hijo(a) y mantén al día el pago de sus colegiaturas.'
                  : estadoVista
                    ? 'Completa la inscripción de tu hijo(a) y continúa con el pago de sus colegiaturas.'
                    : 'Completa tu inscripción o reinscripción y continúa con el pago de colegiaturas.'}
              </p>
            </div>
            {estadoVista?.ciclo && (
              <div className="portal-inscripciones-ciclo-badge" aria-label="Ciclo escolar vigente">
                <span className="portal-inscripciones-ciclo-label">Ciclo vigente</span>
                <span className="portal-inscripciones-ciclo-nombre">{estadoVista.ciclo.nombre}</span>
              </div>
            )}
          </div>

          {estadoVista && (
            <div className="portal-inscripciones-hero">
              <div className="portal-inscripciones-alumno-card">
                <div className="portal-inscripciones-alumno-info">
                  <span className="portal-inscripciones-alumno-nombre">
                    {nombreAlumno(estadoVista, session?.displayName)}
                  </span>
                  <span className="portal-inscripciones-alumno-meta">
                    No. {refFmt} · {estadoVista.gradoEtiqueta} · {estadoVista.formaIngresoEtiqueta}
                  </span>
                </div>
                <button
                  type="button"
                  className="portal-inscripciones-btn-sec"
                  onClick={() => void cargar()}
                  disabled={cargando}
                  aria-label="Actualizar estado"
                >
                  <RefreshCw size={16} className={cargando ? 'portal-inscripciones-spin' : ''} />
                  Actualizar
                </button>
              </div>
              <ProgresoInscripcion
                pct={estadoVista.progresoPct}
                completados={estadoVista.pasosCompletados}
                totales={estadoVista.pasosTotales}
              />
            </div>
          )}
        </header>

        {cargando && !estadoVista && (
          <div className="portal-inscripciones-estado" role="status">
            <RefreshCw size={20} className="portal-inscripciones-spin" aria-hidden />
            Cargando tu proceso de inscripción…
          </div>
        )}

        {error && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--error" role="alert">
            {error}
          </div>
        )}

        {estadoVista?.bloqueo && estadoVista.mensajeBloqueo && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--bloqueo" role="alert">
            <AlertTriangle size={18} aria-hidden />
            {estadoVista.mensajeBloqueo}
          </div>
        )}

        {estadoVista?.aviso && !estadoVista.bloqueo && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--aviso" role="status">
            <Clock size={18} aria-hidden />
            {estadoVista.aviso}
          </div>
        )}

        {estadoVista && cierrePendiente && estadoVista.cierreCiclo && (
          <section
            ref={cierreRef}
            id="cierre-ciclo"
            className="portal-inscripciones-colegiaturas-seccion portal-inscripciones-cierre-ciclo"
            aria-label={`Cierre de ciclo ${estadoVista.cierreCiclo.ciclo.nombre}`}
          >
            <div className="portal-inscripciones-colegiaturas-head">
              <div>
                <h2 className="portal-inscripciones-colegiaturas-titulo">
                  Cierre de ciclo {estadoVista.cierreCiclo.ciclo.nombre}
                </h2>
                <p className="portal-inscripciones-colegiaturas-sub">
                  Liquida las colegiaturas pendientes de este ciclo (un pago a la vez) para
                  habilitar tu reinscripción.
                </p>
              </div>
              <span className="portal-inscripciones-plan-badge">
                {estadoVista.cierreCiclo.planEtiqueta}
              </span>
            </div>

            {cargandoMatrizCierre && !matrizCierre ? (
              <div className="portal-inscripciones-estado" role="status">
                <RefreshCw size={20} className="portal-inscripciones-spin" aria-hidden />
                Cargando pagos del ciclo a cerrar…
              </div>
            ) : errorMatrizCierre ? (
              <div
                className="portal-inscripciones-alerta portal-inscripciones-alerta--error"
                role="alert"
              >
                {errorMatrizCierre}
              </div>
            ) : matrizCierre ? (
              <PortalColegiaturasSecciones
                alumnoId={matrizCierre.alumno.alumno_id}
                ciclo={matrizCierre.ciclo}
                cicloTemporada={estadoVista?.ciclo.valor}
                alumno={matrizCierre.alumno}
                secciones={matrizCierre.secciones}
                displayName={session?.displayName}
                cargando={cargandoMatrizCierre}
                onActualizar={() => void refrescarTrasPagoCierre()}
              />
            ) : null}
          </section>
        )}

        {estadoVista && !cierrePendiente && (
          <>
            {procesoCompleto ? (
              <div className="portal-inscripciones-proceso-wrap">
                <button
                  type="button"
                  className={`portal-inscripciones-proceso-toggle${
                    pasosExpandidos ? ' is-open' : ''
                  }`}
                  aria-expanded={pasosExpandidos}
                  onClick={() => setPasosExpandidos((v) => !v)}
                >
                  <span className="portal-inscripciones-proceso-toggle-icon" aria-hidden>
                    <CheckCircle2 size={20} />
                  </span>
                  <span className="portal-inscripciones-proceso-toggle-text">
                    {esReinscrito
                      ? 'Proceso de reinscripción completado'
                      : 'Proceso de admisión completado'}
                  </span>
                  <span className="portal-inscripciones-proceso-toggle-chevron">
                    <span className="portal-inscripciones-proceso-toggle-hint">
                      {pasosExpandidos ? 'Collapsar' : 'Expandir'}
                    </span>
                    {pasosExpandidos ? <ChevronUp size={20} aria-hidden /> : <ChevronDown size={20} aria-hidden />}
                  </span>
                </button>

                {pasosExpandidos && (
                  <ol className="portal-inscripciones-pasos portal-inscripciones-pasos--acordeon">
                    {estadoVista.pasos.map((paso) => (
                      <li
                        key={paso.id}
                        className={`portal-inscripciones-paso portal-inscripciones-paso--${paso.estado}`}
                      >
                        <div className="portal-inscripciones-paso-indice" aria-hidden>
                          <span className="portal-inscripciones-paso-numero">
                            {String(paso.orden).padStart(2, '0')}
                          </span>
                          <span className="portal-inscripciones-paso-indice-icono">
                            {iconoPaso(paso.estado)}
                          </span>
                        </div>
                        <div className="portal-inscripciones-paso-cuerpo">
                          <div className="portal-inscripciones-paso-cabecera">
                            <h2 className="portal-inscripciones-paso-titulo">{paso.titulo}</h2>
                            <span
                              className={`portal-inscripciones-paso-badge portal-inscripciones-paso-badge--${paso.estado}`}
                            >
                              {etiquetaEstado(paso.estado)}
                            </span>
                          </div>
                          <p className="portal-inscripciones-paso-desc">{paso.descripcion}</p>
                          {paso.detalle && (
                            <p className="portal-inscripciones-paso-detalle">{paso.detalle}</p>
                          )}
                          <AccionesPasoInscripcion
                            paso={paso}
                            onReglamento={marcarReglamentoConsultado}
                            onRecibo={marcarReciboConsultado}
                            onVerFactura={abrirFacturaPaso}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              <ol className="portal-inscripciones-pasos">
                {estadoVista.pasos.map((paso) => (
                  <li
                    key={paso.id}
                    className={`portal-inscripciones-paso portal-inscripciones-paso--${paso.estado}`}
                  >
                    <div className="portal-inscripciones-paso-indice" aria-hidden>
                      <span className="portal-inscripciones-paso-numero">
                        {String(paso.orden).padStart(2, '0')}
                      </span>
                      <span className="portal-inscripciones-paso-indice-icono">
                        {iconoPaso(paso.estado)}
                      </span>
                    </div>
                    <div className="portal-inscripciones-paso-cuerpo">
                      <div className="portal-inscripciones-paso-cabecera">
                        <h2 className="portal-inscripciones-paso-titulo">{paso.titulo}</h2>
                        <span
                          className={`portal-inscripciones-paso-badge portal-inscripciones-paso-badge--${paso.estado}`}
                        >
                          {etiquetaEstado(paso.estado)}
                        </span>
                      </div>
                      <p className="portal-inscripciones-paso-desc">{paso.descripcion}</p>
                      {paso.detalle && (
                        <p className="portal-inscripciones-paso-detalle">{paso.detalle}</p>
                      )}
                      <AccionesPasoInscripcion
                        paso={paso}
                        onReglamento={marcarReglamentoConsultado}
                        onRecibo={marcarReciboConsultado}
                        onVerFactura={abrirFacturaPaso}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {!estadoVista.bloqueo && (esReinscrito || reciboPaso != null) && (
              <section
                ref={colegiaturasRef}
                id="colegiaturas"
                className="portal-inscripciones-colegiaturas-seccion"
                aria-label="Colegiaturas del ciclo"
              >
                <div className="portal-inscripciones-colegiaturas-head">
                  <div>
                    <h2 className="portal-inscripciones-colegiaturas-titulo">
                      Colegiaturas del ciclo
                      {matriz?.ciclo?.nombre
                        ? ` ${matriz.ciclo.nombre}`
                        : estadoVista.cicloColegiaturas?.nombre
                          ? ` ${estadoVista.cicloColegiaturas.nombre}`
                          : ''}
                    </h2>
                    <p className="portal-inscripciones-colegiaturas-sub">
                      {esReinscrito
                        ? 'Tras la reinscripción: cuota de inicio de curso (concepto 00) y mensualidades del ciclo nuevo.'
                        : 'Cuota de inicio de curso (concepto 00) y mensualidades del ciclo.'}
                    </p>
                  </div>
                  {colegiaturasDesbloqueadas && planConfirmado && (
                    <div className="portal-inscripciones-plan-acciones">
                      {(matriz?.planEtiqueta || estadoVista.alumno.mes != null) && (
                        <span className="portal-inscripciones-plan-badge">
                          {matriz?.planEtiqueta ??
                            (planMesesNormalizado(estadoVista.alumno.mes) === 2
                              ? 'Plan de pagos: 11 meses'
                              : 'Plan de pagos: 10 meses')}
                        </span>
                      )}
                      {planPuedeCambiar && (
                        <button
                          type="button"
                          className="portal-inscripciones-plan-cambiar"
                          onClick={abrirCambioPlan}
                        >
                          Cambiar plan
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!colegiaturasDesbloqueadas ? (
                  <div className="portal-inscripciones-colegiaturas-bloqueo" role="note">
                    <Lock size={20} aria-hidden />
                    <div>
                      <p className="portal-inscripciones-colegiaturas-bloqueo-titulo">
                        Colegiaturas bloqueadas
                      </p>
                      <p className="portal-inscripciones-colegiaturas-bloqueo-desc">
                        {esReinscrito ? (
                          <>
                            Completa los <strong>4 pasos de reinscripción</strong> (solicitud,
                            reglamento, pago y recibo final). Mientras algún paso siga en
                            Disponible, la cuota de inicio de curso y las mensualidades del ciclo
                            nuevo permanecen bloqueadas.
                          </>
                        ) : reciboPaso?.estado === 'disponible' || reciboPaso?.estado === 'completado' ? (
                          <>
                            Abre el <strong>recibo final</strong> al menos una vez para marcarlo
                            como completado y, con el resto de pasos terminados, desbloquear la{' '}
                            <strong>cuota de inicio de curso</strong> y las mensualidades del ciclo.
                          </>
                        ) : (
                          <>
                            Completa todos los pasos de inscripción (incluido el recibo final) para
                            desbloquear la <strong>cuota de inicio de curso</strong> y las
                            mensualidades del ciclo.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ) : !planConfirmado ? (
                  <div className="portal-inscripciones-colegiaturas-bloqueo" role="status">
                    <CalendarRange size={20} aria-hidden />
                    <div>
                      <p className="portal-inscripciones-colegiaturas-bloqueo-titulo">
                        Confirma tu plan de pagos
                      </p>
                      <p className="portal-inscripciones-colegiaturas-bloqueo-desc">
                        Elige mantener o cambiar el plan (10 u 11 meses). Con eso se arman las
                        colegiaturas del ciclo nuevo.
                      </p>
                    </div>
                  </div>
                ) : cargandoMatriz && !matriz ? (
                  <div className="portal-inscripciones-estado" role="status">
                    <RefreshCw size={20} className="portal-inscripciones-spin" aria-hidden />
                    Cargando colegiaturas del ciclo…
                  </div>
                ) : errorMatriz ? (
                  <div
                    className="portal-inscripciones-alerta portal-inscripciones-alerta--error"
                    role="alert"
                  >
                    {errorMatriz}
                  </div>
                ) : matriz ? (
                  <PortalColegiaturasSecciones
                    alumnoId={matriz.alumno.alumno_id}
                    ciclo={matriz.ciclo}
                    cicloTemporada={estadoVista?.ciclo.valor}
                    alumno={matriz.alumno}
                    secciones={matriz.secciones}
                    displayName={session?.displayName}
                    cargando={cargandoMatriz}
                    onActualizar={() => void cargarMatriz()}
                  />
                ) : null}
              </section>
            )}
          </>
        )}
      </div>

      <PortalDocumentoModal
        abierto={docModal.abierto}
        tipo={docModal.tipo}
        url={docModal.url}
        titulo={docModal.titulo}
        onCerrar={() => setDocModal((s) => ({ ...s, abierto: false }))}
      />

      <PortalPlanPagosModal
        abierto={planModalAbierto}
        planActual={planMesesNormalizado(estadoVista?.alumno.mes) as PlanMesesOpcion}
        cicloNombre={estadoVista?.cicloColegiaturas?.nombre ?? matriz?.ciclo?.nombre}
        esNuevoIngreso={!esReinscrito}
        puedeCambiar={planPuedeCambiar}
        guardando={planGuardando}
        error={planError}
        onConfirmar={(plan) => void confirmarPlanPagos(plan)}
      />
    </div>
  )
}
