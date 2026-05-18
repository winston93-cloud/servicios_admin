'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import type { AlumnoFamiliarFormConfig } from '@/lib/alumnoFamiliarFormConfig'
import {
  guardarDatosFamiliar,
  obtenerFamiliarPorAlumnoId,
  snapshotDatosFamiliarDesdeRegistro,
  snapshotsDatosFamiliarIguales,
  type AlumnoFamiliarRegistro,
  type SnapshotDatosFamiliar,
} from '@/lib/alumnoFamiliarService'
import { normalizarCurp } from '@/lib/curp'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import AlumnoFormGuardarBar, {
  type VarianteBotonGuardar,
} from './AlumnoFormGuardarBar'

interface AlumnoFormFamiliarProps {
  alumno: AlumnoBusquedaResultado
  config: AlumnoFamiliarFormConfig
}

export default function AlumnoFormFamiliar({ alumno, config }: AlumnoFormFamiliarProps) {
  const { cicloSeleccionado } = useCicloEscolar()
  const { tutorId, idPrefix } = config

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [familiar, setFamiliar] = useState<AlumnoFamiliarRegistro | null>(null)

  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [recibirEmail, setRecibirEmail] = useState(1)
  const [telefonoCasa, setTelefonoCasa] = useState('')
  const [celular, setCelular] = useState('')
  const [telefonoTrabajo, setTelefonoTrabajo] = useState('')
  const [curp, setCurp] = useState('')

  const [snapshotGuardado, setSnapshotGuardado] = useState<SnapshotDatosFamiliar | null>(null)
  const [guardadoReciente, setGuardadoReciente] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardar, setMensajeGuardar] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState(false)

  const snapshotActual = useMemo<SnapshotDatosFamiliar>(
    () => ({
      apellidoPaterno,
      apellidoMaterno,
      nombre,
      email,
      recibirEmail,
      telefonoCasa,
      celular,
      telefonoTrabajo,
      curp,
    }),
    [
      apellidoPaterno,
      apellidoMaterno,
      nombre,
      email,
      recibirEmail,
      telefonoCasa,
      celular,
      telefonoTrabajo,
      curp,
    ]
  )

  const modificado =
    snapshotGuardado != null && !snapshotsDatosFamiliarIguales(snapshotGuardado, snapshotActual)

  const varianteBotonGuardar: VarianteBotonGuardar = guardando
    ? 'guardando'
    : modificado
      ? 'dirty'
      : guardadoReciente
        ? 'saved'
        : 'idle'

  const aplicarSnapshot = useCallback((snap: SnapshotDatosFamiliar) => {
    setApellidoPaterno(snap.apellidoPaterno)
    setApellidoMaterno(snap.apellidoMaterno)
    setNombre(snap.nombre)
    setEmail(snap.email)
    setRecibirEmail(snap.recibirEmail)
    setTelefonoCasa(snap.telefonoCasa)
    setCelular(snap.celular)
    setTelefonoTrabajo(snap.telefonoTrabajo)
    setCurp(snap.curp)
  }, [])

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    setSnapshotGuardado(null)
    setGuardadoReciente(false)
    setMensajeGuardar(null)
    setErrorGuardar(false)

    obtenerAlumnoPorRef(alumno.alumno_ref, cicloSeleccionado).then(async (registroAlumno) => {
      if (!activo) return
      if (!registroAlumno) {
        setError('No se pudo cargar el alumno para este ciclo escolar.')
        setAlumnoId(null)
        setFamiliar(null)
        setCargando(false)
        return
      }

      setAlumnoId(registroAlumno.alumno_id)
      const registroFamiliar = await obtenerFamiliarPorAlumnoId(
        registroAlumno.alumno_id,
        tutorId
      )
      if (!activo) return

      setFamiliar(registroFamiliar)
      const snap = snapshotDatosFamiliarDesdeRegistro(registroFamiliar)
      aplicarSnapshot(snap)
      setSnapshotGuardado(snap)
      setCargando(false)
    })

    return () => {
      activo = false
    }
  }, [alumno.alumno_ref, alumno.alumno_id, cicloSeleccionado, tutorId, aplicarSnapshot])

  useEffect(() => {
    if (modificado) {
      setGuardadoReciente(false)
      if (mensajeGuardar && !errorGuardar) setMensajeGuardar(null)
    }
  }, [modificado, mensajeGuardar, errorGuardar])

  const onGuardar = useCallback(async () => {
    if (!modificado || guardando || alumnoId == null) return

    setGuardando(true)
    setMensajeGuardar(null)
    setErrorGuardar(false)

    const resultado = await guardarDatosFamiliar({
      ...snapshotActual,
      alumnoId,
      familiarId: familiar?.familiar_id ?? null,
      tutorId,
    })

    setGuardando(false)

    if (!resultado.ok) {
      setErrorGuardar(true)
      setMensajeGuardar(resultado.mensaje)
      return
    }

    setFamiliar({
      familiar_id: resultado.familiarId,
      alumno_id: alumnoId,
      tutor_id: tutorId,
      familiar_app: snapshotActual.apellidoPaterno || null,
      familiar_apm: snapshotActual.apellidoMaterno || null,
      familiar_nombre: snapshotActual.nombre || null,
      familiar_email: snapshotActual.email || null,
      familiar_recibir_email: snapshotActual.recibirEmail,
      familiar_tel: snapshotActual.telefonoCasa || null,
      familiar_cel: snapshotActual.celular || null,
      familiar_empresa_tel: snapshotActual.telefonoTrabajo || null,
      familiar_curp: snapshotActual.curp || null,
    })
    setSnapshotGuardado(snapshotActual)
    setGuardadoReciente(true)
    setMensajeGuardar(config.textoGuardadoOk)
  }, [modificado, guardando, alumnoId, familiar, snapshotActual, tutorId, config.textoGuardadoOk])

  if (cargando) {
    return (
      <div className="alumno-form-loading">
        <Loader2 size={24} className="alumno-form-loading-icon" aria-hidden />
        <span>{config.textoCargando}</span>
      </div>
    )
  }

  if (error) {
    return (
      <p className="alumno-form-error" role="alert">
        {error}
      </p>
    )
  }

  return (
    <form className="alumno-form alumno-form--familiar" onSubmit={(e) => e.preventDefault()} noValidate>
      <fieldset className="alumno-form-fieldset">
        <legend className="alumno-form-legend">{config.legend}</legend>

        {familiar == null && <p className="alumno-form-aviso">{config.textoSinRegistro}</p>}

        <section className="alumno-form-identidad" aria-label={config.ariaNombre}>
          <div className="alumno-form-flujo-nombres">
            <div className="alumno-form-field">
              <label htmlFor={`${idPrefix}_app`} className="alumno-form-label">
                Apellido paterno
              </label>
              <input
                id={`${idPrefix}_app`}
                name="familiar_app"
                type="text"
                className="alumno-form-input alumno-form-input--identidad"
                value={apellidoPaterno}
                onChange={(e) => setApellidoPaterno(e.target.value)}
                placeholder="Apellido paterno…"
                autoComplete="off"
              />
            </div>
            <div className="alumno-form-field">
              <label htmlFor={`${idPrefix}_apm`} className="alumno-form-label">
                Apellido materno
              </label>
              <input
                id={`${idPrefix}_apm`}
                name="familiar_apm"
                type="text"
                className="alumno-form-input alumno-form-input--identidad"
                value={apellidoMaterno}
                onChange={(e) => setApellidoMaterno(e.target.value)}
                placeholder="Apellido materno…"
                autoComplete="off"
              />
            </div>
            <div className="alumno-form-field">
              <label htmlFor={`${idPrefix}_nombre`} className="alumno-form-label">
                Nombre
              </label>
              <input
                id={`${idPrefix}_nombre`}
                name="familiar_nombre"
                type="text"
                className="alumno-form-input alumno-form-input--identidad"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre…"
                autoComplete="off"
              />
            </div>
          </div>
        </section>

        <div className="alumno-form-grid-datos alumno-form-grid-datos--familiar">
          <div className="alumno-form-field alumno-form-field--col-2">
            <label htmlFor={`${idPrefix}_email`} className="alumno-form-label">
              {config.labelEmail}
            </label>
            <input
              id={`${idPrefix}_email`}
              name="familiar_email"
              type="email"
              className="alumno-form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo…"
              autoComplete="email"
            />
          </div>

          <fieldset className="alumno-form-field alumno-form-field--col-2 alumno-form-radios">
            <legend className="alumno-form-label">Correos informativos</legend>
            <div className="alumno-form-radio-group">
              <label className="alumno-form-radio">
                <input
                  type="radio"
                  name={config.radioName}
                  value="1"
                  checked={recibirEmail === 1}
                  onChange={() => setRecibirEmail(1)}
                />
                Sí, enviar correos
              </label>
              <label className="alumno-form-radio">
                <input
                  type="radio"
                  name={config.radioName}
                  value="0"
                  checked={recibirEmail === 0}
                  onChange={() => setRecibirEmail(0)}
                />
                No enviar correos
              </label>
            </div>
          </fieldset>

          <div className="alumno-form-field">
            <label htmlFor={`${idPrefix}_tel`} className="alumno-form-label">
              Teléfono de casa
            </label>
            <input
              id={`${idPrefix}_tel`}
              name="familiar_tel"
              type="tel"
              className="alumno-form-input"
              value={telefonoCasa}
              onChange={(e) => setTelefonoCasa(e.target.value)}
              placeholder="Teléfono local (7 dígitos)…"
              autoComplete="tel"
            />
          </div>

          <div className="alumno-form-field">
            <label htmlFor={`${idPrefix}_cel`} className="alumno-form-label">
              Celular
            </label>
            <input
              id={`${idPrefix}_cel`}
              name="familiar_cel"
              type="tel"
              className="alumno-form-input"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              placeholder="10 dígitos…"
              autoComplete="tel"
            />
          </div>

          <div className="alumno-form-field">
            <label htmlFor={`${idPrefix}_tel_trabajo`} className="alumno-form-label">
              Teléfono de trabajo
            </label>
            <input
              id={`${idPrefix}_tel_trabajo`}
              name="familiar_empresa_tel"
              type="tel"
              className="alumno-form-input"
              value={telefonoTrabajo}
              onChange={(e) => setTelefonoTrabajo(e.target.value)}
              placeholder="Teléfono local (máx. 10 dígitos)…"
              autoComplete="tel"
            />
          </div>

          <div className="alumno-form-field alumno-form-field--col-2">
            <label htmlFor={`${idPrefix}_curp`} className="alumno-form-label">
              CURP
            </label>
            <input
              id={`${idPrefix}_curp`}
              name="familiar_curp"
              type="text"
              className="alumno-form-input alumno-form-input--curp"
              value={curp}
              onChange={(e) => setCurp(normalizarCurp(e.target.value))}
              placeholder="CURP (18 caracteres)…"
              maxLength={18}
              spellCheck={false}
            />
          </div>
        </div>
      </fieldset>

      <AlumnoFormGuardarBar
        etiqueta={config.textoBotonGuardar}
        variante={varianteBotonGuardar}
        modificado={modificado}
        guardando={guardando}
        mensaje={mensajeGuardar}
        errorGuardar={errorGuardar}
        onGuardar={onGuardar}
      />
    </form>
  )
}
