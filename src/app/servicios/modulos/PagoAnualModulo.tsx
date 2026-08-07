'use client'

import { useCallback, useEffect, useState } from 'react'
import { Banknote, CalendarDays, Loader2, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { clasePlanMeses } from '@/lib/alumnoPlanMeses'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import UsuariosPinGate from '../components/UsuariosPinGate'

type PlanMeses = 1 | 2

type EstadoPagoAnual = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  cicloValor: number
  planMeses: PlanMeses
  planEtiqueta: string
  montoLista: number
  montoConDescuento: number
  descuentoPct: number
  conceptosCubiertos: string[]
  bloqueadoPorPagos: boolean
  puedeActivar: boolean
  puedeDesactivar: boolean
  activo: boolean
  pagado: boolean
  vencimiento: string | null
  vencido: boolean
}

function fmt(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

export default function PagoAnualModulo() {
  const { cicloSeleccionado } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [estado, setEstado] = useState<EstadoPagoAnual | null>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const cargar = useCallback(async (alumnoId: number, cicloValor: number) => {
    setCargando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch(
        `/api/servicios/pago-anual?alumnoId=${alumnoId}&cicloValor=${cicloValor}`,
        { cache: 'no-store' }
      )
      const data = (await res.json().catch(() => ({}))) as EstadoPagoAnual & { error?: string }
      if (!res.ok) {
        setEstado(null)
        setError(data.error ?? 'No se pudo consultar pago anual.')
        return
      }
      setEstado(data)
    } catch {
      setEstado(null)
      setError('Error de conexión al consultar pago anual.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!alumnoSeleccionado?.alumno_id) {
      setEstado(null)
      return
    }
    void cargar(alumnoSeleccionado.alumno_id, cicloSeleccionado)
  }, [alumnoSeleccionado?.alumno_id, cicloSeleccionado, cargar])

  const postAccion = async (accion: 'activar' | 'desactivar' | 'pago-efectivo') => {
    if (!estado) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/servicios/pago-anual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          alumnoId: estado.alumnoId,
          cicloValor: cicloSeleccionado,
          formaPago: 'Efectivo',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as EstadoPagoAnual & {
        error?: string
        referencia?: string
        mesesCubiertos?: string[]
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo completar la acción.')
        return
      }
      setEstado(data)
      if (accion === 'activar') setMensaje('Pago anual activado. El alumno lo verá en el portal.')
      if (accion === 'desactivar') {
        setMensaje(
          'Pago anual desactivado. Se revirtió la cobertura (concepto 30 y meses en $0 cancelados).'
        )
      }
      if (accion === 'pago-efectivo') {
        setMensaje(
          `Pago en efectivo registrado${data.referencia ? ` (${data.referencia})` : ''}. Colegiaturas del plan cubiertas.`
        )
      }
    } catch {
      setError('Error de conexión.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <UsuariosPinGate
      eyebrow="Servicios · Pago Anual"
      titulo="Acceso a pago anual"
      lead="Ingresa el PIN para activar o cobrar el pago anual de colegiaturas."
    >
      <div className="servicios-panel-inner pa-modulo">
        <header className="servicios-panel-header">
          <h1 className="servicios-panel-title">
            <Sparkles size={22} aria-hidden /> Pago Anual
          </h1>
          <p className="servicios-panel-lead">
            Activa un único concepto (30) con 5% de descuento sobre las colegiaturas del plan.
            Solo si no hay pagos de septiembre a junio (o julio). Vence el 15 de agosto.
          </p>
        </header>

        <div className="servicios-panel-card pa-card">
          <div className="pa-toolbar">
            <div className="pa-autocomplete">
              <AlumnoAutocomplete
                etiqueta="Nombre del alumno / No. control"
                alumnoSeleccionado={alumnoSeleccionado}
                onSeleccionar={setAlumnoSeleccionado}
                autoFocus={!resolviendoCiclo}
              />
            </div>
            <button
              type="button"
              className="usr-btn"
              disabled={!alumnoSeleccionado || cargando || guardando}
              onClick={() =>
                alumnoSeleccionado && void cargar(alumnoSeleccionado.alumno_id, cicloSeleccionado)
              }
            >
              {cargando ? <Loader2 className="usr-spin" size={16} /> : <RefreshCw size={16} />}
              Actualizar
            </button>
          </div>

          <p className="pa-ciclo-hint">
            Ciclo de trabajo: <strong>{etiquetaCicloEscolar(cicloSeleccionado)}</strong>
          </p>

          {error ? (
            <p className="pa-alert pa-alert--error" role="alert">
              {error}
            </p>
          ) : null}
          {mensaje ? (
            <p className="pa-alert pa-alert--ok" role="status">
              {mensaje}
            </p>
          ) : null}

          {cargando && !estado ? (
            <div className="pa-loading" role="status">
              <Loader2 className="usr-spin" size={20} />
              Consultando…
            </div>
          ) : null}

          {estado ? (
            <div className="pa-resultado">
              <div className="pa-alumno">
                <span className="pa-alumno-ref">{estado.alumnoRef}</span>
                <span className="pa-alumno-nombre">{estado.nombre}</span>
                <span className={`pc-plan-badge ${clasePlanMeses(estado.planMeses)}`}>
                  {estado.planEtiqueta}
                </span>
              </div>

              <div className="pa-montos">
                <div>
                  <span className="pa-monto-label">Suma colegiaturas</span>
                  <strong>{fmt(estado.montoLista)}</strong>
                </div>
                <div>
                  <span className="pa-monto-label">Descuento {estado.descuentoPct}%</span>
                  <strong className="pa-monto-desc">
                    −{fmt(estado.montoLista - estado.montoConDescuento)}
                  </strong>
                </div>
                <div>
                  <span className="pa-monto-label">Pago anual (concepto 30)</span>
                  <strong className="pa-monto-total">{fmt(estado.montoConDescuento)}</strong>
                </div>
              </div>

              <p className="pa-vencimiento">
                <CalendarDays size={15} aria-hidden />
                Fecha límite:{' '}
                <strong>{estado.vencimiento ?? '—'}</strong>
                {estado.vencido ? ' · vencido' : ''}
              </p>

              {estado.bloqueadoPorPagos ? (
                <div className="pa-bloqueado" role="status">
                  <ShieldAlert size={18} aria-hidden />
                  <div>
                    <strong>No se puede activar</strong>
                    <p>
                      Ya hay al menos una colegiatura pagada del plan (septiembre a{' '}
                      {estado.planMeses === 2 ? 'julio' : 'junio'}).
                    </p>
                  </div>
                </div>
              ) : null}

              {estado.pagado ? (
                <div className="pa-alert pa-alert--ok" role="status">
                  Pago anual cobrado. Las colegiaturas del plan quedaron cubiertas. Puedes
                  desactivarlo para revertir y volver a probar.
                </div>
              ) : null}

              {estado.activo && !estado.pagado ? (
                <div className="pa-alert pa-alert--info" role="status">
                  Activo en portal: el alumno ve <strong>Pago Anual</strong> en lugar de
                  septiembre–{estado.planMeses === 2 ? 'julio' : 'junio'}.
                </div>
              ) : null}

              {!estado.activo && !estado.pagado && !estado.bloqueadoPorPagos ? (
                <div className="pa-alert pa-alert--info" role="status">
                  Listo para activar. El alumno verá el concepto 30 en el portal.
                </div>
              ) : null}

              <div className="pa-acciones">
                <button
                  type="button"
                  className="usr-btn usr-btn-primary"
                  disabled={guardando || !estado.puedeActivar}
                  onClick={() => void postAccion('activar')}
                  title={
                    estado.puedeActivar
                      ? 'Activar pago anual en el portal'
                      : estado.activo
                        ? 'Ya está activo'
                        : estado.pagado
                          ? 'Desactiva primero para volver a activar'
                          : estado.bloqueadoPorPagos
                            ? 'Hay colegiaturas pagadas'
                            : 'No se puede activar'
                  }
                >
                  {guardando ? <Loader2 className="usr-spin" size={16} /> : <Sparkles size={16} />}
                  Activar pago anual
                </button>

                <button
                  type="button"
                  className="usr-btn"
                  disabled={guardando || !estado.puedeDesactivar}
                  onClick={() => void postAccion('desactivar')}
                  title={
                    estado.puedeDesactivar
                      ? 'Desactivar y revertir cobertura de prueba'
                      : 'No hay pago anual que desactivar'
                  }
                >
                  Desactivar
                </button>

                {estado.activo && !estado.pagado ? (
                  <button
                    type="button"
                    className="usr-btn usr-btn-primary"
                    disabled={guardando}
                    onClick={() => void postAccion('pago-efectivo')}
                  >
                    {guardando ? <Loader2 className="usr-spin" size={16} /> : <Banknote size={16} />}
                    Registrar pago en efectivo
                  </button>
                ) : null}
              </div>

              <p className="servicios-panel-hint">
                Meses cubiertos ({estado.conceptosCubiertos.length}):{' '}
                {estado.conceptosCubiertos.join(', ')}. Openpay / comercio electrónico usan el
                mismo concepto 30 desde el portal.
              </p>
            </div>
          ) : !cargando && !error ? (
            <p className="servicios-panel-hint">
              Busca un alumno para activar o cobrar su pago anual.
            </p>
          ) : null}
        </div>
      </div>
    </UsuariosPinGate>
  )
}
