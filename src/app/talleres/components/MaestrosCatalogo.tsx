'use client'

import { useMemo, useState } from 'react'
import { Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react'
import {
  NIVELES_TALLER,
  nombreMaestroTaller,
  type TallerMaestro,
} from '@/lib/talleres/talleresTypes'
import { Campo, NivelesBadges, NivelesChips, TlModal } from './TalleresUi'

type Borrador = {
  id?: number
  nombre: string
  apellido_paterno: string
  apellido_materno: string
  email: string
  celular: string
  especialidad: string
  niveles: number[]
  notas: string
  activo: boolean
}

const VACIO: Borrador = {
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  email: '',
  celular: '',
  especialidad: '',
  niveles: [],
  notas: '',
  activo: true,
}

export default function MaestrosCatalogo({
  maestros,
  usoPorMaestro,
  guardando,
  onGuardar,
  onEliminar,
}: {
  maestros: TallerMaestro[]
  usoPorMaestro: Map<number, number>
  guardando: boolean
  onGuardar: (b: Record<string, unknown>) => Promise<boolean>
  onEliminar: (m: TallerMaestro) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [nivel, setNivel] = useState(0)
  const [borrador, setBorrador] = useState<Borrador | null>(null)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return maestros.filter(
      (m) =>
        (!q || `${nombreMaestroTaller(m)} ${m.especialidad ?? ''}`.toLowerCase().includes(q)) &&
        (!nivel || m.niveles.includes(nivel))
    )
  }, [maestros, busqueda, nivel])

  const guardar = async () => {
    if (!borrador) return
    const ok = await onGuardar({ recurso: 'maestro', ...borrador })
    if (ok) setBorrador(null)
  }

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => borrador && setBorrador({ ...borrador, [k]: v })

  return (
    <section className="tl-panel" aria-label="Catálogo de maestros de taller">
      <div className="tl-toolbar">
        <div className="tl-search">
          <Search size={16} aria-hidden />
          <input className="tl-input" placeholder="Buscar maestro o especialidad…" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar maestro" />
        </div>
        <select className="tl-input tl-select-sm" value={nivel} onChange={(e) => setNivel(Number(e.target.value))} aria-label="Filtrar por nivel">
          <option value={0}>Todos los niveles</option>
          {NIVELES_TALLER.map((n) => (
            <option key={n.valor} value={n.valor}>{n.etiqueta}</option>
          ))}
        </select>
        <button type="button" className="tl-btn tl-btn-primary" onClick={() => setBorrador({ ...VACIO })}>
          <Plus size={16} aria-hidden /> Nuevo maestro
        </button>
      </div>

      {filtrados.length === 0 ? (
        <p className="tl-empty">
          {maestros.length ? 'Ningún maestro coincide con el filtro.' : 'Aún no hay maestros de taller. Registra el primero con «Nuevo maestro».'}
        </p>
      ) : (
        <div className="tl-table-wrap">
          <table className="tl-table">
            <thead>
              <tr>
                <th>Maestro</th>
                <th>Contacto</th>
                <th>Niveles</th>
                <th className="tl-num">Talleres</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id} data-inactivo={!m.activo || undefined}>
                  <td>
                    <strong>{nombreMaestroTaller(m)}</strong>
                    {m.especialidad ? <span className="tl-desc">{m.especialidad}</span> : null}
                  </td>
                  <td>
                    <span className="tl-contacto">
                      {m.email ? <a href={`mailto:${m.email}`}><Mail size={14} aria-hidden /> {m.email}</a> : null}
                      {m.celular ? <a href={`tel:${m.celular}`}><Phone size={14} aria-hidden /> {m.celular}</a> : null}
                      {!m.email && !m.celular ? <span className="tl-muted">—</span> : null}
                    </span>
                  </td>
                  <td><NivelesBadges niveles={m.niveles} /></td>
                  <td className="tl-num">{usoPorMaestro.get(m.id) ?? 0}</td>
                  <td>
                    <span className="tl-estado" data-activo={m.activo || undefined}>{m.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="tl-acciones">
                    <button
                      type="button"
                      className="tl-icon-btn"
                      aria-label={`Editar ${nombreMaestroTaller(m)}`}
                      onClick={() =>
                        setBorrador({
                          id: m.id,
                          nombre: m.nombre,
                          apellido_paterno: m.apellido_paterno ?? '',
                          apellido_materno: m.apellido_materno ?? '',
                          email: m.email ?? '',
                          celular: m.celular ?? '',
                          especialidad: m.especialidad ?? '',
                          niveles: m.niveles,
                          notas: m.notas ?? '',
                          activo: m.activo,
                        })
                      }
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                    <button type="button" className="tl-icon-btn tl-danger" aria-label={`Eliminar ${nombreMaestroTaller(m)}`} onClick={() => onEliminar(m)}>
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TlModal
        abierto={Boolean(borrador)}
        titulo={borrador?.id ? 'Editar maestro de taller' : 'Nuevo maestro de taller'}
        subtitulo="Datos de contacto y niveles que atiende."
        onCerrar={() => !guardando && setBorrador(null)}
        pie={
          <>
            <button type="button" className="tl-btn" onClick={() => setBorrador(null)} disabled={guardando}>Cancelar</button>
            <button
              type="button"
              className="tl-btn tl-btn-primary"
              onClick={() => void guardar()}
              disabled={guardando || !borrador?.nombre.trim() || !borrador?.niveles.length}
              title={!borrador?.nombre.trim() ? 'Escribe el nombre del maestro' : !borrador?.niveles.length ? 'Elige al menos un nivel' : undefined}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        {borrador ? (
          <div className="tl-form-grid">
            <Campo etiqueta="Nombre(s) *">
              <input className="tl-input" value={borrador.nombre} maxLength={80} autoFocus onChange={(e) => set('nombre', e.target.value)} />
            </Campo>
            <Campo etiqueta="Apellido paterno">
              <input className="tl-input" value={borrador.apellido_paterno} maxLength={80} onChange={(e) => set('apellido_paterno', e.target.value)} />
            </Campo>
            <Campo etiqueta="Apellido materno">
              <input className="tl-input" value={borrador.apellido_materno} maxLength={80} onChange={(e) => set('apellido_materno', e.target.value)} />
            </Campo>
            <Campo etiqueta="Especialidad" ayuda="Ej. Ajedrez, Karate, Música">
              <input className="tl-input" value={borrador.especialidad} maxLength={120} onChange={(e) => set('especialidad', e.target.value)} />
            </Campo>
            <Campo etiqueta="Correo">
              <input className="tl-input" type="email" inputMode="email" value={borrador.email} maxLength={160} onChange={(e) => set('email', e.target.value)} />
            </Campo>
            <Campo etiqueta="Celular">
              <input className="tl-input" type="tel" inputMode="tel" value={borrador.celular} maxLength={30} onChange={(e) => set('celular', e.target.value)} />
            </Campo>
            <Campo etiqueta="Niveles que atiende *" completo grupo>
              <NivelesChips valor={borrador.niveles} onChange={(niveles) => set('niveles', niveles)} />
            </Campo>
            <Campo etiqueta="Notas" completo>
              <textarea className="tl-input tl-textarea" rows={3} value={borrador.notas} maxLength={2000} onChange={(e) => set('notas', e.target.value)} />
            </Campo>
            <label className="tl-switch" data-completo>
              <input type="checkbox" checked={borrador.activo} onChange={(e) => set('activo', e.target.checked)} />
              <span>Maestro activo (disponible para asignar)</span>
            </label>
          </div>
        ) : null}
      </TlModal>
    </section>
  )
}
