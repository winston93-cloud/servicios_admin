'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, CalendarDays, Loader2, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { clasePlanMeses } from '@/lib/alumnoPlanMeses'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import UsuariosPinGate from '../components/UsuariosPinGate'

type MesFila = {
  conceptoNo: string
  etiqueta: string
  monto: number
  pagado: boolean
}

type EstadoPaquete = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  cicloValor: number
  planMeses: 1 | 2
  planEtiqueta: string
  meses: MesFila[]
  montoTotal: number
  conceptosAsignados: string[]
  activo: boolean
  pagado: boolean
  puedeActivar: boolean
  puedeRevertir: boolean
  bloqueadoPorAnual: boolean
}

function fmt(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

export default function PagosColegiaturasPaqueteModulo() {
  const { cicloSeleccionado } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [estado, setEstado] = useState<EstadoPaquete | null>(null)
  const [elegidos, setElegidos] = useState<string[]>([])
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
        `/api/servicios/pagos-colegiaturas-paquete?alumnoId=${alumnoId}&cicloValor=${cicloValor}`,
        { cache: 'no-store' }
      )
      const data = (await res.json().catch(() => ({}))) as EstadoPaquete & { error?: string }
      if (!res.ok) {
        setEstado(null)
        setError(data.error ?? 'No se pudo consultar las colegiaturas.')
        return
      }
      setEstado(data)
      setElegidos(data.conceptosAsignados?.length ? data.conceptosAsignados : [])
    } catch {
      setEstado(null)
      setError('Error de conexión al consultar el paquete.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!alumnoSeleccionado?.alumno_id) {
      setEstado(null)
      setElegidos([])
      return
    }
    void cargar(alumnoSeleccionado.alumno_id, cicloSeleccionado)
  }, [alumnoSeleccionado?.alumno_id, cicloSeleccionado, cargar])

  const sumaVista = useMemo(() => {
    if (!estado) return 0
    if (estado.activo || estado.pagado) return estado.montoTotal
    return estado.meses
      .filter((m) => elegidos.includes(m.conceptoNo))
      .reduce((acc, m) => acc + m.monto, 0)
  }, [estado, elegidos])

  const postAccion = async (
    accion: 'activar' | 'revertir' | 'pago-efectivo'
  ) => {
    if (!estado) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/servicios/pagos-colegiaturas-paquete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          alumnoId: estado.alumnoId,
          cicloValor: cicloSeleccionado,
          conceptos: elegidos,
          formaPago: 'Efectivo',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as EstadoPaquete & {
        error?: string
        referencia?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo completar la acción.')
        return
      }
      setEstado(data)
      setElegidos(data.conceptosAsignados?.length ? data.conceptosAsignados : elegidos)
      if (accion === 'activar') {
        setMensaje('Paquete asignado. El alumno lo verá en el portal como un solo concepto.')
      }
      if (accion === 'revertir') {
        setMensaje('Se revirtió el paquete. Las colegiaturas volvieron a deberse por mes.')
      }
      if (accion === 'pago-efectivo') {
        setMensaje(
          `Pago en efectivo registrado${data.referencia ? ` (${data.referencia})` : ''}. Meses marcados como pagados.`
        )
      }
    } catch {
      setError('Error de conexión.')
    } finally {
      setGuardando(false)
    }
  }

  const toggleMes = (conceptoNo: string, disabled: boolean) => {
    if (disabled) return
    setElegidos((prev) =>
      prev.includes(conceptoNo) ? prev.filter((c) => c !== conceptoNo) : [...prev, conceptoNo]
    )
  }

  return (
    <UsuariosPinGate
      eyebrow="Servicios · Pagos de Colegiaturas"
      titulo="Acceso a pagos de colegiaturas"
      lead="Ingresa el PIN para agrupar colegiaturas pendientes en un solo cobro."
    >
      <div className="servicios-panel-inner pa-modulo">
        <header className="servicios-panel-header">
          <h1 className="servicios-panel-title">
            <CalendarDays size={22} aria-hidden /> Pagos de Colegiaturas
          </h1>
          <p className="servicios-panel-lead">
            Ciclo actual. Elige solo las colegiaturas que el alumno debe; la suma se cobra como un
            solo concepto (31), igual que el pago anual, sin descuento. Al pagar, se marcan
            únicamente esos meses.
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

              {estado.bloqueadoPorAnual ? (
                <p className="pa-alert pa-alert--error" role="status">
                  Tiene pago anual activo. Desactívalo antes de armar este paquete.
                </p>
              ) : null}

              <fieldset className="pcq-meses" disabled={estado.activo || estado.pagado || guardando}>
                <legend className="pcq-meses-legend">Colegiaturas que debe</legend>
                {estado.meses.filter((m) => !m.pagado || estado.conceptosAsignados.includes(m.conceptoNo)).length ===
                0 ? (
                  <p className="servicios-panel-hint">No hay colegiaturas pendientes en este ciclo.</p>
                ) : (
                  estado.meses.map((m) => {
                    if (m.pagado && !estado.conceptosAsignados.includes(m.conceptoNo)) return null
                    const checked = elegidos.includes(m.conceptoNo)
                    return (
                      <label key={m.conceptoNo} className={`pcq-mes${m.pagado ? ' pcq-mes--pagado' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={m.pagado || estado.activo || estado.pagado}
                          onChange={() => toggleMes(m.conceptoNo, m.pagado || estado.activo || estado.pagado)}
                        />
                        <span className="pcq-mes-nombre">{m.etiqueta}</span>
                        <span className="pcq-mes-monto">{fmt(m.monto)}</span>
                      </label>
                    )
                  })
                )}
              </fieldset>

              <div className="pa-montos">
                <div>
                  <span className="pa-monto-label">Suma seleccionada</span>
                  <strong className="pa-monto-total">{fmt(sumaVista)}</strong>
                </div>
                <div>
                  <span className="pa-monto-label">Concepto portal / factura</span>
                  <strong>Pago Colegiaturas</strong>
                </div>
              </div>

              {estado.activo && !estado.pagado ? (
                <p className="pa-alert pa-alert--info" role="status">
                  Activo en portal: un solo cargo por {fmt(estado.montoTotal)}. Aún se puede revertir.
                </p>
              ) : null}
              {estado.pagado ? (
                <p className="pa-alert pa-alert--ok" role="status">
                  Paquete cobrado. Los meses elegidos quedaron marcados como pagados.
                </p>
              ) : null}

              <div className="pa-acciones">
                <button
                  type="button"
                  className="usr-btn usr-btn-primary"
                  disabled={guardando || !estado.puedeActivar || elegidos.length === 0}
                  onClick={() => void postAccion('activar')}
                >
                  {guardando ? <Loader2 className="usr-spin" size={16} /> : <Sparkles size={16} />}
                  Asignar al portal
                </button>
                <button
                  type="button"
                  className="usr-btn"
                  disabled={guardando || !estado.puedeRevertir}
                  onClick={() => void postAccion('revertir')}
                >
                  <RotateCcw size={16} />
                  Revertir
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
            </div>
          ) : !cargando && !error ? (
            <p className="servicios-panel-hint">Busca un alumno para armar el paquete de colegiaturas.</p>
          ) : null}
        </div>
      </div>
    </UsuariosPinGate>
  )
}
