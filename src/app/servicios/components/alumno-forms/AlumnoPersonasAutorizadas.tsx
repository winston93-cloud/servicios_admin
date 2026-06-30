'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import {
  guardarPersonaAutorizada,
  listarPersonasAutorizadas,
  SNAPSHOT_PERSONA_AUTORIZADA_VACIO,
  snapshotPersonaAutorizadaDesdeRegistro,
  snapshotsPersonaAutorizadaIguales,
  type AlumnoContactoRegistro,
  type SnapshotPersonaAutorizada,
} from '@/lib/alumnoContactoService'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import AlumnoFormGuardarBar, {
  type VarianteBotonGuardar,
} from './AlumnoFormGuardarBar'

interface AlumnoPersonasAutorizadasProps {
  alumno: AlumnoBusquedaResultado
}

export default function AlumnoPersonasAutorizadas({ alumno }: AlumnoPersonasAutorizadasProps) {
  const { cicloSeleccionado } = useCicloEscolar()

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [lista, setLista] = useState<AlumnoContactoRegistro[]>([])
  const [contactoSeleccionadoId, setContactoSeleccionadoId] = useState<number | null>(null)

  const [nombre, setNombre] = useState('')
  const [parentesco, setParentesco] = useState('')
  const [telefonoCasa, setTelefonoCasa] = useState('')
  const [celular, setCelular] = useState('')

  const [snapshotGuardado, setSnapshotGuardado] = useState<SnapshotPersonaAutorizada | null>(null)
  const [guardadoReciente, setGuardadoReciente] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardar, setMensajeGuardar] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState(false)

  const snapshotActual = useMemo<SnapshotPersonaAutorizada>(
    () => ({ nombre, parentesco, telefonoCasa, celular }),
    [nombre, parentesco, telefonoCasa, celular]
  )

  const modificado =
    snapshotGuardado != null &&
    !snapshotsPersonaAutorizadaIguales(snapshotGuardado, snapshotActual)

  const varianteBotonGuardar: VarianteBotonGuardar = guardando
    ? 'guardando'
    : modificado
      ? 'dirty'
      : guardadoReciente
        ? 'saved'
        : 'idle'

  const aplicarSnapshot = useCallback((snap: SnapshotPersonaAutorizada) => {
    setNombre(snap.nombre)
    setParentesco(snap.parentesco)
    setTelefonoCasa(snap.telefonoCasa)
    setCelular(snap.celular)
  }, [])

  const limpiarFormularioNuevo = useCallback(() => {
    setContactoSeleccionadoId(null)
    aplicarSnapshot(SNAPSHOT_PERSONA_AUTORIZADA_VACIO)
    setSnapshotGuardado({ ...SNAPSHOT_PERSONA_AUTORIZADA_VACIO })
    setGuardadoReciente(false)
    setMensajeGuardar(null)
    setErrorGuardar(false)
  }, [aplicarSnapshot])

  const seleccionarContacto = useCallback(
    (reg: AlumnoContactoRegistro) => {
      setContactoSeleccionadoId(reg.contacto_id)
      const snap = snapshotPersonaAutorizadaDesdeRegistro(reg)
      aplicarSnapshot(snap)
      setSnapshotGuardado(snap)
      setGuardadoReciente(false)
      setMensajeGuardar(null)
      setErrorGuardar(false)
    },
    [aplicarSnapshot]
  )

  const recargarLista = useCallback(async (idAlumno: number) => {
    const registros = await listarPersonasAutorizadas(idAlumno)
    setLista(registros)
    return registros
  }, [])

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError(null)
    setSnapshotGuardado(null)
    setGuardadoReciente(false)
    setMensajeGuardar(null)
    setErrorGuardar(false)
    setContactoSeleccionadoId(null)

    obtenerAlumnoPorRef(alumno.alumno_ref, cicloSeleccionado).then(async (registroAlumno) => {
      if (!activo) return
      if (!registroAlumno) {
        setError('No se pudo cargar el alumno para este ciclo escolar.')
        setAlumnoId(null)
        setLista([])
        setCargando(false)
        return
      }

      setAlumnoId(registroAlumno.alumno_id)
      const registros = await recargarLista(registroAlumno.alumno_id)
      if (!activo) return

      if (registros.length > 0) {
        seleccionarContacto(registros[0])
      } else {
        limpiarFormularioNuevo()
      }
      setCargando(false)
    })

    return () => {
      activo = false
    }
  }, [
    alumno.alumno_ref,
    alumno.alumno_id,
    cicloSeleccionado,
    recargarLista,
    seleccionarContacto,
    limpiarFormularioNuevo,
  ])

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

    const resultado = await guardarPersonaAutorizada({
      ...snapshotActual,
      alumnoId,
      contactoId: contactoSeleccionadoId,
    })

    setGuardando(false)

    if (!resultado.ok) {
      setErrorGuardar(true)
      setMensajeGuardar(resultado.mensaje)
      return
    }

    const registros = await recargarLista(alumnoId)
    const actualizado =
      registros.find((r) => r.contacto_id === resultado.contactoId) ?? null

    if (actualizado) {
      seleccionarContacto(actualizado)
    } else {
      setSnapshotGuardado(snapshotActual)
    }

    setGuardadoReciente(true)
    setMensajeGuardar('Contacto guardado correctamente.')
  }, [
    modificado,
    guardando,
    alumnoId,
    snapshotActual,
    contactoSeleccionadoId,
    recargarLista,
    seleccionarContacto,
  ])

  if (cargando) {
    return (
      <div className="alumno-form-loading">
        <Loader2 size={24} className="alumno-form-loading-icon" aria-hidden />
        <span>Cargando personas autorizadas…</span>
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
    <div className="alumno-contactos">
      <section className="alumno-contactos-tabla-wrap" aria-label="Personas autorizadas registradas">
        <h3 className="alumno-contactos-titulo">Personas autorizadas</h3>
        {lista.length === 0 ? (
          <p className="alumno-contactos-vacio">No hay personas autorizadas registradas.</p>
        ) : (
          <div className="alumno-contactos-tabla-scroll">
            <table className="alumno-contactos-tabla">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Parentesco</th>
                  <th scope="col">Teléfono</th>
                  <th scope="col">Celular</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((reg, indice) => {
                  const activa = reg.contacto_id === contactoSeleccionadoId
                  return (
                    <tr
                      key={reg.contacto_id}
                      className={activa ? 'alumno-contactos-fila--activa' : ''}
                      onClick={() => seleccionarContacto(reg)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          seleccionarContacto(reg)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={activa}
                      aria-label={`Editar ${reg.contacto_nombre ?? 'persona autorizada'}`}
                    >
                      <td>{indice + 1}</td>
                      <td>{reg.contacto_nombre?.trim() || '—'}</td>
                      <td>{reg.tutor_clase?.trim() || '—'}</td>
                      <td>{reg.contacto_tel?.trim() || '—'}</td>
                      <td>{reg.contacto_cel?.trim() || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form
        className="alumno-form alumno-form--contacto"
        onSubmit={(e) => e.preventDefault()}
        noValidate
      >
        <fieldset className="alumno-form-fieldset alumno-contactos-formulario">
          <legend className="alumno-form-legend">
            {contactoSeleccionadoId != null
              ? 'Editar persona autorizada'
              : 'Agregar persona autorizada'}
          </legend>

          <div className="alumno-contactos-form-acciones">
            <button
              type="button"
              className="alumno-contactos-btn-nueva"
              onClick={limpiarFormularioNuevo}
            >
              Nueva persona
            </button>
          </div>

          <div className="alumno-form-grid-datos alumno-form-grid-datos--contacto">
            <div className="alumno-form-field alumno-form-field--col-2">
              <label htmlFor="contacto_nombre" className="alumno-form-label">
                Nombre
              </label>
              <input
                id="contacto_nombre"
                name="contacto_nombre"
                type="text"
                className="alumno-form-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre…"
                autoComplete="off"
              />
            </div>

            <div className="alumno-form-field">
              <label htmlFor="contacto_parentesco" className="alumno-form-label">
                Parentesco
              </label>
              <input
                id="contacto_parentesco"
                name="tutor_clase"
                type="text"
                className="alumno-form-input"
                value={parentesco}
                onChange={(e) => setParentesco(e.target.value)}
                placeholder="Parentesco…"
                autoComplete="off"
              />
            </div>

            <div className="alumno-form-field">
              <label htmlFor="contacto_tel" className="alumno-form-label">
                Teléfono de casa
              </label>
              <input
                id="contacto_tel"
                name="contacto_tel"
                type="tel"
                className="alumno-form-input"
                value={telefonoCasa}
                onChange={(e) => setTelefonoCasa(e.target.value)}
                placeholder="Teléfono local (7 dígitos)…"
                autoComplete="tel"
              />
            </div>

            <div className="alumno-form-field">
              <label htmlFor="contacto_cel" className="alumno-form-label">
                Celular
              </label>
              <input
                id="contacto_cel"
                name="contacto_cel"
                type="tel"
                className="alumno-form-input"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="8331234567 (10 dígitos)…"
                autoComplete="tel"
              />
            </div>
          </div>
        </fieldset>

        <AlumnoFormGuardarBar
          etiqueta={
            contactoSeleccionadoId != null ? 'Actualizar contacto' : 'Agregar contacto'
          }
          variante={varianteBotonGuardar}
          modificado={modificado}
          guardando={guardando}
          mensaje={mensajeGuardar}
          errorGuardar={errorGuardar}
          onGuardar={onGuardar}
        />
      </form>
    </div>
  )
}
