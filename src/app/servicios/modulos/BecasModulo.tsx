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
  cicloEscolar: number
}

function snapshotsIguales(a: SnapshotBeca, b: SnapshotBeca): boolean {
  return (
    a.becaId === b.becaId &&
    a.porcentaje === b.porcentaje &&
    a.estatus === b.estatus &&
    a.cicloEscolar === b.cicloEscolar
  )
}

export default function BecasModulo() {
  const {
    cicloSeleccionado,
    cicloActualSistema,
    opcionesCatalogo,
    cargando: cargandoCiclos,
  } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [conceptos, setConceptos] = useState<ConceptoBeca[]>([])
  const [cargandoBeca, setCargandoBeca] = useState(false)
  /** Alumno del ciclo en que se buscó (consultar ciclo). */
  const [alumnoIdBase, setAlumnoIdBase] = useState<number | null>(null)
  /** Alumno del ciclo del formulario, si existe inscripción en ese ciclo. */
  const [alumnoIdCicloBeca, setAlumnoIdCicloBeca] = useState<number | null>(null)
  const [registroBeca, setRegistroBeca] = useState<AlumnoBecaRegistro | null>(null)

  const [cicloEscolarBeca, setCicloEscolarBeca] = useState(cicloSeleccionado)

  const [becaId, setBecaId] = useState(0)
  const [porcentaje, setPorcentaje] = useState(0)
  const [estatus, setEstatus] = useState(BECA_ESTATUS_ACTIVA)

  const [snapshotGuardado, setSnapshotGuardado] = useState<SnapshotBeca | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoReciente, setGuardadoReciente] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [mensajeInfo, setMensajeInfo] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState(false)

  const snapshotActual = useMemo<SnapshotBeca>(
    () => ({ becaId, porcentaje, estatus, cicloEscolar: cicloEscolarBeca }),
    [becaId, porcentaje, estatus, cicloEscolarBeca]
  )

  const modificado =
    snapshotGuardado != null && !snapshotsIguales(snapshotGuardado, snapshotActual)

  const puedeGuardar =
    modificado && becaId > 0 && (alumnoIdCicloBeca != null || alumnoIdBase != null)

  useEffect(() => {
    listarConceptosBeca().then(setConceptos)
  }, [])

  const aplicarDesdeBeca = useCallback(
    (reg: AlumnoBecaRegistro, lista: ConceptoBeca[]) => {
      setRegistroBeca(reg)
      setBecaId(reg.beca_id)
      setPorcentaje(reg.beca_porcentaje)
      setEstatus(reg.beca_estatus)
      setCicloEscolarBeca(reg.beca_ciclo_escolar)
      setSnapshotGuardado({
        becaId: reg.beca_id,
        porcentaje: reg.beca_porcentaje,
        estatus: reg.beca_estatus,
        cicloEscolar: reg.beca_ciclo_escolar,
      })
      if (lista.length) setConceptos(lista)
    },
    []
  )

  const aplicarFormularioVacio = useCallback((lista: ConceptoBeca[], ciclo: number) => {
    const primero = lista[0]?.beca_id ?? 0
    setRegistroBeca(null)
    setCicloEscolarBeca(ciclo)
    setBecaId(primero)
    setPorcentaje(0)
    setEstatus(BECA_ESTATUS_ACTIVA)
    setSnapshotGuardado({
      becaId: primero,
      porcentaje: 0,
      estatus: BECA_ESTATUS_ACTIVA,
      cicloEscolar: ciclo,
    })
    if (lista.length) setConceptos(lista)
  }, [])

  const cargarAlumnoInicial = useCallback(
    async (ref: string, cicloConsulta: number) => {
      setCargandoBeca(true)
      setMensaje(null)
      setMensajeInfo(null)
      setErrorGuardar(false)
      setGuardadoReciente(false)

      const alumno = await obtenerAlumnoPorRef(ref, cicloConsulta)
      const lista = await listarConceptosBeca()

      if (!alumno) {
        setAlumnoIdBase(null)
        setAlumnoIdCicloBeca(null)
        setRegistroBeca(null)
        setSnapshotGuardado(null)
        setCargandoBeca(false)
        setMensaje('No hay registro de alumno para el ciclo de consulta.')
        return
      }

      setAlumnoIdBase(alumno.alumno_id)
      setAlumnoIdCicloBeca(alumno.alumno_id)
      setCicloEscolarBeca(cicloConsulta)

      const beca = await obtenerBecaPorAlumnoId(alumno.alumno_id)
      if (beca) {
        aplicarDesdeBeca(beca, lista)
      } else {
        aplicarFormularioVacio(lista, cicloConsulta)
      }

      setCargandoBeca(false)
    },
    [aplicarDesdeBeca, aplicarFormularioVacio]
  )

  useEffect(() => {
    if (!alumnoSeleccionado) {
      setAlumnoIdBase(null)
      setAlumnoIdCicloBeca(null)
      setRegistroBeca(null)
      setSnapshotGuardado(null)
      setMensaje(null)
      setMensajeInfo(null)
      setErrorGuardar(false)
      return
    }

    cargarAlumnoInicial(alumnoSeleccionado.alumno_ref, cicloSeleccionado)
  }, [alumnoSeleccionado, cicloSeleccionado, cargarAlumnoInicial])

  const onCambioCicloBeca = useCallback(
    async (ciclo: number) => {
      if (!alumnoSeleccionado || ciclo === cicloEscolarBeca) return

      setCicloEscolarBeca(ciclo)
      setMensajeInfo(null)
      setErrorGuardar(false)

      const alumno = await obtenerAlumnoPorRef(alumnoSeleccionado.alumno_ref, ciclo)
      if (alumno) {
        setAlumnoIdCicloBeca(alumno.alumno_id)
        const beca = await obtenerBecaPorAlumnoId(alumno.alumno_id)
        if (beca) {
          aplicarDesdeBeca(beca, conceptos)
        } else {
          setRegistroBeca(null)
          const etiqueta =
            opcionesCatalogo.find((o) => o.valor === ciclo)?.etiqueta ?? String(ciclo)
          setMensajeInfo(
            `Sin beca en ${etiqueta}. Ajusta los datos y pulsa Aplicar beca para registrarla.`
          )
        }
        return
      }

      setAlumnoIdCicloBeca(null)
      setRegistroBeca(null)
      const etiqueta =
        opcionesCatalogo.find((o) => o.valor === ciclo)?.etiqueta ?? String(ciclo)
      setMensajeInfo(
        `Sin inscripción en ${etiqueta}. Se actualizará la beca del ciclo de consulta con ciclo escolar ${etiqueta}.`
      )
    },
    [alumnoSeleccionado, cicloEscolarBeca, conceptos, opcionesCatalogo, aplicarDesdeBeca]
  )

  useEffect(() => {
    if (modificado) {
      setGuardadoReciente(false)
      if (mensaje && !errorGuardar) setMensaje(null)
    }
  }, [modificado, mensaje, errorGuardar])

  const onGuardar = useCallback(async () => {
    if (!puedeGuardar || guardando) return

    setGuardando(true)
    setMensaje(null)
    setMensajeInfo(null)
    setErrorGuardar(false)

    const ref = alumnoSeleccionado!.alumno_ref
    const alumnoDestino =
      (await obtenerAlumnoPorRef(ref, cicloEscolarBeca))?.alumno_id ??
      alumnoIdCicloBeca ??
      alumnoIdBase

    if (alumnoDestino == null) {
      setGuardando(false)
      setErrorGuardar(true)
      setMensaje('No se encontró un alumno válido para guardar la beca.')
      return
    }

    const becaIdPersistir =
      registroBeca && registroBeca.alumno_id === alumnoDestino
        ? registroBeca.alumno_beca_id
        : null

    const resultado = await guardarBecaAlumno({
      alumnoBecaId: becaIdPersistir,
      alumnoId: alumnoDestino,
      becaId,
      porcentaje,
      estatus,
      cicloEscolar: cicloEscolarBeca,
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
      alumno_id: alumnoDestino,
      beca_id: becaId,
      beca_porcentaje: Math.max(0, Math.min(100, Math.round(porcentaje))),
      beca_estatus: estatus,
      beca_ciclo_escolar: cicloEscolarBeca,
      beca_p: registroBeca?.beca_p ?? '0',
    }

    setAlumnoIdCicloBeca(alumnoDestino)
    setRegistroBeca(actualizado)
    setSnapshotGuardado(snapshotActual)
    setGuardadoReciente(true)
    setMensaje('Beca aplicada correctamente.')
  }, [
    puedeGuardar,
    guardando,
    alumnoSeleccionado,
    cicloEscolarBeca,
    alumnoIdCicloBeca,
    alumnoIdBase,
    registroBeca,
    becaId,
    porcentaje,
    estatus,
    snapshotActual,
  ])

  const nombreAlumno = alumnoSeleccionado?.nombre_completo ?? ''
  const etiquetaTipo =
    conceptos.find((c) => c.beca_id === becaId)?.beca_clase ?? '—'

  const opcionesCicloBeca =
    opcionesCatalogo.length > 0 ? opcionesCatalogo : []

  return (
    <div className="servicios-panel-inner servicios-panel-inner--becas">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Becas</h1>
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
              Beca en{' '}
              {opcionesCatalogo.find((o) => o.valor === registroBeca.beca_ciclo_escolar)
                ?.etiqueta ?? registroBeca.beca_ciclo_escolar}
              : {etiquetaBecaEstatus(registroBeca.beca_estatus)} ·{' '}
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
              <select
                id="becas_ciclo"
                className="becas-select"
                value={String(cicloEscolarBeca)}
                disabled={cargandoCiclos || opcionesCicloBeca.length === 0}
                onChange={(e) => onCambioCicloBeca(Number(e.target.value))}
                aria-label="Ciclo escolar al que aplica la beca"
                title="Ciclo al que aplica la beca (independiente del consultar ciclo)"
              >
                {opcionesCicloBeca.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                    {opcion.valor === cicloActualSistema ? ' (activo)' : ''}
                  </option>
                ))}
              </select>
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

          {mensajeInfo && !errorGuardar && (
            <p className="becas-msg becas-msg--info" role="status">
              {mensajeInfo}
            </p>
          )}

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
              disabled={guardando || !puedeGuardar}
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
