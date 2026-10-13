'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Pencil, Plus } from 'lucide-react'
import { COSTOS_SUGERIDO, MODALIDADES, SKILLS, cursoDelDia, skillDe, type CostoSugerido, type TeCursoSugerido } from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { teAccion } from '../teApi'
import { Campo, Hoja, Vacio } from './ui'

type Borrador = {
  id?: number
  titulo: string
  institucion: string
  modalidad: TeCursoSugerido['modalidad']
  enlace: string
  skill: string
  costo: CostoSugerido
  horas: string
  descripcion: string
  activo: boolean
}

const nuevo = (): Borrador => ({ titulo: '', institucion: '', modalidad: 'en_linea', enlace: '', skill: '', costo: 'gratis', horas: '', descripcion: '', activo: true })
const editar = (s: TeCursoSugerido): Borrador => ({
  id: s.id,
  titulo: s.titulo,
  institucion: s.institucion ?? '',
  modalidad: s.modalidad,
  enlace: s.enlace,
  skill: s.skill ?? '',
  costo: s.costo,
  horas: s.horas == null ? '' : String(s.horas),
  descripcion: s.descripcion,
  activo: s.activo,
})

/** Catálogo del «Curso del día» que ven las teachers en su portal. */
export default function SugeridosSeccion({ snap, recargar, avisar }: SeccionProps) {
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  const hoy = cursoDelDia(snap.sugeridos, snap.hoy)
  const activos = snap.sugeridos.filter((s) => s.activo).length

  const guardar = async (b: Borrador) => {
    setGuardando(true)
    try {
      await teAccion(snap.nivel, 'curso_sugerido', { ...b })
      await recargar()
      setBorrador(null)
      avisar(b.id ? 'Curso actualizado.' : '¡Curso agregado al catálogo! 📌')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (s: TeCursoSugerido) => {
    if (!window.confirm(`¿Quitar «${s.titulo}» del catálogo?`)) return
    try {
      await teAccion(snap.nivel, 'eliminar_curso_sugerido', { id: s.id })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  return (
    <>
      <div className="te-toolbar">
        <p className="te-nota te-min0">
          Las teachers ven un curso distinto cada día en su portal ({activos} activos). Si lo terminan, lo suben con «¡Lo tomé!» y aparece en «Cursos de teachers» para validarlo.
        </p>
        <button type="button" className="te-btn te-btn-primary" onClick={() => setBorrador(nuevo())}>
          <Plus size={16} aria-hidden /> Agregar curso
        </button>
      </div>

      {!snap.sugeridos.length ? (
        <Vacio emoji="📌" titulo="Aún no hay cursos recomendados" />
      ) : (
        <ul className="te-planes">
          {snap.sugeridos.map((s, i) => {
            const costo = COSTOS_SUGERIDO[s.costo]
            return (
              <li key={s.id} style={{ ['--i' as string]: i }}>
                <article className="te-plan" data-estado={s.activo ? (hoy?.id === s.id ? 'aprobada' : undefined) : 'falta'}>
                  <header className="te-plan-head">
                    <span className="te-grado-sticker" aria-hidden>{s.skill ? skillDe(s.skill).emoji : '🎓'}</span>
                    <div className="te-min0">
                      <strong>{s.titulo}</strong>
                      <small>{s.institucion ?? 'Sin institución'}</small>
                    </div>
                    {hoy?.id === s.id ? <span className="te-sello">📌 Hoy</span> : !s.activo ? <span className="te-sello">💤 Oculto</span> : null}
                  </header>
                  <p className="te-plan-meta">{costo.emoji} {costo.etiqueta} · {MODALIDADES[s.modalidad]}{s.horas ? ` · ${s.horas} h` : ''}</p>
                  {s.descripcion ? <p className="te-plan-notas">{s.descripcion}</p> : null}
                  <div className="te-fila-botones">
                    <a className="te-btn te-btn-sm" href={s.enlace} target="_blank" rel="noopener noreferrer">Ver <ExternalLink size={14} aria-hidden /></a>
                    <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => setBorrador(editar(s))}><Pencil size={14} aria-hidden /> Editar</button>
                    <button type="button" className="te-btn te-btn-ghost te-btn-sm" disabled={guardando}
                      onClick={() => void guardar({ ...editar(s), activo: !s.activo })}>
                      {s.activo ? '💤 Ocultar' : '👀 Mostrar'}
                    </button>
                    <button type="button" className="te-btn te-btn-ghost te-btn-sm te-peligro" aria-label={`Quitar ${s.titulo}`} onClick={() => void eliminar(s)}>🗑️</button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {borrador ? (
        <Hoja abierta titulo={borrador.id ? 'Editar curso recomendado' : 'Agregar curso recomendado'} emoji="📌" onCerrar={() => setBorrador(null)}
          pie={
            <>
              <button type="button" className="te-btn te-btn-ghost" onClick={() => setBorrador(null)}>Cancelar</button>
              <button type="button" className="te-btn te-btn-primary" disabled={guardando || !borrador.titulo.trim() || !borrador.enlace.trim()} onClick={() => void guardar(borrador)}>
                {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '📌'} Guardar
              </button>
            </>
          }>
          <div className="te-form">
            <Campo etiqueta="Nombre del curso" completo>
              <input className="te-input" value={borrador.titulo} maxLength={200} placeholder="Teaching phonics to young learners"
                onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} />
            </Campo>
            <Campo etiqueta="Enlace (https://…)" completo>
              <input className="te-input" type="url" inputMode="url" value={borrador.enlace} maxLength={500} placeholder="https://"
                onChange={(e) => setBorrador({ ...borrador, enlace: e.target.value })} />
            </Campo>
            <Campo etiqueta="Institución (opcional)">
              <input className="te-input" value={borrador.institucion} maxLength={200} placeholder="British Council, Cambridge…"
                onChange={(e) => setBorrador({ ...borrador, institucion: e.target.value })} />
            </Campo>
            <Campo etiqueta="Materia (opcional)">
              <select className="te-input" value={borrador.skill} onChange={(e) => setBorrador({ ...borrador, skill: e.target.value })}>
                <option value="">🎓 General</option>
                {SKILLS.map((s) => <option key={s.clave} value={s.clave}>{s.emoji} {s.etiqueta}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Costo">
              <select className="te-input" value={borrador.costo} onChange={(e) => setBorrador({ ...borrador, costo: e.target.value as CostoSugerido })}>
                {Object.entries(COSTOS_SUGERIDO).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.etiqueta}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Modalidad">
              <select className="te-input" value={borrador.modalidad} onChange={(e) => setBorrador({ ...borrador, modalidad: e.target.value as Borrador['modalidad'] })}>
                {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Horas (opcional)">
              <input className="te-input" type="number" min={0} step={0.5} inputMode="decimal" value={borrador.horas}
                onChange={(e) => setBorrador({ ...borrador, horas: e.target.value })} />
            </Campo>
            <Campo etiqueta="¿Por qué se lo recomiendas? (opcional)" completo>
              <textarea className="te-input" rows={3} value={borrador.descripcion} maxLength={600}
                onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} />
            </Campo>
          </div>
        </Hoja>
      ) : null}
    </>
  )
}
