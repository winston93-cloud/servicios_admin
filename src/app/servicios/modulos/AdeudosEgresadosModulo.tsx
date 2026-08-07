'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  GraduationCap,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import UsuariosPinGate from '../components/UsuariosPinGate'

type EstadoAdeudoEgresado = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  gradoEtiqueta: string
  statusEtiqueta: string
  cicloFicha: number
  cicloValor: number
  cicloEtiqueta: string
  esEgresado: boolean
  activo: boolean
  conRecargos: boolean
  puedeActivar: boolean
  puedeDesactivar: boolean
}

export default function AdeudosEgresadosModulo() {
  const { cicloSeleccionado } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [estado, setEstado] = useState<EstadoAdeudoEgresado | null>(null)
  const [conRecargos, setConRecargos] = useState(true)
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
        `/api/servicios/adeudos-egresados?alumnoId=${alumnoId}&cicloValor=${cicloValor}`,
        { cache: 'no-store' }
      )
      const data = (await res.json().catch(() => ({}))) as EstadoAdeudoEgresado & {
        error?: string
      }
      if (!res.ok) {
        setEstado(null)
        setError(data.error ?? 'No se pudo consultar el acceso de egresado.')
        return
      }
      setEstado(data)
      setConRecargos(data.conRecargos !== false)
    } catch {
      setEstado(null)
      setError('Error de conexión al consultar adeudos de egresado.')
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

  const postAccion = async (accion: 'activar' | 'desactivar' | 'recargos') => {
    if (!estado) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/servicios/adeudos-egresados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          alumnoId: estado.alumnoId,
          cicloValor: cicloSeleccionado,
          conRecargos,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as EstadoAdeudoEgresado & {
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo completar la acción.')
        return
      }
      setEstado(data)
      setConRecargos(data.conRecargos !== false)
      if (accion === 'activar') {
        setMensaje(
          'Acceso activado. El egresado puede entrar al portal y pagar adeudos del ciclo seleccionado. Su estatus y grado no cambian.'
        )
      }
      if (accion === 'desactivar') {
        setMensaje('Acceso desactivado. El alumno vuelve a quedar bloqueado en el portal.')
      }
      if (accion === 'recargos') {
        setMensaje(
          data.conRecargos
            ? 'Colegiaturas pendientes se cobrarán con recargos.'
            : 'Colegiaturas pendientes se cobrarán sin recargos.'
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
      eyebrow="Servicios · Adeudos egresados"
      titulo="Acceso a adeudos de egresados"
      lead="Ingresa el PIN para activar el portal a egresados con adeudos del ciclo que terminaron."
    >
      <div className="servicios-panel-inner pa-modulo">
        <header className="servicios-panel-header">
          <h1 className="servicios-panel-title">
            <GraduationCap size={22} aria-hidden /> Adeudos egresados
          </h1>
          <p className="servicios-panel-lead">
            Activa el acceso al portal para egresados (baja general) que aún deban conceptos del
            ciclo en que terminaron. No cambia su estatus ni grado: solo pueden liquidar adeudos
            con los costos de ese ciclo.
          </p>
        </header>

        <div className="servicios-panel-card pa-card">
          <div className="pa-toolbar">
            <div className="pa-autocomplete">
              <AlumnoAutocomplete
                etiqueta="Nombre / No. control (cualquier ciclo)"
                alumnoSeleccionado={alumnoSeleccionado}
                onSeleccionar={setAlumnoSeleccionado}
                autoFocus={!resolviendoCiclo}
                cualquierCiclo
              />
            </div>
            <button
              type="button"
              className="usr-btn"
              disabled={!alumnoSeleccionado || cargando || guardando}
              onClick={() =>
                alumnoSeleccionado &&
                void cargar(alumnoSeleccionado.alumno_id, cicloSeleccionado)
              }
            >
              {cargando ? <Loader2 className="usr-spin" size={16} /> : <RefreshCw size={16} />}
              Actualizar
            </button>
          </div>

          <p className="pa-ciclo-hint">
            Ciclo de adeudos:{' '}
            <strong>{etiquetaCicloEscolar(cicloSeleccionado)}</strong>
            {' · '}
            el alumno pagará conceptos pendientes de este ciclo.
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
              </div>

              <div className="pa-montos">
                <div>
                  <span className="pa-monto-label">Grado / estatus</span>
                  <strong>
                    {estado.gradoEtiqueta} · {estado.statusEtiqueta}
                  </strong>
                </div>
                <div>
                  <span className="pa-monto-label">Ciclo en ficha</span>
                  <strong>
                    {etiquetaCicloEscolar(estado.cicloFicha) || estado.cicloFicha}
                  </strong>
                </div>
                <div>
                  <span className="pa-monto-label">Ciclo de adeudos</span>
                  <strong>{estado.cicloEtiqueta}</strong>
                </div>
              </div>

              {!estado.esEgresado ? (
                <div className="pa-bloqueado" role="status">
                  <ShieldAlert size={18} aria-hidden />
                  <div>
                    <strong>No parece egresado / baja general</strong>
                    <p>
                      Puedes activarlo igual para pruebas. El acceso no modifica estatus ni grado.
                    </p>
                  </div>
                </div>
              ) : null}

              {estado.activo ? (
                <div className="pa-alert pa-alert--info" role="status">
                  Acceso activo: puede iniciar sesión en el portal y pagar adeudos del ciclo{' '}
                  <strong>{estado.cicloEtiqueta}</strong>. Sigue siendo egresado / baja general.
                </div>
              ) : (
                <div className="pa-alert pa-alert--info" role="status">
                  Sin acceso. Al activar, el alumno entra al portal solo para liquidar pendientes
                  del ciclo seleccionado.
                </div>
              )}

              <label className="pa-check-recargos">
                <input
                  type="checkbox"
                  checked={conRecargos}
                  disabled={guardando}
                  onChange={(e) => setConRecargos(e.target.checked)}
                />
                <span>
                  Cobrar colegiaturas pendientes <strong>con recargos</strong>
                  {!conRecargos ? ' (ahora: sin recargos)' : ''}
                </span>
              </label>

              <div className="pa-acciones">
                <button
                  type="button"
                  className="usr-btn usr-btn-primary"
                  disabled={guardando || !estado.puedeActivar}
                  onClick={() => void postAccion('activar')}
                >
                  {guardando ? <Loader2 className="usr-spin" size={16} /> : <Wallet size={16} />}
                  Activar acceso
                </button>

                <button
                  type="button"
                  className="usr-btn"
                  disabled={guardando || !estado.puedeDesactivar}
                  onClick={() => void postAccion('desactivar')}
                >
                  Desactivar
                </button>

                {estado.activo ? (
                  <button
                    type="button"
                    className="usr-btn"
                    disabled={guardando || conRecargos === estado.conRecargos}
                    onClick={() => void postAccion('recargos')}
                  >
                    Guardar recargos
                  </button>
                ) : null}
              </div>

              <p className="servicios-panel-hint">
                PIN del módulo: el mismo de Usuarios / Pago Anual. El egresado usa su clave de
                portal (o la maestra) para entrar; no se reactiva su ficha escolar.
              </p>
            </div>
          ) : !cargando && !error ? (
            <p className="servicios-panel-hint">
              Busca un alumno (cualquier ciclo) para activar o desactivar el acceso a adeudos.
            </p>
          ) : null}
        </div>
      </div>
    </UsuariosPinGate>
  )
}
