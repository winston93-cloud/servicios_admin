'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'
import {
  CICLO_CAMBIO_DESTINO,
  CICLO_CAMBIO_ORIGEN,
  calcularDestinoCambioCiclo,
  etiquetaDestinoCambioCiclo,
} from '@/lib/cambioCicloEscolarAdvance'
import {
  listarAlumnosDestinoCambioCiclo,
  listarAlumnosOrigenCambioCiclo,
  migrarAlumnosCambioCiclo,
  revertirAlumnosCambioCiclo,
  type AlumnoCambioCicloRow,
} from '@/lib/cambioCicloEscolarService'
import { FORMA_INGRESO_OPCIONES } from '@/lib/alumnoFormaIngreso'
import {
  gradoEscolarPorDefecto,
  gradoOpcionesPorNivel,
  etiquetaGradoEscolar,
} from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { NIVELES_ESCOLARES_OPCIONES, etiquetaNivelEscolar } from '@/lib/nivelEscolar'

function etiquetaFormaIngresoLocal(valor: number): string {
  const hit = FORMA_INGRESO_OPCIONES.find((o) => o.valor === valor)
  return hit?.etiqueta ?? String(valor)
}

function TablaAlumnos({
  titulo,
  filas,
  seleccionados,
  onToggle,
  onToggleTodos,
  mostrarRevertir,
  idPrefix,
}: {
  titulo: string
  filas: AlumnoCambioCicloRow[]
  seleccionados: Set<number>
  onToggle: (id: number) => void
  onToggleTodos: () => void
  mostrarRevertir?: boolean
  idPrefix: string
}) {
  return (
    <div className="cambio-ciclo-panel">
      <h2 className="cambio-ciclo-panel-title">{titulo}</h2>
      <p className="cambio-ciclo-panel-count">
        <Users size={16} aria-hidden />
        <strong>{filas.length}</strong> alumno(s)
      </p>
      {filas.length === 0 ? (
        <p className="servicios-panel-hint cambio-ciclo-empty">Sin alumnos en esta lista.</p>
      ) : (
        <div className="asignar-grupos-tabla-wrap cambio-ciclo-tabla-wrap">
          <table className="asignar-grupos-tabla">
            <thead>
              <tr>
                <th className="asignar-grupos-th-check">
                  <input
                    type="checkbox"
                    checked={filas.length > 0 && seleccionados.size === filas.length}
                    onChange={onToggleTodos}
                    aria-label={`Seleccionar todos en ${titulo}`}
                  />
                </th>
                <th>#</th>
                <th>No control</th>
                <th>Nombre</th>
                <th>Ingreso</th>
                <th>Grupo</th>
                {mostrarRevertir && <th>Nota</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr
                  key={f.alumno_id}
                  className={
                    seleccionados.has(f.alumno_id) ? 'asignar-grupos-tr--selected' : undefined
                  }
                >
                  <td className="asignar-grupos-td-check">
                    <input
                      type="checkbox"
                      id={`${idPrefix}-${f.alumno_id}`}
                      checked={seleccionados.has(f.alumno_id)}
                      onChange={() => onToggle(f.alumno_id)}
                      disabled={mostrarRevertir && !f.puedeRevertir}
                      aria-label={`Seleccionar ${f.alumno_nombre}`}
                    />
                  </td>
                  <td className="asignar-grupos-td-num">{i + 1}</td>
                  <td className="asignar-grupos-td-mono">{f.alumno_ref}</td>
                  <td className="asignar-grupos-td-nombre">
                    {f.alumno_app} {f.alumno_apm} {f.alumno_nombre}
                  </td>
                  <td>{etiquetaFormaIngresoLocal(f.alumno_nuevo_ingreso)}</td>
                  <td>{etiquetaGrupoEscolar(f.alumno_grupo)}</td>
                  {mostrarRevertir && (
                    <td className="cambio-ciclo-nota">
                      {f.puedeRevertir ? (
                        <span className="cambio-ciclo-nota--ok">Migrado aquí</span>
                      ) : (
                        <span className="cambio-ciclo-nota--prev">Ya en ciclo {CICLO_CAMBIO_DESTINO}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CambioCicloEscolarModulo() {
  const [nivel, setNivel] = useState(1)
  const [grado, setGrado] = useState(1)
  const [origen, setOrigen] = useState<AlumnoCambioCicloRow[]>([])
  const [destino, setDestino] = useState<AlumnoCambioCicloRow[]>([])
  const [selOrigen, setSelOrigen] = useState<Set<number>>(new Set())
  const [selDestino, setSelDestino] = useState<Set<number>>(new Set())
  const [cargando, setCargando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const opcionesGrado = useMemo(() => gradoOpcionesPorNivel(nivel), [nivel])
  const destinoCalculado = useMemo(
    () => calcularDestinoCambioCiclo(nivel, grado),
    [nivel, grado]
  )

  const etiquetaOrigen = useMemo(
    () =>
      `${etiquetaNivelEscolar(nivel)} · ${etiquetaGradoEscolar(nivel, grado)} · ciclo ${CICLO_CAMBIO_ORIGEN}`,
    [nivel, grado]
  )

  const etiquetaDestino = useMemo(() => {
    const dest = destinoCalculado
    const gradoEtiqueta = etiquetaDestinoCambioCiclo(dest)
    return `${gradoEtiqueta} · ciclo ${CICLO_CAMBIO_DESTINO} · grupo A`
  }, [destinoCalculado])

  useEffect(() => {
    setGrado((g) => gradoEscolarPorDefecto(nivel, g))
  }, [nivel])

  const cargarListas = useCallback(async () => {
    setCargando(true)
    setError(null)
    setMensaje(null)

    const [resOrigen, resDestino] = await Promise.all([
      listarAlumnosOrigenCambioCiclo(nivel, grado),
      listarAlumnosDestinoCambioCiclo(nivel, grado),
    ])

    setCargando(false)

    if (!resOrigen.ok) {
      setError(resOrigen.mensaje)
      setOrigen([])
      setDestino([])
      setSelOrigen(new Set())
      setSelDestino(new Set())
      return
    }
    if (!resDestino.ok) {
      setError(resDestino.mensaje)
      setOrigen(resOrigen.filas)
      setDestino([])
      setSelOrigen(new Set(resOrigen.filas.map((f) => f.alumno_id)))
      setSelDestino(new Set())
      return
    }

    setOrigen(resOrigen.filas)
    setDestino(resDestino.filas)
    setSelOrigen(new Set(resOrigen.filas.map((f) => f.alumno_id)))
    setSelDestino(new Set())
  }, [nivel, grado])

  const toggleOrigen = useCallback((id: number) => {
    setSelOrigen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleDestino = useCallback((id: number) => {
    const fila = destino.find((f) => f.alumno_id === id)
    if (fila && !fila.puedeRevertir) return
    setSelDestino((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [destino])

  const toggleTodosOrigen = useCallback(() => {
    setSelOrigen((prev) => {
      if (prev.size === origen.length) return new Set()
      return new Set(origen.map((f) => f.alumno_id))
    })
  }, [origen])

  const toggleTodosDestino = useCallback(() => {
    const reversibles = destino.filter((f) => f.puedeRevertir)
    setSelDestino((prev) => {
      if (prev.size === reversibles.length && reversibles.length > 0) return new Set()
      return new Set(reversibles.map((f) => f.alumno_id))
    })
  }, [destino])

  const pasarSeleccionados = useCallback(async () => {
    if (selOrigen.size === 0) {
      setError('Selecciona al menos un alumno del ciclo origen.')
      return
    }
    setProcesando(true)
    setError(null)
    setMensaje(null)

    const res = await migrarAlumnosCambioCiclo([...selOrigen], nivel, grado)
    setProcesando(false)

    if (!res.ok) {
      setError(
        res.migrados > 0
          ? `Se migraron ${res.migrados} antes del error: ${res.mensaje}`
          : res.mensaje
      )
      if (res.migrados > 0) await cargarListas()
      return
    }

    setMensaje(
      `${res.migrados} alumno(s) pasados al ciclo ${CICLO_CAMBIO_DESTINO} en ${etiquetaDestino}.`
    )
    await cargarListas()
  }, [selOrigen, nivel, grado, cargarListas, etiquetaDestino])

  const regresarSeleccionados = useCallback(async () => {
    if (selDestino.size === 0) {
      setError('Selecciona alumnos migrados por este módulo para regresarlos.')
      return
    }
    setProcesando(true)
    setError(null)
    setMensaje(null)

    const res = await revertirAlumnosCambioCiclo([...selDestino])
    setProcesando(false)

    if (!res.ok) {
      setError(
        res.revertidos > 0
          ? `Se revirtieron ${res.revertidos} antes del error: ${res.mensaje}`
          : res.mensaje
      )
      if (res.revertidos > 0) await cargarListas()
      return
    }

    setMensaje(`${res.revertidos} alumno(s) regresados al ciclo ${CICLO_CAMBIO_ORIGEN}.`)
    await cargarListas()
  }, [selDestino, cargarListas])

  return (
    <div className="servicios-panel-inner servicios-panel-inner--cambio-ciclo">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Cambio de ciclo escolar</h1>
        <p className="servicios-panel-lead asignar-grupos-lead">
          Migra alumnos activos del ciclo <strong>{CICLO_CAMBIO_ORIGEN} (2025-2026)</strong> al
          ciclo <strong>{CICLO_CAMBIO_DESTINO} (2026-2027)</strong> por nivel y grado. Al pasar,
          avanzan de grado (o de nivel), quedan en <strong>grupo A</strong> y los de nuevo ingreso
          pasan a <strong>reinscrito</strong>. Solo puedes regresar los que migres aquí.
        </p>
      </header>

      <section className="asignar-grupos-filtros" aria-label="Filtros">
        <div className="asignar-grupos-filtros-grid">
          <div className="asignar-grupos-field">
            <label htmlFor="cce-nivel">Nivel (origen ciclo {CICLO_CAMBIO_ORIGEN})</label>
            <select
              id="cce-nivel"
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
            <label htmlFor="cce-grado">Grado (origen)</label>
            <select
              id="cce-grado"
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

          <div className="asignar-grupos-field cambio-ciclo-field-destino">
            <span className="asignar-grupos-field-label">Destino calculado</span>
            <p className="cambio-ciclo-destino-hint">{etiquetaDestino}</p>
          </div>

          <div className="asignar-grupos-field asignar-grupos-field--accion">
            <span className="asignar-grupos-field-label">Acción</span>
            <button
              type="button"
              className="asignar-grupos-btn asignar-grupos-btn--primary"
              onClick={() => void cargarListas()}
              disabled={cargando || procesando}
            >
              {cargando ? (
                <Loader2 size={18} className="asignar-grupos-spin" aria-hidden />
              ) : (
                <RefreshCw size={18} aria-hidden />
              )}
              {cargando ? 'Cargando…' : 'Cargar listas'}
            </button>
          </div>
        </div>
      </section>

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

      {(origen.length > 0 || destino.length > 0) && (
        <div className="cambio-ciclo-acciones-centro">
          <button
            type="button"
            className="asignar-grupos-btn asignar-grupos-btn--primary"
            onClick={() => void pasarSeleccionados()}
            disabled={procesando || selOrigen.size === 0}
            title="Pasar alumnos seleccionados al ciclo destino"
          >
            {procesando ? (
              <Loader2 size={18} className="asignar-grupos-spin" aria-hidden />
            ) : (
              <ArrowRight size={18} aria-hidden />
            )}
            Pasar ({selOrigen.size})
          </button>
          <button
            type="button"
            className="asignar-grupos-btn asignar-grupos-btn--secondary"
            onClick={() => void regresarSeleccionados()}
            disabled={procesando || selDestino.size === 0}
            title="Solo alumnos migrados por este módulo"
          >
            {procesando ? (
              <Loader2 size={18} className="asignar-grupos-spin" aria-hidden />
            ) : (
              <ArrowLeft size={18} aria-hidden />
            )}
            Regresar ({selDestino.size})
          </button>
        </div>
      )}

      <div className="cambio-ciclo-dual-grid">
        <TablaAlumnos
          idPrefix="cce-origen"
          titulo={etiquetaOrigen}
          filas={origen}
          seleccionados={selOrigen}
          onToggle={toggleOrigen}
          onToggleTodos={toggleTodosOrigen}
        />
        <TablaAlumnos
          idPrefix="cce-destino"
          titulo={etiquetaDestino}
          filas={destino}
          seleccionados={selDestino}
          onToggle={toggleDestino}
          onToggleTodos={toggleTodosDestino}
          mostrarRevertir
        />
      </div>

      {!cargando && origen.length === 0 && destino.length === 0 && !error && (
        <div className="servicios-panel-card asignar-grupos-empty">
          <p className="servicios-panel-hint">
            Elige nivel y grado del ciclo {CICLO_CAMBIO_ORIGEN}, luego pulsa{' '}
            <strong>Cargar listas</strong>. Antes de la migración masiva, sincroniza las tablas desde
            phpMyAdmin.
          </p>
        </div>
      )}
    </div>
  )
}
