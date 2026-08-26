'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  Save,
  Users,
} from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import {
  guardarAsignacionesAlumnos,
  listarAlumnosParaAsignarGrupos,
  type AlumnoAsignacionGrupoRow,
  type ActualizacionAsignacionAlumno,
} from '@/lib/asignarGruposService'
import {
  gradoEscolarPorDefecto,
  gradoOpcionesPorNivel,
} from '@/lib/gradoEscolar'
import {
  GRUPOS_ASIGNACION_OPCIONES,
  GRUPOS_ESCOLARES_OPCIONES,
  etiquetaGrupoEscolar,
} from '@/lib/grupoEscolar'
import { NIVELES_ESCOLARES_OPCIONES } from '@/lib/nivelEscolar'
import { ESTATUS_ALUMNO_OPCIONES, claseTagEstatusAlumno } from '@/lib/alumnoStatus'

interface FilaEditable {
  id: number
  ref: string
  app: string
  apm: string
  nombre: string
  grado: number
  grupo: number
  status: number
  gradoOrig: number
  grupoOrig: number
  statusOrig: number
}

function filaDesdeAlumno(a: AlumnoAsignacionGrupoRow): FilaEditable {
  return {
    id: a.alumno_id,
    ref: a.alumno_ref,
    app: a.alumno_app,
    apm: a.alumno_apm,
    nombre: a.alumno_nombre,
    grado: a.alumno_grado,
    grupo: a.alumno_grupo,
    status: a.alumno_status,
    gradoOrig: a.alumno_grado,
    grupoOrig: a.alumno_grupo,
    statusOrig: a.alumno_status,
  }
}

function filaTieneCambios(f: FilaEditable): boolean {
  return f.grado !== f.gradoOrig || f.grupo !== f.grupoOrig || f.status !== f.statusOrig
}

function cambiosDeFila(f: FilaEditable): ActualizacionAsignacionAlumno | null {
  if (!filaTieneCambios(f)) return null
  const c: ActualizacionAsignacionAlumno = { alumnoId: f.id }
  if (f.grado !== f.gradoOrig) c.grado = f.grado
  if (f.grupo !== f.grupoOrig) c.grupo = f.grupo
  if (f.status !== f.statusOrig) c.status = f.status
  return c
}

