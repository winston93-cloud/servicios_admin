'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { useAuth } from '@/contexts/AuthContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { clasePlanMeses } from '@/lib/alumnoPlanMeses'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import UsuariosPinGate from '../components/UsuariosPinGate'

type VistaPrevia = {
  conceptoNo: string
  etiqueta: string
  importeBase: number
  cargoExtra: number
  importeTotal: number
}

type EstadoCargoExtra = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  cicloValor: number
  planMeses: 1 | 2
  planEtiqueta: string
  activo: boolean
  monto: number
  activadoEn: string | null
  desactivadoEn: string | null
  desactivadoMotivo: string | null
  activadoPor: string | null
  conceptosAfectados: string[]
  incrementoMensual: number
  puedeActivar: boolean
  puedeDesactivar: boolean
  vistaPrevia: VistaPrevia[]
}

function fmt(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function CargoExtraModulo() {
  const { user } = useAuth()
  const { cicloSeleccionado } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [estado, setEstado] = useState<EstadoCargoExtra | null>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [motivoDesactivar, setMotivoDesactivar] = useState('')

  const cargar = useCallback(async (alumnoId: number, cicloValor: number) => {
    setCargando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch(
        `/api/servicios/cargo-extra?alumnoId=${alumnoId}&cicloValor=${cicloValor}`,
        { cache: 'no-store' }
      )
      const data = (await res.json().catch(() => ({}))) as EstadoCargoExtra & { error?: string }
      if (!res.ok) {
        setEstado(null)
        setError(data.error ?? 'No se pudo consultar cargo extra.')
        return
      }
      setEstado(data)
    } catch {
      setEstado(null)
      setError('Error de conexión al consultar cargo extra.')
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

  const postAccion = async (accion: 'activar' | 'desactivar') => {
    if (!estado) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/servicios/cargo-extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          alumnoId: estado.alumnoId,
          cicloValor: cicloSeleccionado,
          motivo: accion === 'desactivar' ? motivoDesactivar : undefined,
          activadoPor: user?.usuario_username ?? null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as EstadoCargoExtra & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo completar la acción.')
        return
      }
      setEstado(data)
      if (accion === 'activar') {
        setMensaje(
          `Cargo extra activado. Se suman ${fmt(data.monto)} mensuales en cada colegiatura del portal (sin importar beca, recargo o prórroga).`
        )
      } else {
        setMotivoDesactivar('')
        setMensaje('Cargo extra desactivado. Las colegiaturas vuelven al monto normal.')
      }
    } catch {
      setError('Error de conexión.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <UsuariosPinGate
      eyebrow="Servicios · Cargo Extra"
      titulo="Acceso a cargo extra"
      lead="Ingresa el PIN para activar o desactivar el cargo extra de horario extendido."
    >
      <div className="servicios-panel-inner ce-modulo">
        <header className="servicios-panel-header">
          <h1 className="servicios-panel-title">
            <Clock size={22} aria-hidden /> Cargo Extra
          </h1>
          <p className="servicios-panel-lead">
            Registra el cargo extra de horario extendido ($300/mes por defecto). Se suma en cada
            colegiatura mensual del portal, independientemente de beca, recargo o prórroga, hasta
            que se desactive.
          </p>
        </header>

        <div className="servicios-panel-card ce-card">
          <div className="ce-toolbar">
            <div className="ce-autocomplete">
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

          <p className="ce-ciclo-hint">
            Ciclo de trabajo: <strong>{etiquetaCicloEscolar(cicloSeleccionado)}</strong>
          </p>

          {error ? (
            <p className="ce-alert ce-alert--error" role="alert">
              {error}
            </p>
          ) : null}
          {mensaje ? (
            <p className="ce-alert ce-alert--ok" role="status">
              {mensaje}
            </p>
          ) : null}

          {cargando && !estado ? (
            <div className="ce-loading" role="status">
              <Loader2 className="usr-spin" size={20} />
              Consultando…
            </div>
          ) : null}

          {estado ? (
            <div className="ce-resultado">
              <div className="ce-alumno">
                <span className="ce-alumno-ref">{estado.alumnoRef}</span>
                <span className="ce-alumno-nombre">{estado.nombre}</span>
                <span className={`pc-plan-badge ${clasePlanMeses(estado.planMeses)}`}>
                  {estado.planEtiqueta}
                </span>
                <span
                  className={`ce-estado-badge ${estado.activo ? 'is-activo' : 'is-inactivo'}`}
                >
                  {estado.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="ce-resumen">
                <div>
                  <span className="ce-resumen-label">Cargo mensual</span>
                  <strong>{fmt(estado.monto)}</strong>
                </div>
                <div>
                  <span className="ce-resumen-label">Conceptos afectados</span>
                  <strong>{estado.conceptosAfectados.length}</strong>
                </div>
                <div>
                  <span className="ce-resumen-label">Activado</span>
                  <strong>{fmtFecha(estado.activadoEn)}</strong>
                </div>
              </div>

              {estado.activo ? (
                <div className="ce-alert ce-alert--info" role="status">
                  <ShieldCheck size={16} aria-hidden />
                  El papá verá el incremento en cada colegiatura pendiente del portal. Beca,
                  prórroga y recargo no reducen estos {fmt(estado.monto)}.
                </div>
              ) : (
                <div className="ce-alert ce-alert--info" role="status">
                  Sin cargo extra. Al activar, se suman {fmt(estado.monto)} a cada mes del plan.
                </div>
              )}

              {!estado.activo && estado.desactivadoEn ? (
                <p className="ce-meta">
                  Última desactivación: {fmtFecha(estado.desactivadoEn)}
                  {estado.desactivadoMotivo ? ` · ${estado.desactivadoMotivo}` : ''}
                </p>
              ) : null}

              <div className="ce-tabla-wrap">
                <table className="ce-tabla">
                  <caption className="ce-tabla-caption">
                    Vista previa por colegiatura (beca/prórroga ya aplicadas + cargo extra)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Concepto</th>
                      <th scope="col">Base</th>
                      <th scope="col">+ Cargo extra</th>
                      <th scope="col">Total portal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estado.vistaPrevia.map((fila) => (
                      <tr key={fila.conceptoNo}>
                        <td>
                          <span className="ce-concepto-no">{fila.conceptoNo}</span>
                          {fila.etiqueta}
                        </td>
                        <td>{fmt(fila.importeBase)}</td>
                        <td className="ce-extra-col">
                          {estado.activo ? fmt(fila.cargoExtra) : `+${fmt(fila.cargoExtra)}`}
                        </td>
                        <td>
                          <strong>{fmt(fila.importeTotal)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {estado.puedeDesactivar ? (
                <label className="ce-motivo">
                  <span>Motivo de desactivación (opcional)</span>
                  <input
                    type="text"
                    value={motivoDesactivar}
                    onChange={(e) => setMotivoDesactivar(e.target.value)}
                    placeholder="Ej. ya no usa horario extendido"
                    maxLength={200}
                  />
                </label>
              ) : null}

              <div className="ce-acciones">
                <button
                  type="button"
                  className="usr-btn usr-btn-primary"
                  disabled={guardando || !estado.puedeActivar}
                  onClick={() => void postAccion('activar')}
                >
                  {guardando ? <Loader2 className="usr-spin" size={16} /> : <ShieldCheck size={16} />}
                  Activar cargo extra
                </button>

                <button
                  type="button"
                  className="usr-btn"
                  disabled={guardando || !estado.puedeDesactivar}
                  onClick={() => void postAccion('desactivar')}
                >
                  {guardando ? (
                    <Loader2 className="usr-spin" size={16} />
                  ) : (
                    <ShieldOff size={16} />
                  )}
                  Desactivar
                </button>
              </div>

              <p className="servicios-panel-hint">
                Meses: {estado.conceptosAfectados.join(', ')}. No aplica a cuota de inicio (00),
                material (16), pago anual (30) ni paquete (31).
              </p>
            </div>
          ) : !cargando && !error ? (
            <p className="servicios-panel-hint">
              Busca un alumno para activar o desactivar su cargo extra de horario extendido.
            </p>
          ) : null}
        </div>
      </div>
    </UsuariosPinGate>
  )
}
