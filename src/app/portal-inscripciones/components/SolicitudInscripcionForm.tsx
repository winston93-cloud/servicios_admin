'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  Loader2,
  Phone,
  Save,
  User,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { SEXO_ALUMNO_OPCIONES } from '@/lib/alumnoSexo'
import type { SolicitudInscripcionFormulario } from '@/lib/portalInscripcionesSolicitudTypes'
import { SOLICITUD_CONTACTO_VACIO } from '@/lib/portalInscripcionesSolicitudTypes'
import {
  ETIQUETA_SECCION_SOLICITUD,
  SECCIONES_SOLICITUD_ORDEN,
  mapaErroresPorSeccion,
  seccionSolicitudCompleta,
  type SeccionSolicitudId,
} from '@/lib/portalInscripcionesValidacion'

const SECCIONES = [
  { id: 'alumno' as const, label: 'Alumno', hint: 'Datos personales y domicilio', icon: User, accent: 'sky' },
  { id: 'salud' as const, label: 'Salud', hint: 'Ficha médica escolar', icon: HeartPulse, accent: 'emerald' },
  { id: 'mama' as const, label: 'Mamá', hint: 'Datos de la madre', icon: Users, accent: 'violet' },
  { id: 'papa' as const, label: 'Papá', hint: 'Datos del padre', icon: Users, accent: 'indigo' },
  { id: 'contactos' as const, label: 'Contactos', hint: 'Emergencia y autorizados', icon: Phone, accent: 'amber' },
]

type SeccionId = SeccionSolicitudId

function iconoSeccion(id: SeccionId): LucideIcon {
  return SECCIONES.find((s) => s.id === id)?.icon ?? User
}

// Formulario vacío con ids nulos
const SOLICITUD_INSCRIPCION_VACIO: SolicitudInscripcionFormulario = {
  detalleId: null,
  datoMedicoId: null,
  mamaFamiliarId: null,
  papaFamiliarId: null,
  alumno: {
    fechaNacimiento: '',
    lugarNacimiento: '',
    curp: '',
    sexo: '',
    calle: '',
    entreCalles: '',
    numeroExt: '',
    numeroInt: '',
    colonia: '',
    cp: '',
    ciudad: '',
    estado: '',
    escuelaProcedente: '',
  },
  medico: {
    peso: '',
    estatura: '',
    tipoSangre: '',
    alergias: '',
    tienePadecimiento: '',
    padecimiento: '',
    requiereMedicina: '',
    medicina: '',
    suministrar: '',
    medicamentos: '',
    atencionInterna: '',
    afiliacion: '',
    afiliacionExterna: '',
    servicioMedico: '',
  },
  mama: {
    apellidoPaterno: '',
    apellidoMaterno: '',
    nombre: '',
    vive: '1',
    fechaNacimiento: '',
    lugarNacimiento: '',
    curp: '',
    rfc: '',
    escolaridad: '',
    empresaNombre: '',
    empresaDireccion: '',
    puesto: '',
    telefonoTrabajo: '',
    email: '',
    celular: '',
  },
  papa: {
    apellidoPaterno: '',
    apellidoMaterno: '',
    nombre: '',
    vive: '1',
    fechaNacimiento: '',
    lugarNacimiento: '',
    curp: '',
    rfc: '',
    escolaridad: '',
    empresaNombre: '',
    empresaDireccion: '',
    puesto: '',
    telefonoTrabajo: '',
    email: '',
    celular: '',
  },
  emergencia: { ...SOLICITUD_CONTACTO_VACIO },
  autorizados: [{ ...SOLICITUD_CONTACTO_VACIO }],
}

function Campo({
  label,
  children,
  required,
  hint,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  hint?: string
}) {
  return (
    <label className="pi-form-field">
      <span className="pi-form-label">
        {label}
        {required ? <span className="pi-form-req"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="pi-form-hint">{hint}</span> : null}
    </label>
  )
}

