'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Eye, EyeOff, Loader2, Pencil, Save } from 'lucide-react'
import AlumnoCampoFecha from './AlumnoCampoFecha'
import AlumnoCurpModal from './AlumnoCurpModal'
import { normalizarCurp } from '@/lib/curp'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import {
  guardarDatosElementalesAlumno,
  obtenerDatosElementalesPorRef,
  snapshotsDatosElementalesIguales,
  type AlumnoDatosElementales,
  type SnapshotDatosElementales,
} from '@/lib/alumnoDatosService'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { CICLOS_ESCOLARES_OPCIONES, cicloEscolarPorDefecto } from '@/lib/cicloEscolar'
import { NIVELES_ESCOLARES_OPCIONES, nivelEscolarPorDefecto } from '@/lib/nivelEscolar'
import {
  gradoEscolarPorDefecto,
  gradoOpcionesPorNivel,
} from '@/lib/gradoEscolar'
import {
  GRUPOS_ASIGNACION_OPCIONES,
  GRUPOS_ESCOLARES_OPCIONES,
  grupoEscolarDesdeBd,
} from '@/lib/grupoEscolar'
import { fechaNacAMostrar, fechaNacIsoDesdeBd } from '@/lib/fechaNacimiento'
import {
  ESTATUS_ALUMNO_OPCIONES,
  claseFormularioPorEstatus,
  estatusAlumnoPorDefecto,
} from '@/lib/alumnoStatus'
import {
  FORMA_INGRESO_OPCIONES,
  formaIngresoPorDefecto,
} from '@/lib/alumnoFormaIngreso'
import { SEXO_ALUMNO_OPCIONES, sexoAlumnoPorDefecto } from '@/lib/alumnoSexo'

interface AlumnoFormElementalesProps {
  alumno: AlumnoBusquedaResultado
}

