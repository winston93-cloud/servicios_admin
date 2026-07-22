'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { exportarUsuariosExcel } from '@/lib/exportarUsuariosExcel'
import {
  fetchActualizarUsuario,
  fetchCrearUsuario,
  fetchEliminarUsuario,
  fetchUsuariosCatalogo,
  nombreCompletoUsuario,
  type UsuarioInput,
  type UsuarioRegistro,
} from '@/lib/usuarioCatalogoService'

const FORM_VACIO: UsuarioInput = {
  perfil_id: 6,
  usuario_app: '',
  usuario_apm: '',
  usuario_nombre: '',
  usuario_username: '',
  usuario_email: '',
  usuario_password: '',
  usuario_status: 1,
  nivel: 0,
}

type Props = {
  abierto: boolean
  onCerrar: () => void
}

export default function UsuariosCatalogoModal({ abierto, onCerrar }: Props) {
  const { user } = useAuth()
  const [lista, setLista] = useState<UsuarioRegistro[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<UsuarioInput>(FORM_VACIO)
  const [mostrarClave, setMostrarClave] = useState(false)
  const [clavesVisibles, setClavesVisibles] = useState<Set<number>>(new Set())

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setLista(await fetchUsuariosCatalogo())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios')
      setLista([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!abierto) return
    void cargar()
  }, [abierto, cargar])

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return lista
    return lista.filter((u) => {
      const blob = [
        u.usuario_id,
        u.usuario_username,
        u.usuario_nombre,
        u.usuario_app,
        u.usuario_apm,
        u.usuario_email,
        u.perfil_id,
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(t)
    })
  }, [lista, busqueda])

  const abrirAlta = () => {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setMostrarClave(false)
    setFormAbierto(true)
    setMensaje(null)
    setError(null)
  }

  const abrirEdicion = (u: UsuarioRegistro) => {
    setEditandoId(u.usuario_id)
    setForm({
      perfil_id: u.perfil_id,
      usuario_app: u.usuario_app ?? '',
      usuario_apm: u.usuario_apm ?? '',
      usuario_nombre: u.usuario_nombre ?? '',
      usuario_username: u.usuario_username,
      usuario_email: u.usuario_email ?? '',
      usuario_password: u.usuario_password ?? '',
      usuario_status: Number(u.usuario_status) === 0 ? 0 : 1,
      nivel: Number(u.nivel ?? 0),
    })
    setMostrarClave(false)
    setFormAbierto(true)
    setMensaje(null)
    setError(null)
  }

  const cerrarForm = () => {
    setFormAbierto(false)
    setEditandoId(null)
    setForm(FORM_VACIO)
  }

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      if (editandoId != null) {
        await fetchActualizarUsuario(editandoId, form)
        setMensaje('Usuario actualizado.')
      } else {
        await fetchCrearUsuario(form)
        setMensaje('Usuario creado.')
      }
      cerrarForm()
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const onEliminar = async (u: UsuarioRegistro) => {
    if (
      user?.usuario_username &&
      u.usuario_username.toLowerCase() === user.usuario_username.toLowerCase()
    ) {
      setError('No puedes eliminar tu propio usuario de sesión.')
      return
    }
    if (
      !window.confirm(
        `¿Eliminar al usuario «${u.usuario_username}» (${nombreCompletoUsuario(u) || 'sin nombre'})?`
      )
    ) {
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await fetchEliminarUsuario(u.usuario_id)
      setMensaje('Usuario eliminado.')
      if (editandoId === u.usuario_id) cerrarForm()
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setGuardando(false)
    }
  }

  const onExcel = async () => {
    setExportando(true)
    setError(null)
    try {
      const data = lista.length ? lista : await fetchUsuariosCatalogo()
      if (!data.length) {
        setError('No hay registros para exportar.')
        return
      }
      await exportarUsuariosExcel(data)
      setMensaje(`Excel generado (${data.length} usuarios).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el Excel')
    } finally {
      setExportando(false)
    }
  }

  const toggleClaveFila = (id: number) => {
    setClavesVisibles((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!abierto) return null

  return (
    <div className="usr-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="usr-modal-title">
      <div className="usr-modal">
        <header className="usr-modal-header">
          <div>
            <p className="usr-modal-kicker">Catálogo CRUD</p>
            <h2 id="usr-modal-title" className="usr-modal-title">
              Usuarios del sistema
            </h2>
            <p className="usr-modal-lead">
              Alta, edición y baja de personal administrativo (tabla <code>usuario</code>).
            </p>
          </div>
          <button type="button" className="usr-modal-close" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="usr-modal-toolbar">
          <label className="usr-search">
            <Search size={20} aria-hidden />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, username, email…"
            />
          </label>
          <div className="usr-toolbar-actions">
            <button
              type="button"
              className="usr-btn usr-btn--excel"
              onClick={() => void onExcel()}
              disabled={exportando || cargando}
            >
              {exportando ? <Loader2 size={18} className="usr-spin" /> : <FileSpreadsheet size={18} />}
              Generar Excel
            </button>
            <button type="button" className="usr-btn usr-btn--primary" onClick={abrirAlta}>
              <Plus size={18} />
              Nuevo usuario
            </button>
          </div>
        </div>

        {error && (
          <p className="usr-alert usr-alert--err" role="alert">
            {error}
          </p>
        )}
        {mensaje && (
          <p className="usr-alert usr-alert--ok" role="status">
            {mensaje}
          </p>
        )}

        <div className="usr-table-wrap">
          {cargando ? (
            <div className="usr-loading">
              <Loader2 className="usr-spin" size={22} />
              Cargando usuarios…
            </div>
          ) : (
            <table className="usr-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Clave</th>
                  <th>Perfil</th>
                  <th>Nivel</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.usuario_id} data-inactivo={Number(u.usuario_status) !== 1 ? '1' : undefined}>
                    <td>{u.usuario_id}</td>
                    <td>
                      <code>{u.usuario_username}</code>
                    </td>
                    <td>{nombreCompletoUsuario(u) || '—'}</td>
                    <td>{u.usuario_email || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="usr-clave-btn"
                        onClick={() => toggleClaveFila(u.usuario_id)}
                        title={clavesVisibles.has(u.usuario_id) ? 'Ocultar' : 'Ver clave'}
                      >
                        {clavesVisibles.has(u.usuario_id) ? (
                          <>
                            <EyeOff size={14} /> {u.usuario_password}
                          </>
                        ) : (
                          <>
                            <Eye size={14} /> ••••••
                          </>
                        )}
                      </button>
                    </td>
                    <td>{u.perfil_id ?? '—'}</td>
                    <td>{u.nivel ?? '—'}</td>
                    <td>
                      <span
                        className={
                          Number(u.usuario_status) === 1
                            ? 'usr-badge usr-badge--ok'
                            : 'usr-badge usr-badge--off'
                        }
                      >
                        {Number(u.usuario_status) === 1 ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="usr-row-actions">
                        <button
                          type="button"
                          className="usr-icon-btn"
                          onClick={() => abrirEdicion(u)}
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="usr-icon-btn usr-icon-btn--danger"
                          onClick={() => void onEliminar(u)}
                          title="Eliminar"
                          disabled={guardando}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtrados.length && (
                  <tr>
                    <td colSpan={9} className="usr-empty">
                      No hay usuarios con ese criterio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <footer className="usr-modal-footer">
          <span>
            {filtrados.length} de {lista.length} usuario(s)
          </span>
          <button type="button" className="usr-btn usr-btn--ghost" onClick={onCerrar}>
            Cerrar
          </button>
        </footer>
      </div>

      {formAbierto && (
        <div className="usr-form-overlay">
          <form className="usr-form-card" onSubmit={(e) => void onGuardar(e)}>
            <header className="usr-form-head">
              <h3>{editandoId != null ? `Editar #${editandoId}` : 'Nuevo usuario'}</h3>
              <button type="button" className="usr-modal-close" onClick={cerrarForm} aria-label="Cerrar formulario">
                <X size={18} />
              </button>
            </header>

            <div className="usr-form-grid">
              <label>
                Username *
                <input
                  value={form.usuario_username}
                  onChange={(e) => setForm((f) => ({ ...f, usuario_username: e.target.value }))}
                  maxLength={20}
                  required
                  autoComplete="off"
                />
              </label>
              <label>
                Clave *
                <div className="usr-clave-fila">
                  <input
                    type={mostrarClave ? 'text' : 'password'}
                    value={form.usuario_password}
                    onChange={(e) => setForm((f) => ({ ...f, usuario_password: e.target.value }))}
                    maxLength={255}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="usr-icon-btn"
                    onClick={() => setMostrarClave((v) => !v)}
                    aria-label={mostrarClave ? 'Ocultar clave' : 'Ver clave'}
                  >
                    {mostrarClave ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label>
                Nombre
                <input
                  value={form.usuario_nombre}
                  onChange={(e) => setForm((f) => ({ ...f, usuario_nombre: e.target.value }))}
                  maxLength={50}
                />
              </label>
              <label>
                Apellido paterno
                <input
                  value={form.usuario_app}
                  onChange={(e) => setForm((f) => ({ ...f, usuario_app: e.target.value }))}
                  maxLength={50}
                />
              </label>
              <label>
                Apellido materno
                <input
                  value={form.usuario_apm}
                  onChange={(e) => setForm((f) => ({ ...f, usuario_apm: e.target.value }))}
                  maxLength={50}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.usuario_email}
                  onChange={(e) => setForm((f) => ({ ...f, usuario_email: e.target.value }))}
                  maxLength={100}
                />
              </label>
              <label>
                Perfil ID
                <input
                  type="number"
                  value={form.perfil_id ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      perfil_id: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Nivel
                <input
                  type="number"
                  value={form.nivel}
                  onChange={(e) => setForm((f) => ({ ...f, nivel: Number(e.target.value) || 0 }))}
                />
              </label>
              <label>
                Estatus
                <select
                  value={form.usuario_status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, usuario_status: Number(e.target.value) }))
                  }
                >
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </select>
              </label>
            </div>

            <div className="usr-form-actions">
              <button type="button" className="usr-btn usr-btn--ghost" onClick={cerrarForm}>
                Cancelar
              </button>
              <button type="submit" className="usr-btn usr-btn--primary" disabled={guardando}>
                {guardando ? <Loader2 size={16} className="usr-spin" /> : null}
                {editandoId != null ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
