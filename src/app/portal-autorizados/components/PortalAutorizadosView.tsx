'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarPlus,
  Footprints,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  esStaffPreviewPanelPadres,
  PORTAL_AUTORIZADOS_PREVIEW_REFS,
  puedeVerModuloPortalAutorizados,
} from '@/lib/portalPadresPreview'
import type { AlumnoContactoRegistro } from '@/lib/alumnoContactoService'
import type { AlumnoCasoEspecialRegistro } from '@/lib/alumnoCasoEspecialService'
import { hoyMexicoIso } from '@/lib/alumnoCasoEspecialService'
import ThemeToggle from '@/components/ThemeToggle'
import { usePortalToast } from '@/components/PortalToast'

type AlumnoPortalAutorizados = {
  alumnoId: number
  alumnoRef: number
  nombre: string
}

type ModalPersona = {
  tipo: 'persona'
  contactoId: number | null
  nombre: string
  parentesco: string
  telefonoCasa: string
  celular: string
}

type ModalEspecial = {
  tipo: 'especial'
  fecha: string
  personaNombre: string
  parentesco: string
  telefono: string
  motivo: string
  contactoId: number | null
}

type ModalEstado = ModalPersona | ModalEspecial | null

function fechaMostrar(iso: string): string {
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function etiquetaFechaCorta(iso: string): string {
  const raw = String(iso).slice(0, 10)
  try {
    return new Date(`${raw}T12:00:00`).toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return fechaMostrar(raw)
  }
}

function esHoy(iso: string): boolean {
  return String(iso).slice(0, 10) === hoyMexicoIso()
}

function partesFechaBadge(iso: string): { dia: string; mes: string } {
  const raw = String(iso).slice(0, 10)
  try {
    const d = new Date(`${raw}T12:00:00`)
    return {
      dia: String(d.getDate()),
      mes: d.toLocaleDateString('es-MX', { month: 'short' }).replace(/\./g, ''),
    }
  } catch {
    return { dia: raw.slice(8, 10), mes: '' }
  }
}

export default function PortalAutorizadosView() {
  const router = useRouter()
  const { session } = useAuth()
  const esStaff = esStaffPreviewPanelPadres(session)
  const permitido = puedeVerModuloPortalAutorizados(session)
  const { toast, host } = usePortalToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const tituloModalId = useId()

  const [refBusqueda, setRefBusqueda] = useState(String(PORTAL_AUTORIZADOS_PREVIEW_REFS[0] ?? ''))
  const [alumno, setAlumno] = useState<AlumnoPortalAutorizados | null>(null)
  const [autorizados, setAutorizados] = useState<AlumnoContactoRegistro[]>([])
  const [especiales, setEspeciales] = useState<AlumnoCasoEspecialRegistro[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [modal, setModal] = useState<ModalEstado>(null)

  const aplicarPayload = useCallback(
    (data: {
      alumno?: AlumnoPortalAutorizados
      autorizados?: AlumnoContactoRegistro[]
      especiales?: AlumnoCasoEspecialRegistro[]
    }) => {
      if (data.alumno) setAlumno(data.alumno)
      setAutorizados(data.autorizados ?? [])
      setEspeciales(data.especiales ?? [])
    },
    []
  )

  const cargar = useCallback(
    async (opts?: { alumnoRef?: string; alumnoId?: number }) => {
      setCargando(true)
      try {
        const params = new URLSearchParams()
        if (opts?.alumnoRef) params.set('alumnoRef', opts.alumnoRef)
        if (opts?.alumnoId) params.set('alumnoId', String(opts.alumnoId))
        const res = await fetch(`/api/portal-autorizados?${params.toString()}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar.')
        aplicarPayload(data)
      } catch (e) {
        setAlumno(null)
        setAutorizados([])
        setEspeciales([])
        toastRef.current(e instanceof Error ? e.message : 'No se pudo cargar.', 'error')
      } finally {
        setCargando(false)
      }
    },
    [aplicarPayload]
  )

  useEffect(() => {
    if (!permitido) {
      router.replace('/dashboard')
      return
    }
    if (esStaff) {
      void cargar({ alumnoRef: String(PORTAL_AUTORIZADOS_PREVIEW_REFS[0]) })
      return
    }
    void cargar({ alumnoId: Number(session?.alumno_id) })
  }, [permitido, esStaff, session?.alumno_id, cargar, router])

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) setModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, guardando])

  useEffect(() => {
    if (!alumno || typeof window === 'undefined') return
    if (window.location.hash !== '#permiso-especial') return
    const el = document.getElementById('permiso-especial')
    if (!el) return
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [alumno])

  const post = async (body: Record<string, unknown>, mensajeOk: string): Promise<boolean> => {
    if (!alumno && !esStaff) return false
    setGuardando(true)
    try {
      const res = await fetch('/api/portal-autorizados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          alumnoId: alumno?.alumnoId,
          alumnoRef: alumno?.alumnoRef ?? refBusqueda.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.')
      aplicarPayload(data)
      toast(mensajeOk)
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar.', 'error')
      return false
    } finally {
      setGuardando(false)
    }
  }

  const abrirNuevaPersona = () => {
    setModal({
      tipo: 'persona',
      contactoId: null,
      nombre: '',
      parentesco: '',
      telefonoCasa: '',
      celular: '',
    })
  }

  const abrirEditarPersona = (reg: AlumnoContactoRegistro) => {
    setModal({
      tipo: 'persona',
      contactoId: reg.contacto_id,
      nombre: (reg.contacto_nombre ?? '').trim(),
      parentesco: (reg.tutor_clase ?? '').trim(),
      telefonoCasa: (reg.contacto_tel ?? '').trim(),
      celular: (reg.contacto_cel ?? '').trim(),
    })
  }

  const abrirNuevoEspecial = () => {
    setModal({
      tipo: 'especial',
      fecha: hoyMexicoIso(),
      personaNombre: '',
      parentesco: '',
      telefono: '',
      motivo: '',
      contactoId: null,
    })
  }

  const guardarModal = async () => {
    if (!modal) return
    if (modal.tipo === 'persona') {
      if (!modal.nombre.trim()) {
        toast('Indica el nombre.', 'error')
        return
      }
      const eraNuevo = modal.contactoId == null
      const ok = await post(
        {
          accion: 'guardar-persona',
          contactoId: modal.contactoId,
          nombre: modal.nombre,
          parentesco: modal.parentesco,
          telefonoCasa: modal.telefonoCasa,
          celular: modal.celular,
        },
        eraNuevo ? 'Persona agregada.' : 'Persona actualizada.'
      )
      if (ok) setModal(null)
      return
    }

    if (!modal.personaNombre.trim()) {
      toast('Indica quién pasará ese día.', 'error')
      return
    }
    if (!modal.fecha) {
      toast('Indica la fecha.', 'error')
      return
    }
    const ok = await post(
      {
        accion: 'guardar-especial',
        fecha: modal.fecha,
        personaNombre: modal.personaNombre,
        parentesco: modal.parentesco,
        telefono: modal.telefono,
        motivo: modal.motivo,
        contactoId: modal.contactoId,
      },
      'Día especial guardado.'
    )
    if (ok) setModal(null)
  }

  const eliminarPersona = (reg: AlumnoContactoRegistro) => {
    const etiqueta = (reg.contacto_nombre ?? 'esta persona').trim()
    if (!window.confirm(`¿Quitar a ${etiqueta} de la lista habitual?`)) return
    void post({ accion: 'eliminar-persona', contactoId: reg.contacto_id }, 'Persona eliminada.')
  }

  const eliminarEspecial = (caso: AlumnoCasoEspecialRegistro) => {
    if (!window.confirm(`¿Quitar el permiso del ${fechaMostrar(caso.fecha)}?`)) return
    void post({ accion: 'eliminar-especial', casoId: caso.caso_id }, 'Día especial eliminado.')
  }

  const volverDashboard = esStaff ? '/dashboard?vista=padres' : '/dashboard'

  return (
    <div className="dashboard-container dashboard-home portal-inscripciones-page portal-autorizados-page portal-padres-mod">
      <div className="dashboard-home-bg" aria-hidden />
      <div className="dashboard-main portal-inscripciones-main">
        <header className="portal-padres-encabezado">
          <div className="portal-autorizados-topbar">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push(volverDashboard)}
            >
              <ArrowLeft size={16} aria-hidden />
              Volver al inicio
            </button>
            <ThemeToggle />
          </div>
          <p className="portal-inscripciones-kicker">Recogida del alumno</p>
          <h1 className="dashboard-title portal-inscripciones-titulo">Personas autorizadas</h1>
          <p className="portal-padres-lead">
            Quién puede recoger al alumno de forma habitual o solo un día. La salida caminando se
            registra en <Link href="/portal-salida-pie">Salida a pie</Link>.
          </p>
          <nav className="portal-padres-modulos" aria-label="Módulos de recogida">
            <Link href="/portal-salida-pie" className="portal-padres-modulo">
              <Footprints size={16} aria-hidden />
              Salida a pie
            </Link>
            <span className="portal-padres-modulo is-on" aria-current="page">
              <Users size={16} aria-hidden />
              Personas autorizadas
            </span>
          </nav>
        </header>

        {esStaff ? (
          <form
            className="portal-padres-buscar"
            onSubmit={(e) => {
              e.preventDefault()
              if (!refBusqueda.trim()) return
              void cargar({ alumnoRef: refBusqueda.trim() })
            }}
          >
            <label htmlFor="portal_autorizados_ref" className="servicios-sr-only">
              Número de control
            </label>
            <input
              id="portal_autorizados_ref"
              className="alumno-form-input"
              inputMode="numeric"
              value={refBusqueda}
              onChange={(e) => setRefBusqueda(e.target.value)}
              placeholder="No. de control"
              autoComplete="off"
            />
            <button type="submit" className="portal-autorizados-btn-pri" disabled={cargando}>
              {cargando ? <Loader2 size={18} className="alumno-form-guardar-btn-icon" /> : null}
              Abrir
            </button>
          </form>
        ) : null}

        {cargando && !alumno ? (
          <div className="portal-padres-cargando" role="status">
            <Loader2 size={20} className="portal-inscripciones-spin" aria-hidden />
            Cargando…
          </div>
        ) : null}

        {alumno ? (
          <div className="portal-padres-cuerpo pa-stack pa-stack--row">
            <section className="pa-bloque" aria-labelledby="pa-hab-titulo">
              <div className="pa-bloque-head">
                <div>
                  <div className="pa-bloque-titulo-row">
                    <h2 id="pa-hab-titulo">Habituales</h2>
                    {autorizados.length > 0 ? (
                      <span className="pa-conteo">{autorizados.length}</span>
                    ) : null}
                  </div>
                  <p>Pueden recoger al alumno cualquier día.</p>
                </div>
                <button type="button" className="pa-btn-add" onClick={abrirNuevaPersona}>
                  <Plus size={18} aria-hidden />
                  Agregar
                </button>
              </div>

              {autorizados.length === 0 ? (
                <button type="button" className="pa-vacio" onClick={abrirNuevaPersona}>
                  <span className="pa-vacio-icono" aria-hidden>
                    <UserPlus size={22} />
                  </span>
                  <strong>Sin personas aún</strong>
                  <span>Agrega a quien suele recoger al alumno</span>
                </button>
              ) : (
                <ul className="pa-lista">
                  {autorizados.map((reg) => {
                    const nombre = (reg.contacto_nombre || 'Sin nombre').trim()
                    return (
                      <li key={reg.contacto_id} className="pa-fila">
                        <div className="pa-fila-texto">
                          <strong>{nombre}</strong>
                          <div className="pa-meta">
                            <span>{(reg.tutor_clase || 'Sin parentesco').trim()}</span>
                            {reg.contacto_cel ? <span>{reg.contacto_cel}</span> : null}
                          </div>
                        </div>
                        <div className="pa-fila-acciones">
                          <button
                            type="button"
                            className="pa-icon-btn"
                            onClick={() => abrirEditarPersona(reg)}
                            aria-label={`Editar ${nombre}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="pa-icon-btn pa-icon-btn--danger"
                            onClick={() => eliminarPersona(reg)}
                            disabled={guardando}
                            aria-label={`Eliminar ${nombre}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section
              id="permiso-especial"
              className="pa-bloque pa-bloque--especial"
              aria-labelledby="pa-esp-titulo"
            >
              <div className="pa-bloque-head">
                <div>
                  <div className="pa-bloque-titulo-row">
                    <h2 id="pa-esp-titulo">Solo un día</h2>
                    {especiales.length > 0 ? (
                      <span className="pa-conteo">{especiales.length}</span>
                    ) : null}
                  </div>
                  <p>Permiso puntual, sin dejarlo fijo en la lista.</p>
                </div>
                <button type="button" className="pa-btn-add" onClick={abrirNuevoEspecial}>
                  <CalendarPlus size={18} aria-hidden />
                  Día especial
                </button>
              </div>

              {especiales.length === 0 ? (
                <button type="button" className="pa-vacio" onClick={abrirNuevoEspecial}>
                  <span className="pa-vacio-icono" aria-hidden>
                    <CalendarPlus size={22} />
                  </span>
                  <strong>Sin días especiales</strong>
                  <span>Autoriza a alguien solo para una fecha</span>
                </button>
              ) : (
                <ul className="pa-lista">
                  {especiales.map((caso) => {
                    const nombre = (caso.persona_nombre || 'Sin nombre').trim()
                    const hoy = esHoy(caso.fecha)
                    const badge = partesFechaBadge(caso.fecha)
                    return (
                      <li key={caso.caso_id} className="pa-fila">
                        <span className={`pa-fecha-badge${hoy ? ' is-hoy' : ''}`}>
                          <span className="pa-fecha-badge-dia">{badge.dia}</span>
                          <span className="pa-fecha-badge-mes">{badge.mes}</span>
                        </span>
                        <div className="pa-fila-texto">
                          <strong>{nombre}</strong>
                          <div className="pa-meta">
                            {hoy ? <span className="pa-pill pa-pill--hoy">Hoy</span> : null}
                            <span>{etiquetaFechaCorta(caso.fecha)}</span>
                            {caso.parentesco ? <span>{caso.parentesco}</span> : null}
                            {caso.telefono ? <span>{caso.telefono}</span> : null}
                          </div>
                          {caso.motivo ? <em className="pa-fila-nota">{caso.motivo}</em> : null}
                        </div>
                        <div className="pa-fila-acciones">
                          <button
                            type="button"
                            className="pa-icon-btn pa-icon-btn--danger"
                            onClick={() => eliminarEspecial(caso)}
                            disabled={guardando}
                            aria-label={`Eliminar permiso de ${nombre}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>

      {modal ? (
        <div
          className="pa-modal-overlay"
          role="presentation"
          onClick={() => {
            if (!guardando) setModal(null)
          }}
        >
          <div
            className="pa-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloModalId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pa-modal-handle" aria-hidden />
            <header className="pa-modal-head">
              <div>
                <h2 id={tituloModalId}>
                  {modal.tipo === 'persona'
                    ? modal.contactoId
                      ? 'Editar persona'
                      : 'Nueva persona'
                    : 'Permiso de un día'}
                </h2>
                <p>
                  {modal.tipo === 'persona'
                    ? 'Quedará en la lista habitual.'
                    : 'Solo vale para la fecha indicada.'}
                </p>
              </div>
              <button
                type="button"
                className="pa-modal-cerrar"
                onClick={() => setModal(null)}
                disabled={guardando}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </header>

            <form
              className="pa-modal-body"
              onSubmit={(e) => {
                e.preventDefault()
                void guardarModal()
              }}
            >
              {modal.tipo === 'especial' ? (
                <>
                  <label className="alumno-form-label" htmlFor="pa_m_fecha">
                    Fecha
                  </label>
                  <input
                    id="pa_m_fecha"
                    className="alumno-form-input"
                    type="date"
                    min={hoyMexicoIso()}
                    value={modal.fecha}
                    onChange={(e) => setModal({ ...modal, fecha: e.target.value })}
                    required
                  />

                  <label className="alumno-form-label" htmlFor="pa_m_quien">
                    Quién pasa
                  </label>
                  <input
                    id="pa_m_quien"
                    className="alumno-form-input"
                    value={modal.personaNombre}
                    onChange={(e) => setModal({ ...modal, personaNombre: e.target.value })}
                    required
                    autoComplete="name"
                    autoFocus
                  />

                  <div className="pa-modal-2">
                    <div>
                      <label className="alumno-form-label" htmlFor="pa_m_par_e">
                        Parentesco
                      </label>
                      <input
                        id="pa_m_par_e"
                        className="alumno-form-input"
                        value={modal.parentesco}
                        onChange={(e) => setModal({ ...modal, parentesco: e.target.value })}
                        placeholder="Opcional"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="alumno-form-label" htmlFor="pa_m_tel_e">
                        Celular
                      </label>
                      <input
                        id="pa_m_tel_e"
                        className="alumno-form-input"
                        type="tel"
                        value={modal.telefono}
                        onChange={(e) => setModal({ ...modal, telefono: e.target.value })}
                        placeholder="Opcional"
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  <label className="alumno-form-label" htmlFor="pa_m_motivo">
                    Nota
                  </label>
                  <input
                    id="pa_m_motivo"
                    className="alumno-form-input"
                    value={modal.motivo}
                    onChange={(e) => setModal({ ...modal, motivo: e.target.value })}
                    placeholder="Opcional"
                    autoComplete="off"
                  />
                </>
              ) : (
                <>
                  <label className="alumno-form-label" htmlFor="pa_m_nombre">
                    Nombre
                  </label>
                  <input
                    id="pa_m_nombre"
                    className="alumno-form-input"
                    value={modal.nombre}
                    onChange={(e) => setModal({ ...modal, nombre: e.target.value })}
                    required
                    autoComplete="name"
                    autoFocus
                  />

                  <label className="alumno-form-label" htmlFor="pa_m_par">
                    Parentesco
                  </label>
                  <input
                    id="pa_m_par"
                    className="alumno-form-input"
                    value={modal.parentesco}
                    onChange={(e) => setModal({ ...modal, parentesco: e.target.value })}
                    placeholder="Mamá, papá, tía…"
                    autoComplete="off"
                  />

                  <div className="pa-modal-2">
                    <div>
                      <label className="alumno-form-label" htmlFor="pa_m_casa">
                        Tel. casa
                      </label>
                      <input
                        id="pa_m_casa"
                        className="alumno-form-input"
                        type="tel"
                        value={modal.telefonoCasa}
                        onChange={(e) => setModal({ ...modal, telefonoCasa: e.target.value })}
                        autoComplete="tel"
                      />
                    </div>
                    <div>
                      <label className="alumno-form-label" htmlFor="pa_m_cel">
                        Celular
                      </label>
                      <input
                        id="pa_m_cel"
                        className="alumno-form-input"
                        type="tel"
                        value={modal.celular}
                        onChange={(e) => setModal({ ...modal, celular: e.target.value })}
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pa-modal-foot">
                <button
                  type="button"
                  className="portal-autorizados-btn-sec"
                  onClick={() => setModal(null)}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button type="submit" className="portal-autorizados-btn-pri" disabled={guardando}>
                  {guardando ? <Loader2 size={18} className="portal-inscripciones-spin" /> : null}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {host}
    </div>
  )
}
