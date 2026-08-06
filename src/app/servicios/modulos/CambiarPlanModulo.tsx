'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarRange, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { clasePlanMeses } from '@/lib/alumnoPlanMeses'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import UsuariosPinGate from '../components/UsuariosPinGate'

type PlanMeses = 1 | 2

type EstadoPlan = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  cicloValor: number
  planMeses: PlanMeses
  planEtiqueta: string
  bloqueadoPorSeptiembre: boolean
  puedeCambiar: boolean
}

export default function CambiarPlanModulo() {
  const { cicloSeleccionado } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [estado, setEstado] = useState<EstadoPlan | null>(null)
  const [planElegido, setPlanElegido] = useState<PlanMeses>(1)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const cargarEstado = useCallback(async (alumnoId: number, cicloValor: number) => {
    setCargando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch(
        `/api/servicios/cambiar-plan?alumnoId=${alumnoId}&cicloValor=${cicloValor}`,
        { cache: 'no-store' }
      )
      const data = (await res.json().catch(() => ({}))) as EstadoPlan & { error?: string }
      if (!res.ok) {
        setEstado(null)
        setError(data.error ?? 'No se pudo consultar el plan.')
        return
      }
      setEstado(data)
      setPlanElegido(data.planMeses)
    } catch {
      setEstado(null)
      setError('Error de conexión al consultar el plan.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!alumnoSeleccionado?.alumno_id) {
      setEstado(null)
      return
    }
    void cargarEstado(alumnoSeleccionado.alumno_id, cicloSeleccionado)
  }, [alumnoSeleccionado?.alumno_id, cicloSeleccionado, cargarEstado])

  const guardar = async () => {
    if (!estado) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/servicios/cambiar-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId: estado.alumnoId,
          cicloValor: cicloSeleccionado,
          planMeses: planElegido,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        planEtiqueta?: string
        cambiado?: boolean
        planMeses?: PlanMeses
        bloqueadoPorSeptiembre?: boolean
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cambiar el plan.')
        return
      }
      setEstado((prev) =>
        prev
          ? {
              ...prev,
              planMeses: (data.planMeses ?? planElegido) as PlanMeses,
              planEtiqueta: data.planEtiqueta ?? prev.planEtiqueta,
              bloqueadoPorSeptiembre: Boolean(data.bloqueadoPorSeptiembre),
              puedeCambiar: !data.bloqueadoPorSeptiembre,
            }
          : prev
      )
      setMensaje(
        data.cambiado
          ? `Plan actualizado a ${data.planEtiqueta}.`
          : 'El plan ya estaba en esa opción; no hubo cambios.'
      )
    } catch {
      setError('Error de conexión al guardar el plan.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <UsuariosPinGate
      eyebrow="Servicios · Cambiar plan"
      titulo="Acceso a cambiar plan"
      lead="Ingresa el PIN para modificar el plan de 10 u 11 meses."
    >
      <div className="servicios-panel-inner cp-modulo">
        <header className="servicios-panel-header">
          <h1 className="servicios-panel-title">
            <CalendarRange size={22} aria-hidden /> Cambiar plan
          </h1>
          <p className="servicios-panel-lead">
            Cambia el plan de pagos a 10 u 11 meses. Solo se permite si el alumno aún no ha
            pagado la colegiatura de septiembre del ciclo seleccionado.
          </p>
        </header>

        <div className="servicios-panel-card cp-card">
          <div className="cp-toolbar">
            <div className="cp-autocomplete">
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
                alumnoSeleccionado &&
                void cargarEstado(alumnoSeleccionado.alumno_id, cicloSeleccionado)
              }
              title="Recargar estado del plan"
            >
              {cargando ? <Loader2 className="usr-spin" size={16} /> : <RefreshCw size={16} />}
              Actualizar
            </button>
          </div>

          <p className="cp-ciclo-hint">
            Ciclo de trabajo: <strong>{etiquetaCicloEscolar(cicloSeleccionado)}</strong>
          </p>

          {error ? (
            <p className="cp-alert cp-alert--error" role="alert">
              {error}
            </p>
          ) : null}
          {mensaje ? (
            <p className="cp-alert cp-alert--ok" role="status">
              {mensaje}
            </p>
          ) : null}

          {cargando && !estado ? (
            <div className="cp-loading" role="status">
              <Loader2 className="usr-spin" size={20} />
              Consultando plan…
            </div>
          ) : null}

          {estado ? (
            <div className="cp-resultado">
              <div className="cp-alumno">
                <span className="cp-alumno-ref">{estado.alumnoRef}</span>
                <span className="cp-alumno-nombre">{estado.nombre}</span>
                <span className={`pc-plan-badge ${clasePlanMeses(estado.planMeses)}`}>
                  {estado.planEtiqueta}
                </span>
              </div>

              {estado.bloqueadoPorSeptiembre ? (
                <div className="cp-bloqueado" role="status">
                  <ShieldAlert size={18} aria-hidden />
                  <div>
                    <strong>No se puede cambiar el plan</strong>
                    <p>
                      Ya existe colegiatura de septiembre pagada en este ciclo. El plan queda
                      fijo en {estado.planEtiqueta}.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <fieldset className="cp-planes" disabled={guardando}>
                    <legend>Nuevo plan</legend>
                    <label className={`cp-plan-opcion ${planElegido === 1 ? 'is-active' : ''}`}>
                      <input
                        type="radio"
                        name="plan-meses"
                        checked={planElegido === 1}
                        onChange={() => setPlanElegido(1)}
                      />
                      <span>
                        <strong>10 meses</strong>
                        <small>Septiembre a junio (sin julio)</small>
                      </span>
                    </label>
                    <label className={`cp-plan-opcion ${planElegido === 2 ? 'is-active' : ''}`}>
                      <input
                        type="radio"
                        name="plan-meses"
                        checked={planElegido === 2}
                        onChange={() => setPlanElegido(2)}
                      />
                      <span>
                        <strong>11 meses</strong>
                        <small>Septiembre a julio (incluye julio)</small>
                      </span>
                    </label>
                  </fieldset>

                  <button
                    type="button"
                    className="usr-btn usr-btn-primary"
                    disabled={guardando || planElegido === estado.planMeses}
                    onClick={() => void guardar()}
                  >
                    {guardando ? (
                      <>
                        <Loader2 className="usr-spin" size={16} />
                        Guardando…
                      </>
                    ) : (
                      'Guardar plan'
                    )}
                  </button>
                </>
              )}
            </div>
          ) : !cargando && !error ? (
            <p className="servicios-panel-hint">
              Busca un alumno por número de control o nombre para ver y cambiar su plan.
            </p>
          ) : null}
        </div>
      </div>
    </UsuariosPinGate>
  )
}