export default function AlumnoFormElementales({ alumno }: AlumnoFormElementalesProps) {
  const { cicloSeleccionado, opcionesCatalogo } = useCicloEscolar()
  const opcionesCicloForm = useMemo(
    () => (opcionesCatalogo.length > 0 ? opcionesCatalogo : [...CICLOS_ESCOLARES_OPCIONES]),
    [opcionesCatalogo]
  )

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<AlumnoDatosElementales | null>(null)
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [nombre, setNombre] = useState('')
  const [clavePersonal, setClavePersonal] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [fechaRegistroIso, setFechaRegistroIso] = useState('')
  const [fechaRegistroTexto, setFechaRegistroTexto] = useState('')
  const [fechaAltaIso, setFechaAltaIso] = useState('')
  const [fechaAltaTexto, setFechaAltaTexto] = useState('')
  const [cicloEscolar, setCicloEscolar] = useState<number>(
    CICLOS_ESCOLARES_OPCIONES[0].valor
  )
  const [nivelEscolar, setNivelEscolar] = useState<number>(
    NIVELES_ESCOLARES_OPCIONES[0].valor
  )
  const [gradoEscolar, setGradoEscolar] = useState<number>(1)
  const [grupoEscolar, setGrupoEscolar] = useState<number>(
    GRUPOS_ESCOLARES_OPCIONES[0].valor
  )
  const [curp, setCurp] = useState('')
  const [fechaNacimientoIso, setFechaNacimientoIso] = useState('')
  const [fechaNacimientoTexto, setFechaNacimientoTexto] = useState('')
  const [modalCurpAbierto, setModalCurpAbierto] = useState(false)
  const [formaIngreso, setFormaIngreso] = useState<number>(0)
  const [sexoAlumno, setSexoAlumno] = useState<string>('')
  const [estatusAlumno, setEstatusAlumno] = useState<number>(1)
  const [snapshotGuardado, setSnapshotGuardado] = useState<SnapshotDatosElementales | null>(
    null
  )
  const [guardadoReciente, setGuardadoReciente] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardar, setMensajeGuardar] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState(false)

  const snapshotActual = useMemo<SnapshotDatosElementales>(
    () => ({
      apellidoPaterno,
      apellidoMaterno,
      nombre,
      clavePersonal,
      cicloEscolar,
      nivelEscolar,
      gradoEscolar,
      grupoEscolar,
      curp,
      fechaNacimientoIso,
      fechaAltaIso,
      formaIngreso,
      sexoAlumno,
      estatusAlumno,
    }),
    [
      apellidoPaterno,
      apellidoMaterno,
      nombre,
      clavePersonal,
      cicloEscolar,
      nivelEscolar,
      gradoEscolar,
      grupoEscolar,
      curp,
      fechaNacimientoIso,
      fechaAltaIso,
      formaIngreso,
      sexoAlumno,
      estatusAlumno,
    ]
  )

  const modificado =
    snapshotGuardado != null &&
    !snapshotsDatosElementalesIguales(snapshotGuardado, snapshotActual)

  const varianteBotonGuardar = guardando
    ? 'guardando'
    : modificado
      ? 'dirty'
      : guardadoReciente
        ? 'saved'
        : 'idle'

  const opcionesGrado = useMemo(
    () => gradoOpcionesPorNivel(nivelEscolar),
    [nivelEscolar]
  )

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    setSnapshotGuardado(null)
    setGuardadoReciente(false)
    setMensajeGuardar(null)
    setErrorGuardar(false)

    obtenerDatosElementalesPorRef(alumno.alumno_ref, cicloSeleccionado).then((registro) => {
      if (!activo) return
      if (!registro) {
        setError('No se pudo cargar la información del alumno.')
        setDatos(null)
      } else {
        setDatos(registro)
        setApellidoPaterno(registro.alumno.alumno_app ?? '')
        setApellidoMaterno(registro.alumno.alumno_apm ?? '')
        setNombre(registro.alumno.alumno_nombre ?? '')
        setClavePersonal(registro.detalles?.alumno_clave ?? '')
        const nivel = nivelEscolarPorDefecto(registro.alumno.alumno_nivel)
        setCicloEscolar(
          cicloEscolarPorDefecto(
            registro.alumno.alumno_ciclo_escolar,
            opcionesCicloForm,
            cicloSeleccionado
          )
        )
        setNivelEscolar(nivel)
        setGradoEscolar(gradoEscolarPorDefecto(nivel, registro.alumno.alumno_grado))
        setGrupoEscolar(grupoEscolarDesdeBd(registro.alumno.alumno_grupo))
        setCurp(normalizarCurp(registro.detalles?.alumno_curp ?? ''))
        const fechaIso = fechaNacIsoDesdeBd(registro.detalles?.alumno_fecha_nac)
        setFechaNacimientoIso(fechaIso)
        setFechaNacimientoTexto(fechaNacAMostrar(fechaIso))
        const regIso = fechaNacIsoDesdeBd(registro.alumno.alumno_registro)
        setFechaRegistroIso(regIso)
        setFechaRegistroTexto(fechaNacAMostrar(regIso))
        const altaIso = fechaNacIsoDesdeBd(registro.alumno.alumno_alta)
        setFechaAltaIso(altaIso)
        setFechaAltaTexto(fechaNacAMostrar(altaIso))
        setMostrarClave(false)
        setFormaIngreso(formaIngresoPorDefecto(registro.alumno.alumno_nuevo_ingreso))
        setSexoAlumno(sexoAlumnoPorDefecto(registro.detalles?.alumno_sexo))
        setEstatusAlumno(estatusAlumnoPorDefecto(registro.alumno.alumno_status))
        setSnapshotGuardado({
          apellidoPaterno: registro.alumno.alumno_app ?? '',
          apellidoMaterno: registro.alumno.alumno_apm ?? '',
          nombre: registro.alumno.alumno_nombre ?? '',
          clavePersonal: registro.detalles?.alumno_clave ?? '',
          cicloEscolar: cicloEscolarPorDefecto(
            registro.alumno.alumno_ciclo_escolar,
            opcionesCicloForm,
            cicloSeleccionado
          ),
          nivelEscolar: nivel,
          gradoEscolar: gradoEscolarPorDefecto(nivel, registro.alumno.alumno_grado),
          grupoEscolar: grupoEscolarDesdeBd(registro.alumno.alumno_grupo),
          curp: normalizarCurp(registro.detalles?.alumno_curp ?? ''),
          fechaNacimientoIso: fechaIso,
          fechaAltaIso: altaIso,
          formaIngreso: formaIngresoPorDefecto(registro.alumno.alumno_nuevo_ingreso),
          sexoAlumno: sexoAlumnoPorDefecto(registro.detalles?.alumno_sexo),
          estatusAlumno: estatusAlumnoPorDefecto(registro.alumno.alumno_status),
        })
        setGuardadoReciente(false)
      }
      setCargando(false)
    })

    return () => {
      activo = false
    }
  }, [alumno.alumno_ref, alumno.alumno_id, cicloSeleccionado, opcionesCicloForm])

  useEffect(() => {
    if (modificado) {
      setGuardadoReciente(false)
      if (mensajeGuardar && !errorGuardar) setMensajeGuardar(null)
    }
  }, [modificado, mensajeGuardar, errorGuardar])

  const onGuardar = useCallback(async () => {
    if (!datos || !modificado || guardando) return

    setGuardando(true)
    setMensajeGuardar(null)
    setErrorGuardar(false)

    const resultado = await guardarDatosElementalesAlumno({
      ...snapshotActual,
      alumnoId: datos.alumno.alumno_id,
      detalleId: datos.detalles?.detalle_id ?? null,
    })

    setGuardando(false)

    if (!resultado.ok) {
      setErrorGuardar(true)
      setMensajeGuardar(resultado.mensaje)
      return
    }

    const detalleId = resultado.detalleId ?? datos.detalles?.detalle_id
    setDatos((prev) => {
      if (!prev) return prev
      const alumnoActualizado = {
        ...prev.alumno,
        alumno_app: snapshotActual.apellidoPaterno,
        alumno_apm: snapshotActual.apellidoMaterno,
        alumno_nombre: snapshotActual.nombre,
        alumno_nivel: snapshotActual.nivelEscolar,
        alumno_grado: snapshotActual.gradoEscolar,
        alumno_grupo: snapshotActual.grupoEscolar,
        alumno_ciclo_escolar: snapshotActual.cicloEscolar,
        alumno_status: snapshotActual.estatusAlumno,
        alumno_nuevo_ingreso: snapshotActual.formaIngreso,
        alumno_alta: snapshotActual.fechaAltaIso || null,
      }
      const detallesActualizados =
        detalleId != null
          ? {
              detalle_id: detalleId,
              alumno_id: prev.alumno.alumno_id,
              alumno_clave: snapshotActual.clavePersonal || null,
              alumno_curp: snapshotActual.curp || null,
              alumno_fecha_nac: snapshotActual.fechaNacimientoIso || null,
              alumno_sexo: snapshotActual.sexoAlumno || null,
            }
          : prev.detalles
      return { alumno: alumnoActualizado, detalles: detallesActualizados }
    })

    setSnapshotGuardado(snapshotActual)
    setGuardadoReciente(true)
    setMensajeGuardar('Los datos se guardaron correctamente.')
  }, [datos, modificado, guardando, snapshotActual])

  if (cargando) {
    return (
      <div className="alumno-form-loading">
        <Loader2 size={24} className="alumno-form-loading-icon" aria-hidden />
        <span>Cargando datos del alumno…</span>
      </div>
    )
  }

  if (error || !datos) {
    return (
      <p className="alumno-form-error" role="alert">
        {error ?? 'Sin datos disponibles.'}
      </p>
    )
  }

  const { alumno: a, detalles } = datos
  const nombreCompleto = [nombre, apellidoPaterno, apellidoMaterno]
    .filter(Boolean)
    .join(' ')
    .trim()

  const claseEstatus = claseFormularioPorEstatus(estatusAlumno)

  return (
    <form
      className={`alumno-form ${claseEstatus}`}
      onSubmit={(e) => e.preventDefault()}
      noValidate
    >
      <fieldset className="alumno-form-fieldset">
        <section className="alumno-form-identidad" aria-label="Nombre del alumno">
          <div className="alumno-form-flujo-nombres">
          <div className="alumno-form-field">
            <label htmlFor="alumno_app" className="alumno-form-label">
              Apellido paterno
            </label>
            <input
              id="alumno_app"
              name="alumno_app"
              type="text"
              className="alumno-form-input alumno-form-input--identidad"
              value={apellidoPaterno}
              onChange={(e) => setApellidoPaterno(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div className="alumno-form-field">
            <label htmlFor="alumno_apm" className="alumno-form-label">
              Apellido materno
            </label>
            <input
              id="alumno_apm"
              name="alumno_apm"
              type="text"
              className="alumno-form-input alumno-form-input--identidad"
              value={apellidoMaterno}
              onChange={(e) => setApellidoMaterno(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div className="alumno-form-field">
            <label htmlFor="alumno_nombre" className="alumno-form-label">
              Nombre(s)
            </label>
            <input
              id="alumno_nombre"
              name="alumno_nombre"
              type="text"
              className="alumno-form-input alumno-form-input--identidad"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          </div>
        </section>

        <div className="alumno-form-grid-datos">
          <div className="alumno-form-field">
            <label htmlFor="alumno_id" className="alumno-form-label">
              ID
            </label>
            <input
              id="alumno_id"
              name="alumno_id"
              type="text"
              className="alumno-form-input"
              value={String(a.alumno_id)}
              readOnly
            />
          </div>
          <div className="alumno-form-field">
            <label htmlFor="alumno_ref" className="alumno-form-label">
              No. de control
            </label>
            <input
              id="alumno_ref"
              name="alumno_ref"
              type="text"
              className="alumno-form-input"
              value={a.alumno_ref ?? ''}
              readOnly
            />
          </div>
          <div className="alumno-form-field">
            <label htmlFor="alumno_clave" className="alumno-form-label">
              Clave personal
            </label>
            <div className="alumno-form-clave-fila">
              <input
                id="alumno_clave"
                name="alumno_clave"
                type={mostrarClave ? 'text' : 'password'}
                className="alumno-form-input alumno-form-input--clave"
                value={clavePersonal}
                onChange={(e) => setClavePersonal(e.target.value)}
                placeholder={detalles ? undefined : 'Sin registro en alumno_detalles'}
                autoComplete="off"
              />
              <button
                type="button"
                className="alumno-form-clave-btn"
                onClick={() => setMostrarClave((v) => !v)}
                aria-label={mostrarClave ? 'Ocultar clave personal' : 'Ver clave personal'}
                aria-pressed={mostrarClave}
              >
                {mostrarClave ? (
                  <EyeOff size={18} aria-hidden />
                ) : (
                  <Eye size={18} aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div className="alumno-form-field">
            <label htmlFor="alumno_ciclo_escolar" className="alumno-form-label">
              Ciclo escolar
            </label>
            <select
              id="alumno_ciclo_escolar"
              name="alumno_ciclo_escolar"
              className="alumno-form-select"
              value={String(cicloEscolar)}
              onChange={(e) => setCicloEscolar(Number(e.target.value))}
            >
              {opcionesCicloForm.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="alumno-form-field">
            <label htmlFor="alumno_nivel" className="alumno-form-label">
              Nivel
            </label>
            <select
              id="alumno_nivel"
              name="alumno_nivel"
              className="alumno-form-select"
              value={String(nivelEscolar)}
              onChange={(e) => {
                const nivel = Number(e.target.value)
                setNivelEscolar(nivel)
                setGradoEscolar((gradoActual) =>
                  gradoEscolarPorDefecto(nivel, gradoActual)
                )
              }}
            >
              {NIVELES_ESCOLARES_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="alumno-form-field">
            <label htmlFor="alumno_grado" className="alumno-form-label">
              Grado
            </label>
            <select
              id="alumno_grado"
              name="alumno_grado"
              className="alumno-form-select"
              value={String(gradoEscolar)}
              onChange={(e) => setGradoEscolar(Number(e.target.value))}
              disabled={opcionesGrado.length === 0}
            >
              {opcionesGrado.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="alumno-form-field">
            <label htmlFor="alumno_grupo" className="alumno-form-label">
              Grupo
            </label>
            <select
              id="alumno_grupo"
              name="alumno_grupo"
              className="alumno-form-select"
              value={String(grupoEscolar)}
              onChange={(e) => setGrupoEscolar(Number(e.target.value))}
            >
              {GRUPOS_ASIGNACION_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <AlumnoCampoFecha
            id="alumno_fecha_nac"
            name="alumno_fecha_nac"
            label="Fecha de nacimiento"
            iso={fechaNacimientoIso}
            texto={fechaNacimientoTexto}
            onIsoChange={setFechaNacimientoIso}
            onTextoChange={setFechaNacimientoTexto}
          />

          <div className="alumno-form-field alumno-form-field--col-2">
            <label htmlFor="alumno_curp" className="alumno-form-label">
              CURP
            </label>
            <div className="alumno-form-curp-fila">
              <input
                id="alumno_curp"
                name="alumno_curp"
                type="text"
                className="alumno-form-input alumno-form-input--curp"
                value={curp}
                readOnly
                placeholder={detalles ? 'Sin CURP registrado' : 'Sin registro en alumno_detalles'}
              />
              <button
                type="button"
                className="alumno-form-curp-btn"
                onClick={() => setModalCurpAbierto(true)}
              >
                <Pencil size={16} aria-hidden />
                Corregir
              </button>
            </div>
          </div>

          <AlumnoCampoFecha
            id="alumno_registro"
            name="alumno_registro"
            label="Fecha de registro"
            iso={fechaRegistroIso}
            texto={fechaRegistroTexto}
            onIsoChange={setFechaRegistroIso}
            onTextoChange={setFechaRegistroTexto}
            soloLectura
            placeholder="Sin fecha de registro"
          />

          <AlumnoCampoFecha
            id="alumno_alta"
            name="alumno_alta"
            label="Fecha de alta"
            iso={fechaAltaIso}
            texto={fechaAltaTexto}
            onIsoChange={setFechaAltaIso}
            onTextoChange={setFechaAltaTexto}
          />

          <div className="alumno-form-field">
            <label htmlFor="alumno_nuevo_ingreso" className="alumno-form-label">
              Forma de ingreso
            </label>
            <select
              id="alumno_nuevo_ingreso"
              name="alumno_nuevo_ingreso"
              className="alumno-form-select"
              value={String(formaIngreso)}
              onChange={(e) => setFormaIngreso(Number(e.target.value))}
            >
              {FORMA_INGRESO_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="alumno-form-field">
            <label htmlFor="alumno_sexo" className="alumno-form-label">
              Sexo
            </label>
            <select
              id="alumno_sexo"
              name="alumno_sexo"
              className="alumno-form-select"
              value={sexoAlumno}
              onChange={(e) => setSexoAlumno(e.target.value)}
              disabled={!detalles}
            >
              <option value="">
                {detalles ? 'Seleccionar' : 'Sin registro en alumno_detalles'}
              </option>
              {SEXO_ALUMNO_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="alumno-form-field alumno-form-field--estatus">
            <label htmlFor="alumno_status" className="alumno-form-label">
              Estatus del alumno
            </label>
            <select
              id="alumno_status"
              name="alumno_status"
              className="alumno-form-select alumno-form-select--estatus"
              value={String(estatusAlumno)}
              onChange={(e) => setEstatusAlumno(Number(e.target.value))}
            >
              {ESTATUS_ALUMNO_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <footer className="alumno-form-guardar">
        {mensajeGuardar && (
          <p
            className={`alumno-form-guardar-msg ${errorGuardar ? 'alumno-form-guardar-msg--error' : 'alumno-form-guardar-msg--ok'}`}
            role={errorGuardar ? 'alert' : 'status'}
          >
            {mensajeGuardar}
          </p>
        )}
        <button
          type="button"
          className={`alumno-form-guardar-btn alumno-form-guardar-btn--${varianteBotonGuardar}`}
          disabled={guardando || !modificado}
          onClick={onGuardar}
        >
          {guardando ? (
            <Loader2 size={20} className="alumno-form-guardar-btn-icon" aria-hidden />
          ) : guardadoReciente && !modificado ? (
            <Check size={20} className="alumno-form-guardar-btn-icon" aria-hidden />
          ) : (
            <Save size={20} className="alumno-form-guardar-btn-icon" aria-hidden />
          )}
          Guardar
        </button>
      </footer>

      <AlumnoCurpModal
        isOpen={modalCurpAbierto}
        onClose={() => setModalCurpAbierto(false)}
        valorInicial={curp}
        onAplicar={setCurp}
        nombreAlumno={nombreCompleto || undefined}
        fechaNacimiento={fechaNacimientoIso || detalles?.alumno_fecha_nac}
        sexoRegistrado={sexoAlumno || detalles?.alumno_sexo}
      />
    </form>
  )
}
