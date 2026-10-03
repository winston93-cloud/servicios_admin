'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  CATEGORIAS_TALLER,
  COLORES_TALLER,
  NIVELES_TALLER,
  nombreTallerCompleto,
  type Taller,
} from '@/lib/talleres/talleresTypes'
import { Campo, NivelesBadges, NivelesChips, TlModal } from './TalleresUi'

type Borrador = {
  id?: number
  nombre: string
  grados: string
  categoria: string
  descripcion: string
  niveles: number[]
  color: string
  cupo_min: string
  cupo_max: string
  activo: boolean
}

const VACIO: Borrador = {
  nombre: '',
  grados: '',
  categoria: '',
  descripcion: '',
  niveles: [],
  color: COLORES_TALLER[0],
  cupo_min: '',
  cupo_max: '',
  activo: true,
}

function etiquetaCupoTaller(t: Taller): string {
  if (t.cupo_min && t.cupo_max) return `${t.cupo_min} a ${t.cupo_max}`
  if (t.cupo_max) return `Máx. ${t.cupo_max}`
  if (t.cupo_min) return `Mín. ${t.cupo_min}`
  return '—'
}

export default function TalleresCatalogo({
  talleres,
  usoPorTaller,
  guardando,
  onGuardar,
  onEliminar,
}: {
  talleres: Taller[]
  usoPorTaller: Map<number, number>
  guardando: boolean
  onGuardar: (b: Record<string, unknown>) => Promise<boolean>
  onEliminar: (t: Taller) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [nivel, setNivel] = useState(0)
  const [borrador, setBorrador] = useState<Borrador | null>(null)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return talleres.filter(
      (t) =>
        (!q || `${nombreTallerCompleto(t)} ${t.categoria ?? ''}`.toLowerCase().includes(q)) &&
        (!nivel || t.niveles.includes(nivel))
    )
  }, [talleres, busqueda, nivel])

  const abrirNuevo = () =>
    setBorrador({ ...VACIO, color: COLORES_TALLER[talleres.length % COLORES_TALLER.length] })

  const guardar = async () => {
    if (!borrador) return
    const ok = await onGuardar({ recurso: 'taller', ...borrador })
    if (ok) setBorrador(null)
  }

  return (
    <section className="tl-panel" aria-label="Catálogo de talleres">
      <div className="tl-toolbar">
        <div className="tl-search">
          <Search size={16} aria-hidden />
          <input
            className="tl-input"
            placeholder="Buscar taller…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar taller"
          />
        </div>
        <select className="tl-input tl-select-sm" value={nivel} onChange={(e) => setNivel(Number(e.target.value))} aria-label="Filtrar por nivel">
          <option value={0}>Todos los niveles</option>
          {NIVELES_TALLER.map((n) => (
            <option key={n.valor} value={n.valor}>{n.etiqueta}</option>
          ))}
        </select>
        <button type="button" className="tl-btn tl-btn-primary" onClick={abrirNuevo}>
          <Plus size={16} aria-hidden /> Nuevo taller
        </button>
      </div>

      {filtrados.length === 0 ? (
        <p className="tl-empty">
          {talleres.length ? 'Ningún taller coincide con el filtro.' : 'Aún no hay talleres. Registra el primero con «Nuevo taller».'}
        </p>
      ) : (
        <div className="tl-table-wrap">
          <table className="tl-table">
            <thead>
              <tr>
                <th>Taller</th>
                <th>Niveles</th>
                <th className="tl-num">Cupo</th>
                <th className="tl-num">Horarios</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} data-inactivo={!t.activo || undefined}>
                  <td>
                    <span className="tl-nombre-color">
                      <span className="tl-dot" style={{ background: t.color ?? COLORES_TALLER[0] }} aria-hidden />
                      <span className="tl-min0">
                        <strong>{t.nombre}</strong>
                        {t.grados ? <span className="tl-sub"> {t.grados}</span> : null}
                        {t.categoria ? <span className="tl-cat">{t.categoria}</span> : null}
                        {t.descripcion ? <span className="tl-desc">{t.descripcion}</span> : null}
                      </span>
                    </span>
                  </td>
                  <td><NivelesBadges niveles={t.niveles} /></td>
                  <td className="tl-num tl-nowrap">{etiquetaCupoTaller(t)}</td>
                  <td className="tl-num">{usoPorTaller.get(t.id) ?? 0}</td>
                  <td>
                    <span className="tl-estado" data-activo={t.activo || undefined}>{t.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="tl-acciones">
                    <button
                      type="button"
                      className="tl-icon-btn"
                      aria-label={`Editar ${t.nombre}`}
                      onClick={() =>
                        setBorrador({
                          id: t.id,
                          nombre: t.nombre,
                          grados: t.grados ?? '',
                          categoria: t.categoria ?? '',
                          descripcion: t.descripcion ?? '',
                          niveles: t.niveles,
                          color: t.color ?? COLORES_TALLER[0],
                          cupo_min: t.cupo_min ? String(t.cupo_min) : '',
                          cupo_max: t.cupo_max ? String(t.cupo_max) : '',
                          activo: t.activo,
                        })
                      }
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                    <button type="button" className="tl-icon-btn tl-danger" aria-label={`Eliminar ${t.nombre}`} onClick={() => onEliminar(t)}>
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
        titulo={borrador?.id ? 'Editar taller' : 'Nuevo taller'}
        subtitulo="Nombre, grados y niveles en los que se ofrece."
        onCerrar={() => !guardando && setBorrador(null)}
        pie={
          <>
            <button type="button" className="tl-btn" onClick={() => setBorrador(null)} disabled={guardando}>Cancelar</button>
            <button
              type="button"
              className="tl-btn tl-btn-primary"
              onClick={() => void guardar()}
              disabled={guardando || !borrador?.nombre.trim() || !borrador?.niveles.length}
              title={!borrador?.nombre.trim() ? 'Escribe el nombre del taller' : !borrador?.niveles.length ? 'Elige al menos un nivel' : undefined}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        {borrador ? (
          <div className="tl-form-grid">
            <Campo etiqueta="Nombre del taller *">
              <input className="tl-input" value={borrador.nombre} maxLength={120} placeholder="Ej. Ajedrez" autoFocus
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} />
            </Campo>
            <Campo etiqueta="Grados" ayuda="Opcional. Ej. 1° a 3°, Principiantes">
              <input className="tl-input" value={borrador.grados} maxLength={60} placeholder="Ej. 1° a 3°"
                onChange={(e) => setBorrador({ ...borrador, grados: e.target.value })} />
            </Campo>
            <Campo etiqueta="Categoría" ayuda="Elige una o escribe otra">
              <input className="tl-input" list="tl-categorias" value={borrador.categoria} maxLength={40} placeholder="Ej. Deportivo"
                onChange={(e) => setBorrador({ ...borrador, categoria: e.target.value })} />
              <datalist id="tl-categorias">
                {CATEGORIAS_TALLER.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Campo>
            <Campo etiqueta="Niveles *" grupo>
              <NivelesChips valor={borrador.niveles} onChange={(niveles) => setBorrador({ ...borrador, niveles })} />
            </Campo>
            <Campo etiqueta="Cupo mínimo" ayuda="Alumnos necesarios para abrir el grupo">
              <input className="tl-input" type="number" inputMode="numeric" min={1} value={borrador.cupo_min} placeholder="Ej. 8"
                onChange={(e) => setBorrador({ ...borrador, cupo_min: e.target.value })} />
            </Campo>
            <Campo etiqueta="Cupo máximo" ayuda="Al llegar a este número el grupo se pone en rojo">
              <input className="tl-input" type="number" inputMode="numeric" min={1} value={borrador.cupo_max} placeholder="Ej. 20"
                onChange={(e) => setBorrador({ ...borrador, cupo_max: e.target.value })} />
            </Campo>
            {borrador.id ? (
              <p className="tl-ayuda-cupo" data-completo>
                Los grupos de este taller toman el nuevo cupo, salvo los que ya se ajustaron a mano en Programados.
              </p>
            ) : null}
            <Campo etiqueta="Color en el calendario" completo grupo>
              <div className="tl-colores" role="radiogroup" aria-label="Color">
                {COLORES_TALLER.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={borrador.color === c} aria-label={c}
                    className="tl-color" data-activo={borrador.color === c || undefined} style={{ background: c }}
                    onClick={() => setBorrador({ ...borrador, color: c })} />
                ))}
              </div>
            </Campo>
            <Campo etiqueta="Descripción" completo>
              <textarea className="tl-input tl-textarea" rows={3} value={borrador.descripcion} maxLength={2000}
                onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} />
            </Campo>
            <label className="tl-switch" data-completo>
              <input type="checkbox" checked={borrador.activo} onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })} />
              <span>Taller activo (disponible para asignar horarios)</span>
            </label>
          </div>
        ) : null}
      </TlModal>
    </section>
  )
}