export default function SolicitudInscripcionForm() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [seccion, setSeccion] = useState<SeccionId>('alumno')
  const [form, setForm] = useState<SolicitudInscripcionFormulario>(SOLICITUD_INSCRIPCION_VACIO)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [erroresValidacion, setErroresValidacion] = useState<string[]>([])
  const [exito, setExito] = useState(false)

  const cargar = useCallback(async () => {
    if (alumnoId == null) {
      setError('Sesión de alumno no válida.')
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal-inscripciones/solicitud?alumnoId=${alumnoId}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cargar la solicitud.')
      } else {
        setForm(data.formulario)
      }
    } catch {
      setError('Error de conexión.')
    }
    setCargando(false)
  }, [alumnoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = async () => {
    if (alumnoId == null) return
    setGuardando(true)
    setErroresValidacion([])
    setExito(false)
    setError(null)
    try {
      const res = await fetch('/api/portal-inscripciones/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId, formulario: form }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.errores?.length) {
          setErroresValidacion(data.errores)
          const primeraFalta = SECCIONES_SOLICITUD_ORDEN.find(
            (id) => !seccionSolicitudCompleta(form, id)
          )
          if (primeraFalta) setSeccion(primeraFalta)
        } else setError(data.error ?? 'No se pudo guardar.')
      } else {
        setExito(true)
        setTimeout(() => router.push('/portal-inscripciones'), 1200)
      }
    } catch {
      setError('Error de conexión al guardar.')
    }
    setGuardando(false)
  }

  const setAlumno = (patch: Partial<SolicitudInscripcionFormulario['alumno']>) =>
    setForm((f) => ({ ...f, alumno: { ...f.alumno, ...patch } }))

  const setMedico = (patch: Partial<SolicitudInscripcionFormulario['medico']>) =>
    setForm((f) => ({ ...f, medico: { ...f.medico, ...patch } }))

  const setMama = (patch: Partial<SolicitudInscripcionFormulario['mama']>) =>
    setForm((f) => ({ ...f, mama: { ...f.mama, ...patch } }))

  const setPapa = (patch: Partial<SolicitudInscripcionFormulario['papa']>) =>
    setForm((f) => ({ ...f, papa: { ...f.papa, ...patch } }))

  const setEmergencia = (patch: Partial<SolicitudInscripcionFormulario['emergencia']>) =>
    setForm((f) => ({ ...f, emergencia: { ...f.emergencia, ...patch } }))

  const setAutorizado = (
    idx: number,
    patch: Partial<SolicitudInscripcionFormulario['autorizados'][number]>
  ) =>
    setForm((f) => {
      const autorizados = [...f.autorizados]
      autorizados[idx] = { ...autorizados[idx], ...patch }
      return { ...f, autorizados }
    })

  const agregarAutorizado = () =>
    setForm((f) => ({
      ...f,
      autorizados: [...f.autorizados, { ...SOLICITUD_CONTACTO_VACIO }],
    }))

  const indiceSeccion = SECCIONES.findIndex((s) => s.id === seccion)
  const seccionActual = SECCIONES[indiceSeccion] ?? SECCIONES[0]
  const progresoSeccion = Math.round(((indiceSeccion + 1) / SECCIONES.length) * 100)
  const erroresPorSeccion = mapaErroresPorSeccion(form)
  const seccionesCompletas = Object.fromEntries(
    SECCIONES_SOLICITUD_ORDEN.map((id) => [id, seccionSolicitudCompleta(form, id)])
  ) as Record<SeccionSolicitudId, boolean>
  const faltanEtiquetas = SECCIONES_SOLICITUD_ORDEN.filter((id) => !seccionesCompletas[id]).map(
    (id) => ETIQUETA_SECCION_SOLICITUD[id]
  )
  const IconoSeccion = iconoSeccion(seccion)

  const irSeccion = (dir: -1 | 1) => {
    const next = indiceSeccion + dir
    if (next >= 0 && next < SECCIONES.length) {
      setSeccion(SECCIONES[next].id)
    }
  }

  if (cargando) {
    return (
      <div className="portal-inscripciones-estado">
        <Loader2 size={20} className="portal-inscripciones-spin" aria-hidden />
        Cargando solicitud…
      </div>
    )
  }

  return (
    <div className="pi-form-page">
      <header className="pi-form-header">
        <Link href="/portal-inscripciones" className="servicios-back-btn">
          <ArrowLeft size={16} aria-hidden />
          Volver al proceso
        </Link>
        <div className="pi-form-hero">
          <div>
            <p className="portal-inscripciones-kicker">Formulario en línea</p>
            <h1 className="dashboard-title portal-inscripciones-titulo">Solicitud de inscripción</h1>
            <p className="dashboard-subtitle portal-inscripciones-lead">
              Completa las 5 secciones (deben quedar en amarillo). Al guardar se habilitan los
              pagos del ciclo.
            </p>
          </div>
          <div
            className="pi-form-progreso-mini"
            style={{ '--pi-form-pct': progresoSeccion } as CSSProperties}
            aria-hidden
          >
            <span className="pi-form-progreso-mini-valor">{progresoSeccion}%</span>
            <span className="pi-form-progreso-mini-label">
              Sección {indiceSeccion + 1} de {SECCIONES.length}
            </span>
          </div>
        </div>
      </header>

      <div className="pi-form-progreso-track" aria-hidden>
        <div className="pi-form-progreso-track-fill" style={{ width: `${progresoSeccion}%` }} />
      </div>

      <nav className="pi-form-stepper" aria-label="Secciones del formulario">
        {SECCIONES.map((s, i) => {
          const Icon = s.icon
          const activa = seccion === s.id
          const completa = seccionesCompletas[s.id]
          return (
            <button
              key={s.id}
              type="button"
              className={`pi-form-step${activa ? ' pi-form-step--activa' : ''}${completa ? ' pi-form-step--completa' : ''}`}
              data-accent={completa ? 'amber' : s.accent}
              onClick={() => setSeccion(s.id)}
              aria-current={activa ? 'step' : undefined}
              title={
                completa
                  ? `${s.label}: completa`
                  : `${s.label}: pendiente (${erroresPorSeccion[s.id].length} dato(s) faltante(s))`
              }
            >
              <span className="pi-form-step-num">{i + 1}</span>
              <span className="pi-form-step-icon" aria-hidden>
                <Icon size={16} />
              </span>
              <span className="pi-form-step-label">{s.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="pi-form-shell">
      {faltanEtiquetas.length > 0 && !exito && (
        <div className="portal-inscripciones-alerta portal-inscripciones-alerta--aviso" role="status">
          {faltanEtiquetas.length === 1
            ? `Te falta completar la sección ${faltanEtiquetas[0]} (debe quedar en amarillo).`
            : `Te falta completar: ${faltanEtiquetas.join(', ')}. Todas las pestañas deben quedar en amarillo antes de guardar.`}
        </div>
      )}

      {error && (
        <div className="portal-inscripciones-alerta portal-inscripciones-alerta--error" role="alert">
          {error}
        </div>
      )}

      {erroresValidacion.length > 0 && (
        <div className="portal-inscripciones-alerta portal-inscripciones-alerta--error" role="alert">
          <ul className="pi-form-errores-lista">
            {erroresValidacion.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {exito && (
        <div className="portal-inscripciones-alerta portal-inscripciones-alerta--aviso" role="status">
          <CheckCircle2 size={18} aria-hidden />
          Solicitud guardada. Redirigiendo al proceso…
        </div>
      )}

      <div key={seccion} className="pi-form-panel" data-accent={seccionActual.accent}>
        <div className="pi-form-section-head" data-accent={seccionActual.accent}>
          <div className="pi-form-section-icon" aria-hidden>
            <IconoSeccion size={22} />
          </div>
          <div>
            <h2 className="pi-form-section-title">{seccionActual.label}</h2>
            <p className="pi-form-section-hint">{seccionActual.hint}</p>
          </div>
        </div>

        {seccion === 'alumno' && (
          <div className="pi-form-grid">
            <Campo label="Fecha de nacimiento" required>
              <input
                type="date"
                className="pi-form-input"
                value={form.alumno.fechaNacimiento}
                onChange={(e) => setAlumno({ fechaNacimiento: e.target.value })}
              />
            </Campo>
            <Campo label="Lugar de nacimiento" required>
              <input
                className="pi-form-input"
                value={form.alumno.lugarNacimiento}
                onChange={(e) => setAlumno({ lugarNacimiento: e.target.value })}
              />
            </Campo>
            <Campo label="CURP" required>
              <input
                className="pi-form-input"
                value={form.alumno.curp}
                onChange={(e) => setAlumno({ curp: e.target.value.toUpperCase() })}
                maxLength={18}
              />
            </Campo>
            <Campo label="Sexo" required>
              <select
                className="pi-form-input"
                value={form.alumno.sexo}
                onChange={(e) => setAlumno({ sexo: e.target.value })}
              >
                <option value="">Selecciona…</option>
                {SEXO_ALUMNO_OPCIONES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Calle" required>
              <input className="pi-form-input" value={form.alumno.calle} onChange={(e) => setAlumno({ calle: e.target.value })} />
            </Campo>
            <Campo label="Entre calles">
              <input className="pi-form-input" value={form.alumno.entreCalles} onChange={(e) => setAlumno({ entreCalles: e.target.value })} />
            </Campo>
            <Campo label="No. exterior" required>
              <input className="pi-form-input" value={form.alumno.numeroExt} onChange={(e) => setAlumno({ numeroExt: e.target.value })} />
            </Campo>
            <Campo label="No. interior">
              <input className="pi-form-input" value={form.alumno.numeroInt} onChange={(e) => setAlumno({ numeroInt: e.target.value })} />
            </Campo>
            <Campo label="Colonia" required>
              <input className="pi-form-input" value={form.alumno.colonia} onChange={(e) => setAlumno({ colonia: e.target.value })} />
            </Campo>
            <Campo label="C.P." required>
              <input className="pi-form-input" value={form.alumno.cp} onChange={(e) => setAlumno({ cp: e.target.value })} />
            </Campo>
            <Campo label="Ciudad" required>
              <input className="pi-form-input" value={form.alumno.ciudad} onChange={(e) => setAlumno({ ciudad: e.target.value })} />
            </Campo>
            <Campo label="Estado" required>
              <input className="pi-form-input" value={form.alumno.estado} onChange={(e) => setAlumno({ estado: e.target.value })} />
            </Campo>
            <Campo label="Escuela de procedencia" required>
              <input
                className="pi-form-input pi-form-input--wide"
                value={form.alumno.escuelaProcedente}
                onChange={(e) => setAlumno({ escuelaProcedente: e.target.value })}
              />
            </Campo>
          </div>
        )}

        {seccion === 'salud' && (
          <div className="pi-form-grid">
            <Campo label="Peso (kg)" required>
              <input className="pi-form-input" value={form.medico.peso} onChange={(e) => setMedico({ peso: e.target.value })} />
            </Campo>
            <Campo label="Estatura (m)" required>
              <input className="pi-form-input" value={form.medico.estatura} onChange={(e) => setMedico({ estatura: e.target.value })} />
            </Campo>
            <Campo label="Tipo de sangre" required>
              <input className="pi-form-input" value={form.medico.tipoSangre} onChange={(e) => setMedico({ tipoSangre: e.target.value })} />
            </Campo>
            <Campo label="¿Alérgico a algún medicamento?" required>
              <input className="pi-form-input" value={form.medico.alergias} onChange={(e) => setMedico({ alergias: e.target.value })} />
            </Campo>
            <Campo label="¿Padece alguna enfermedad?" required>
              <select
                className="pi-form-input"
                value={form.medico.tienePadecimiento}
                onChange={(e) => setMedico({ tienePadecimiento: e.target.value })}
              >
                <option value="">Selecciona…</option>
                <option value="0">No</option>
                <option value="1">Sí</option>
              </select>
            </Campo>
            {form.medico.tienePadecimiento === '1' && (
              <Campo label="¿Cuál padecimiento?" required>
                <input className="pi-form-input" value={form.medico.padecimiento} onChange={(e) => setMedico({ padecimiento: e.target.value })} />
              </Campo>
            )}
            <Campo label="¿Requiere tomar medicina en horario escolar?" required>
              <select
                className="pi-form-input"
                value={form.medico.requiereMedicina}
                onChange={(e) => setMedico({ requiereMedicina: e.target.value })}
              >
                <option value="">Selecciona…</option>
                <option value="0">No</option>
                <option value="1">Sí</option>
              </select>
            </Campo>
            {form.medico.requiereMedicina === '1' && (
              <Campo label="Medicina" required>
                <input className="pi-form-input" value={form.medico.medicina} onChange={(e) => setMedico({ medicina: e.target.value })} />
              </Campo>
            )}
            <Campo label="Medicamentos que no debe suministrarse">
              <input className="pi-form-input" value={form.medico.suministrar} onChange={(e) => setMedico({ suministrar: e.target.value })} />
            </Campo>
            <Campo label="Otros medicamentos">
              <input className="pi-form-input" value={form.medico.medicamentos} onChange={(e) => setMedico({ medicamentos: e.target.value })} />
            </Campo>
            <Campo label="No. afiliación IMSS/ISSTE">
              <input className="pi-form-input" value={form.medico.afiliacion} onChange={(e) => setMedico({ afiliacion: e.target.value })} />
            </Campo>
            <Campo label="Servicio médico particular">
              <input className="pi-form-input" value={form.medico.afiliacionExterna} onChange={(e) => setMedico({ afiliacionExterna: e.target.value })} />
            </Campo>
          </div>
        )}

        {(seccion === 'mama' || seccion === 'papa') && (() => {
          const esMama = seccion === 'mama'
          const f = esMama ? form.mama : form.papa
          const setF = esMama ? setMama : setPapa
          return (
            <div className="pi-form-grid">
              <Campo label="Apellido paterno" required>
                <input className="pi-form-input" value={f.apellidoPaterno} onChange={(e) => setF({ apellidoPaterno: e.target.value })} />
              </Campo>
              <Campo label="Apellido materno" required>
                <input className="pi-form-input" value={f.apellidoMaterno} onChange={(e) => setF({ apellidoMaterno: e.target.value })} />
              </Campo>
              <Campo label="Nombre(s)" required>
                <input className="pi-form-input" value={f.nombre} onChange={(e) => setF({ nombre: e.target.value })} />
              </Campo>
              <Campo label="Celular" required>
                <input className="pi-form-input" value={f.celular} onChange={(e) => setF({ celular: e.target.value })} />
              </Campo>
              <Campo label="Correo electrónico" required>
                <input type="email" className="pi-form-input" value={f.email} onChange={(e) => setF({ email: e.target.value })} />
              </Campo>
              <Campo label="CURP">
                <input className="pi-form-input" value={f.curp} onChange={(e) => setF({ curp: e.target.value.toUpperCase() })} maxLength={18} />
              </Campo>
              <Campo
                label="RFC"
                hint="Opcional. Puedes dejarlo en blanco o poner *."
              >
                <input
                  className="pi-form-input"
                  value={f.rfc}
                  onChange={(e) => setF({ rfc: e.target.value.toUpperCase() })}
                  placeholder="En blanco o *"
                  maxLength={13}
                  autoComplete="off"
                />
              </Campo>
              <Campo label="Fecha de nacimiento">
                <input type="date" className="pi-form-input" value={f.fechaNacimiento} onChange={(e) => setF({ fechaNacimiento: e.target.value })} />
              </Campo>
              <Campo label="Escolaridad">
                <input className="pi-form-input" value={f.escolaridad} onChange={(e) => setF({ escolaridad: e.target.value })} />
              </Campo>
              <Campo label="Empresa">
                <input className="pi-form-input" value={f.empresaNombre} onChange={(e) => setF({ empresaNombre: e.target.value })} />
              </Campo>
              <Campo label="Puesto">
                <input className="pi-form-input" value={f.puesto} onChange={(e) => setF({ puesto: e.target.value })} />
              </Campo>
              <Campo label="Tel. trabajo">
                <input className="pi-form-input" value={f.telefonoTrabajo} onChange={(e) => setF({ telefonoTrabajo: e.target.value })} />
              </Campo>
            </div>
          )
        })()}

        {seccion === 'contactos' && (
          <div className="pi-form-contactos">
            <h2 className="pi-form-subtitulo">Contacto de emergencia</h2>
            <div className="pi-form-grid">
              <Campo label="Nombre" required>
                <input className="pi-form-input" value={form.emergencia.nombre} onChange={(e) => setEmergencia({ nombre: e.target.value })} />
              </Campo>
              <Campo label="Parentesco">
                <input className="pi-form-input" value={form.emergencia.parentesco} onChange={(e) => setEmergencia({ parentesco: e.target.value })} />
              </Campo>
              <Campo label="Teléfono">
                <input className="pi-form-input" value={form.emergencia.telefono} onChange={(e) => setEmergencia({ telefono: e.target.value })} />
              </Campo>
              <Campo label="Celular">
                <input className="pi-form-input" value={form.emergencia.celular} onChange={(e) => setEmergencia({ celular: e.target.value })} />
              </Campo>
            </div>

            <h2 className="pi-form-subtitulo">Personas autorizadas para recoger al alumno</h2>
            {form.autorizados.map((aut, idx) => (
              <div key={idx} className="pi-form-autorizado">
                <span className="pi-form-autorizado-label">Persona {idx + 1}</span>
                <div className="pi-form-grid">
                  <Campo label="Nombre" required>
                    <input className="pi-form-input" value={aut.nombre} onChange={(e) => setAutorizado(idx, { nombre: e.target.value })} />
                  </Campo>
                  <Campo label="Parentesco">
                    <input className="pi-form-input" value={aut.parentesco} onChange={(e) => setAutorizado(idx, { parentesco: e.target.value })} />
                  </Campo>
                  <Campo label="Teléfono">
                    <input className="pi-form-input" value={aut.telefono} onChange={(e) => setAutorizado(idx, { telefono: e.target.value })} />
                  </Campo>
                  <Campo label="Celular">
                    <input className="pi-form-input" value={aut.celular} onChange={(e) => setAutorizado(idx, { celular: e.target.value })} />
                  </Campo>
                </div>
              </div>
            ))}
            <button type="button" className="pi-form-btn-sec" onClick={agregarAutorizado}>
              + Agregar otra persona
            </button>
          </div>
        )}
      </div>

      <footer className="pi-form-footer">
        <div className="pi-form-footer-nav">
          <button
            type="button"
            className="pi-form-btn-nav"
            onClick={() => irSeccion(-1)}
            disabled={indiceSeccion === 0}
          >
            <ChevronLeft size={18} aria-hidden />
            Anterior
          </button>
          {indiceSeccion < SECCIONES.length - 1 && (
            <button type="button" className="pi-form-btn-nav pi-form-btn-nav--sig" onClick={() => irSeccion(1)}>
              Siguiente
              <ChevronRight size={18} aria-hidden />
            </button>
          )}
        </div>
        <button
          type="button"
          className="pi-form-btn-guardar"
          onClick={() => void guardar()}
          disabled={guardando || exito}
        >
          {guardando ? (
            <Loader2 size={18} className="portal-inscripciones-spin" aria-hidden />
          ) : (
            <Save size={18} aria-hidden />
          )}
          Guardar solicitud
          <ArrowRight size={16} aria-hidden />
        </button>
      </footer>
      </div>
    </div>
  )
}