export default function AsignarGruposModulo() {
  const { cicloSeleccionado, etiquetaCicloActualSistema } = useCicloEscolar()

  const [nivel, setNivel] = useState(3)
  const [grado, setGrado] = useState(1)
  const [grupoFiltro, setGrupoFiltro] = useState(1)
  const [refillGrupo, setRefillGrupo] = useState(0)

  const [filas, setFilas] = useState<FilaEditable[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [grupoMasivo, setGrupoMasivo] = useState(1)

  const opcionesGrado = useMemo(() => gradoOpcionesPorNivel(nivel), [nivel])

  useEffect(() => {
    setGrado((g) => gradoEscolarPorDefecto(nivel, g))
  }, [nivel])

  const cambiosPendientes = useMemo(
    () => filas.filter(filaTieneCambios),
    [filas]
  )

  const cargarLista = useCallback(async () => {
    setError(null)
    setMensaje(null)
    setCargando(true)
    setSeleccionados(new Set())

    const refill = refillGrupo > 0 ? refillGrupo : undefined
    if (refill != null && refill > 0) {
      const ok = window.confirm(
        `Se asignará el grupo ${etiquetaGrupoEscolar(refill)} a todos los alumnos activos de este nivel, grado y ciclo. ¿Continuar?`
      )
      if (!ok) {
        setCargando(false)
        return
      }
    }

    const res = await listarAlumnosParaAsignarGrupos({
      nivel,
      grado,
      grupo: grupoFiltro,
      cicloEscolar: cicloSeleccionado,
      refillGrupo: refill,
    })

    setCargando(false)

    if (!res.ok) {
      setError(res.mensaje)
      setFilas([])
      return
    }

    setFilas(res.filas.map(filaDesdeAlumno))
    if (refill != null && refill > 0) {
      setMensaje(`Refill aplicado. Se listan alumnos con grupo ${etiquetaGrupoEscolar(grupoFiltro)}.`)
      setRefillGrupo(0)
    }
  }, [nivel, grado, grupoFiltro, cicloSeleccionado, refillGrupo])

  const actualizarFila = useCallback((id: number, patch: Partial<FilaEditable>) => {
    setFilas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    )
  }, [])

  const toggleSeleccion = useCallback((id: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleTodos = useCallback(() => {
    setSeleccionados((prev) => {
      if (prev.size === filas.length) return new Set()
      return new Set(filas.map((f) => f.id))
    })
  }, [filas])

  const aplicarGrupoMasivo = useCallback(() => {
    if (seleccionados.size === 0) {
      setError('Selecciona al menos un alumno para aplicar el grupo.')
      return
    }
    setError(null)
    setFilas((prev) =>
      prev.map((f) =>
        seleccionados.has(f.id) ? { ...f, grupo: grupoMasivo } : f
      )
    )
    setMensaje(
      `Grupo ${etiquetaGrupoEscolar(grupoMasivo)} aplicado a ${seleccionados.size} alumno(s). Guarda los cambios para persistir.`
    )
  }, [seleccionados, grupoMasivo])

  const descartarCambios = useCallback(() => {
    setFilas((prev) =>
      prev.map((f) => ({
        ...f,
        grado: f.gradoOrig,
        grupo: f.grupoOrig,
        status: f.statusOrig,
      }))
    )
    setMensaje(null)
    setError(null)
  }, [])

  const guardarCambios = useCallback(async () => {
    const cambios = filas
      .map(cambiosDeFila)
      .filter((c): c is ActualizacionAsignacionAlumno => c != null)

    if (cambios.length === 0) {
      setMensaje('No hay cambios por guardar.')
      return
    }

    setGuardando(true)
    setError(null)
    setMensaje(null)

    const res = await guardarAsignacionesAlumnos(cambios)
    setGuardando(false)

    if (!res.ok) {
      setError(
        res.guardados > 0
          ? `Se guardaron ${res.guardados} de ${cambios.length}. Error: ${res.mensaje}`
          : res.mensaje
      )
      if (res.guardados > 0) await cargarLista()
      return
    }

    setMensaje(`${res.guardados} alumno(s) actualizado(s) correctamente.`)
    await cargarLista()
  }, [filas, cargarLista])

  return (
    <div className="servicios-panel-inner servicios-panel-inner--asignar-grupos">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Asignar grupos</h1>
        <p className="servicios-panel-lead asignar-grupos-lead">
          Consulta alumnos <strong>activos</strong> por nivel, grado y grupo del ciclo{' '}
          <strong>{etiquetaCicloActualSistema}</strong>. Edita en bloque y guarda cuando
          termines.
        </p>
      </header>

      <section className="asignar-grupos-filtros" aria-label="Filtros de búsqueda">
        <div className="asignar-grupos-filtros-grid">
          <div className="asignar-grupos-field">
            <label htmlFor="ag-nivel">Nivel</label>
            <select
              id="ag-nivel"
              value={nivel}
              onChange={(e) => setNivel(Number(e.target.value))}
            >
              {NIVELES_ESCOLARES_OPCIONES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="asignar-grupos-field">
            <label htmlFor="ag-grado">Grado</label>
            <select
              id="ag-grado"
              value={grado}
              onChange={(e) => setGrado(Number(e.target.value))}
            >
              {opcionesGrado.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="asignar-grupos-field">
            <label htmlFor="ag-grupo">Grupo a listar</label>
            <select
              id="ag-grupo"
              value={grupoFiltro}
              onChange={(e) => setGrupoFiltro(Number(e.target.value))}
            >
              {GRUPOS_ASIGNACION_OPCIONES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="asignar-grupos-field">
            <label htmlFor="ag-refill">Refill (opcional)</label>
            <select
              id="ag-refill"
              value={refillGrupo}
              onChange={(e) => setRefillGrupo(Number(e.target.value))}
              title="Asigna un grupo a todo el grado antes de cargar la lista"
            >
              <option value={0}>Ignorar</option>
              {GRUPOS_ESCOLARES_OPCIONES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="asignar-grupos-field asignar-grupos-field--accion">
            <span className="asignar-grupos-field-label">Acción</span>
            <button
              type="button"
              className="asignar-grupos-btn asignar-grupos-btn--primary"
              onClick={() => void cargarLista()}
              disabled={cargando}
            >
              {cargando ? (
                <Loader2 size={18} className="asignar-grupos-spin" aria-hidden />
              ) : (
                <RefreshCw size={18} aria-hidden />
              )}
              {cargando ? 'Cargando…' : 'Cargar lista'}
            </button>
          </div>
        </div>
      </section>

      {filas.length > 0 && (
        <section className="asignar-grupos-toolbar" aria-label="Acciones masivas">
          <div className="asignar-grupos-stats">
            <Users size={18} aria-hidden />
            <span>
              <strong>{filas.length}</strong> alumno(s)
              {cambiosPendientes.length > 0 && (
                <>
                  {' · '}
                  <span className="asignar-grupos-stats--pendiente">
                    {cambiosPendientes.length} con cambios sin guardar
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="asignar-grupos-masivo">
            <label htmlFor="ag-grupo-masivo" className="asignar-grupos-masivo-label">
              Asignar grupo a seleccionados
            </label>
            <select
              id="ag-grupo-masivo"
              value={grupoMasivo}
              onChange={(e) => setGrupoMasivo(Number(e.target.value))}
              className="asignar-grupos-masivo-select"
            >
              {GRUPOS_ASIGNACION_OPCIONES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="asignar-grupos-btn asignar-grupos-btn--secondary"
              onClick={aplicarGrupoMasivo}
              disabled={seleccionados.size === 0}
            >
              Aplicar ({seleccionados.size})
            </button>
          </div>

          <div className="asignar-grupos-toolbar-acciones">
            {cambiosPendientes.length > 0 && (
              <button
                type="button"
                className="asignar-grupos-btn asignar-grupos-btn--ghost"
                onClick={descartarCambios}
                disabled={guardando}
              >
                Descartar
              </button>
            )}
            <button
              type="button"
              className="asignar-grupos-btn asignar-grupos-btn--primary"
              onClick={() => void guardarCambios()}
              disabled={guardando || cambiosPendientes.length === 0}
            >
              {guardando ? (
                <Loader2 size={18} className="asignar-grupos-spin" aria-hidden />
              ) : (
                <Save size={18} aria-hidden />
              )}
              Guardar cambios
              {cambiosPendientes.length > 0 ? ` (${cambiosPendientes.length})` : ''}
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="asignar-grupos-alerta asignar-grupos-alerta--error" role="alert">
          <AlertTriangle size={18} aria-hidden />
          {error}
        </div>
      )}

      {mensaje && !error && (
        <div className="asignar-grupos-alerta asignar-grupos-alerta--ok" role="status">
          <Check size={18} aria-hidden />
          {mensaje}
        </div>
      )}

      {!cargando && filas.length === 0 && !error && (
        <div className="servicios-panel-card asignar-grupos-empty">
          <p className="servicios-panel-hint">
            Elige nivel, grado y grupo, luego pulsa <strong>Cargar lista</strong> para ver
            los alumnos del ciclo consultado en la barra superior.
          </p>
        </div>
      )}

      {filas.length > 0 && (
        <div className="asignar-grupos-tabla-wrap">
          <table className="asignar-grupos-tabla">
            <thead>
              <tr>
                <th className="asignar-grupos-th-check">
                  <input
                    type="checkbox"
                    checked={filas.length > 0 && seleccionados.size === filas.length}
                    onChange={toggleTodos}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th>#</th>
                <th>ID</th>
                <th>No control</th>
                <th>Apellido paterno</th>
                <th>Apellido materno</th>
                <th>Nombre</th>
                <th>Grado</th>
                <th>Grupo</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => {
                const dirty = filaTieneCambios(f)
                const opcionesGradoFila = gradoOpcionesPorNivel(nivel)
                return (
                  <tr
                    key={f.id}
                    className={
                      dirty
                        ? 'asignar-grupos-tr--dirty'
                        : seleccionados.has(f.id)
                          ? 'asignar-grupos-tr--selected'
                          : undefined
                    }
                  >
                    <td className="asignar-grupos-td-check">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(f.id)}
                        onChange={() => toggleSeleccion(f.id)}
                        aria-label={`Seleccionar ${f.nombre}`}
                      />
                    </td>
                    <td className="asignar-grupos-td-num">{i + 1}</td>
                    <td className="asignar-grupos-td-mono">{f.id}</td>
                    <td className="asignar-grupos-td-mono">{f.ref}</td>
                    <td>{f.app}</td>
                    <td>{f.apm}</td>
                    <td className="asignar-grupos-td-nombre">{f.nombre}</td>
                    <td>
                      <select
                        className="asignar-grupos-select"
                        value={f.grado}
                        onChange={(e) =>
                          actualizarFila(f.id, { grado: Number(e.target.value) })
                        }
                        aria-label={`Grado de ${f.nombre}`}
                      >
                        {opcionesGradoFila.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.valor}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="asignar-grupos-select asignar-grupos-select--grupo"
                        value={f.grupo}
                        onChange={(e) =>
                          actualizarFila(f.id, { grupo: Number(e.target.value) })
                        }
                        aria-label={`Grupo de ${f.nombre}`}
                      >
                        {GRUPOS_ASIGNACION_OPCIONES.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className={`asignar-grupos-select asignar-grupos-select--status ${claseTagEstatusAlumno(f.status)}`}
                        value={f.status}
                        onChange={(e) =>
                          actualizarFila(f.id, { status: Number(e.target.value) })
                        }
                        aria-label={`Estatus de ${f.nombre}`}
                      >
                        {ESTATUS_ALUMNO_OPCIONES.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
