'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Save, Star } from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import {
  BECA_ESTATUS_ACTIVA,
  BECA_ESTATUS_OPCIONES,
  claseBecaEstatus,
  etiquetaBecaEstatus,
} from '@/lib/becaEstatus'
import {
  guardarBecaAlumno,
  listarConceptosBeca,
  obtenerBecaPorAlumnoId,
  type AlumnoBecaRegistro,
  type ConceptoBeca,
} from '@/lib/alumnoBecaService'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'

interface SnapshotBeca {
  becaId: number
  porcentaje: number
  estatus: number
}

export default function BecasModulo() {
  const { cicloSeleccionado, opcionesSelector } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const etiquetaCiclo =
    opcionesSelector.find((o) => o.valor === cicloSeleccionado)?.etiqueta ?? '—'

  const [conceptos, setConceptos] = useState<ConceptoBeca[]>([])
  const [cargandoBeca, setCargandoBeca] = useState(false)
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [registroBeca, setRegistroBeca] = useState<AlumnoBecaRegistro | null>(null)

  const [becaId, setBecaId] = useState(0)
  const [porcentaje, setPorcentaje] = useState(0)
  const [estatus, setEstatus] = useState(BECA_ESTATUS_ACTIVA)

  const [snapshotGuardado, setSnapshotGuardado] = useState<SnapshotBeca | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoReciente, setGuardadoReciente] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState(false)

  const snapshotActual = useMemo<SnapshotBeca>(
    () => ({ becaId, porcentaje, estatus }),
    [becaId, porcentaje, estatus]
  )

  const modificado =
    snapshotGuardado != null &&
    (snapshotGuardado.becaId !== snapshotActual.becaId ||
      snapshotGuardado.porcentaje !== snapshotActual.porcentaje ||
      snapshotGuardado.estatus !== snapshotActual.estatus)

  useEffect(() => {
    listarConceptosBeca().then(setConceptos)
  }, [])

  const aplicarRegistro = useCallback(
    (reg: AlumnoBecaRegistro | null, conceptosLista: ConceptoBeca[]) => {
      if (!reg) {
        const primero = conceptosLista[0]?.beca_id ?? 0
        setRegistroBeca(null)
        setBecaId(primero)
        setPorcentaje(0)
        setEstatus(BECA_ESTATUS_ACTIVA)
        const snap = { becaId: primero, porcentaje: 0, estatus: BECA_ESTATUS_ACTIVA }
        setSnapshotGuardado(snap)
        return
      }
      setRegistroBeca(reg)
      setBecaId(reg.beca_id)
      setPorcentaje(reg.beca_porcentaje)
      setEstatus(reg.beca_estatus)
      setSnapshotGuardado({
        becaId: reg.beca_id,
        porcentaje: reg.beca_porcentaje,
        estatus: reg.beca_estatus,
      })
    },
    []
  )

  useEffect(() => {
    if (!alumnoSeleccionado) {
      setAlumnoId(null)
      setRegistroBeca(null)
      setSnapshotGuardado(null)
      setMensaje(null)
      setErrorGuardar(false)
      return
    }

    let activo = true
    setCargandoBeca(true)
    setMensaje(null)
    setErrorGuardar(false)
    setGuardadoReciente(false)

    obtenerAlumnoPorRef(alumnoSeleccionado.alumno_ref, cicloSeleccionado).then(async (alumno) => {
      if (!activo) return
      if (!alumno) {
        setAlumnoId(null)
        setRegistroBeca(null)
        setCargandoBeca(false)
        setMensaje('No hay registro de alumno para este ciclo escolar.')
        return
      }

      setAlumnoId(alumno.alumno_id)
      const beca = await obtenerBecaPorAlumnoId(alumno.alumno_id)
      if (!activo) return

      const lista = conceptos.length ? conceptos : await listarConceptosBeca()
      if (!activo) return
      if (!conceptos.length && lista.length) setConceptos(lista)

      aplicarRegistro(beca, lista)
      setCargandoBeca(false)
    })

    return () => {
      activo = false
    }
  }, [alumnoSeleccionado, cicloSeleccionado, aplicarRegistro])

  useEffect(() => {
    if (modificado) {
      setGuardadoReciente(false)
      if (mensaje && !errorGuardar) setMensaje(null)
    }
  }, [modificado, mensaje, errorGuardar])

  const onGuardar = useCallback(async () => {
    if (!modificado || guardando || alumnoId == null || becaId <= 0) return

    setGuardando(true)
    setMensaje(null)
    setErrorGuardar(false)

    const resultado = await guardarBecaAlumno({
      alumnoBecaId: registroBeca?.alumno_beca_id ?? null,
      alumnoId,
      becaId,
      porcentaje,
      estatus,
      cicloEscolar: cicloSeleccionado,
      becaP: registroBeca?.beca_p,
    })

    setGuardando(false)

    if (!resultado.ok) {
      setErrorGuardar(true)
      setMensaje(resultado.mensaje)
      return
    }

    const actualizado: AlumnoBecaRegistro = {
      alumno_beca_id: resultado.alumnoBecaId,
      alumno_id: alumnoId,
      beca_id: becaId,
      beca_porcentaje: Math.max(0, Math.min(100, Math.round(porcentaje))),
      beca_estatus: estatus,
      beca_ciclo_escolar: cicloSeleccionado,
      beca_p: registroBeca?.beca_p ?? '0',
    }
    setRegistroBeca(actualizado)
    setSnapshotGuardado(snapshotActual)
    setGuardadoReciente(true)
    setMensaje('Beca aplicada correctamente.')
  }, [
    modificado,
    guardando,
    alumnoId,
    becaId,
    porcentaje,
    estatus,
    cicloSeleccionado,
    registroBeca,
    snapshotActual,
  ])

  const nombreAlumno = alumnoSeleccionado?.nombre_completo ?? ''
  const etiquetaTipo =
    conceptos.find((c) => c.beca_id === becaId)?.beca_clase ?? '—'

  return (
    <div className="servicios-panel-inner servicios-panel-inner--becas">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Becas</h1>
        <p className="servicios-panel-lead becas-lead">
          Busca un alumno y asigna o actualiza su beca para el ciclo consultado arriba (
          {etiquetaCiclo}). La selección se conserva al cambiar entre Alumnos y Becas.
        </p>
      </header>

      <AlumnoAutocomplete
        etiqueta="Nombre del alumno / No. control"
        alumnoSeleccionado={alumnoSeleccionado}
        onSeleccionar={setAlumnoSeleccionado}
        autoFocus
      />

      {(resolviendoCiclo || cargandoBeca) && (
        <div className="becas-loading" role="status">
          <Loader2 size={22} className="becas-loading-icon" aria-hidden />
          <span>Cargando datos de beca…</span>
        </div>
      )}

      {!alumnoSeleccionado && !resolviendoCiclo && (
        <div className="servicios-panel-card becas-empty">
          <Star size={28} strokeWidth={1.5} aria-hidden />
          <p>Selecciona un alumno para ver o asignar su beca.</p>
        </div>
      )}

      {alumnoSeleccionado && !cargandoBeca && !resolviendoCiclo && (
        <section className="becas-formulario" aria-label="Asignar beca">
          <h2 className="becas-formulario-titulo">Asignar beca</h2>

          {registroBeca && (
            <p className={`becas-estatus-badge ${claseBecaEstatus(registroBeca.beca_estatus)}`}>
              Beca actual: {etiquetaBecaEstatus(registroBeca.beca_estatus)} ·{' '}
              {conceptos.find((c) => c.beca_id === registroBeca.beca_id)?.beca_clase ?? '—'} ·{' '}
              {registroBeca.beca_porcentaje}%
            </p>
          )}

          <div className="becas-form-grid">
            <div className="becas-field becas-field--full">
              <label htmlFor="becas_alumno" className="becas-label">
                Alumno
              </label>
              <input
                id="becas_alumno"
                type="text"
                className="becas-input becas-input--readonly"
                value={nombreAlumno}
                readOnly
              />
            </div>

            <div className="becas-field">
              <label htmlFor="becas_tipo" className="becas-label">
                Tipo
              </label>
              <select
                id="becas_tipo"
                className="becas-select"
                value={becaId || ''}
                onChange={(e) => setBecaId(Number(e.target.value))}
              >
                {conceptos.length === 0 && <option value="">Sin catálogo</option>}
                {conceptos.map((c) => (
                  <option key={c.beca_id} value={c.beca_id}>
                    {c.beca_clase}
                  </option>
                ))}
              </select>
            </div>

            <div className="becas-field">
              <label htmlFor="becas_porcentaje" className="becas-label">
                Porcentaje
              </label>
              <input
                id="becas_porcentaje"
                type="number"
                min={0}
                max={100}
                className="becas-input"
                value={porcentaje}
                onChange={(e) => setPorcentaje(Number(e.target.value))}
              />
            </div>

            <div className="becas-field">
              <label htmlFor="becas_ciclo" className="becas-label">
                Ciclo escolar
              </label>
              <input
                id="becas_ciclo"
                type="text"
                className="becas-input becas-input--readonly"
                value={etiquetaCiclo}
                readOnly
                title="Usa el selector «Consultar ciclo» en la barra superior"
              />
            </div>

            <div className="becas-field">
              <label htmlFor="becas_estatus" className="becas-label">
                Estatus de la beca
              </label>
              <select
                id="becas_estatus"
                className={`becas-select becas-select--estatus ${claseBecaEstatus(estatus)}`}
                value={estatus}
                onChange={(e) => setEstatus(Number(e.target.value))}
              >
                {BECA_ESTATUS_OPCIONES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {mensaje && (
            <p
              className={`becas-msg ${errorGuardar ? 'becas-msg--error' : 'becas-msg--ok'}`}
              role={errorGuardar ? 'alert' : 'status'}
            >
              {mensaje}
            </p>
          )}

          <div className="becas-acciones">
            <button
              type="button"
              className={`becas-btn becas-btn--aplicar ${
                guardando
                  ? 'becas-btn--guardando'
                  : modificado
                    ? 'becas-btn--dirty'
                    : guardadoReciente
                      ? 'becas-btn--saved'
                      : ''
              }`}
              disabled={guardando || !modificado || becaId <= 0}
              onClick={onGuardar}
            >
              {guardando ? (
                <Loader2 size={20} className="becas-btn-icon" aria-hidden />
              ) : guardadoReciente && !modificado ? (
                <Check size={20} className="becas-btn-icon" aria-hidden />
              ) : (
                <Save size={20} className="becas-btn-icon" aria-hidden />
              )}
              Aplicar beca
            </button>
            {becaId > 0 && (
              <span className="becas-resumen-tipo">
                Tipo seleccionado: <strong>{etiquetaTipo}</strong>
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
