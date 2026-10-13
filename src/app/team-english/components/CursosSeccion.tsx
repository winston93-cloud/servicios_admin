'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ESTADOS_CURSO, MODALIDADES, fechaCorta, type EstadoCurso, type TeCurso, type TeTeacher } from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { teAbrirArchivo, teAccion } from '../teApi'
import { Avatar, Vacio } from './ui'

type Filtro = 'todos' | EstadoCurso

export default function CursosSeccion({ snap, recargar, avisar }: SeccionProps) {
  const [filtro, setFiltro] = useState<Filtro>(() => (snap.cursos.some((c) => c.estado === 'pendiente') ? 'pendiente' : 'todos'))
  const [teacherId, setTeacherId] = useState<number | 'todas'>('todas')
  const teacherDe = useMemo(() => new Map(snap.teachers.map((t) => [t.maestro_id, t])), [snap.teachers])

  const validados = snap.cursos.filter((c) => c.estado === 'validado')
  const horas = validados.reduce((s, c) => s + (c.horas ?? 0), 0)
  const deTeacher = snap.cursos.filter((c) => teacherId === 'todas' || c.maestro_id === teacherId)
  const visibles = deTeacher.filter((c) => filtro === 'todos' || c.estado === filtro)
  const conCursos = snap.teachers.filter((t) => snap.cursos.some((c) => c.maestro_id === t.maestro_id))

  const chips: [Filtro, string][] = [
    ['pendiente', '⏳ Por validar'],
    ['validado', '🏅 Validados'],
    ['rechazado', '✏️ Rechazados'],
    ['todos', '🌈 Todos'],
  ]

  return (
    <>
      <dl className="te-mini-stats">
        <div><dt>🏅 Cursos validados</dt><dd>{validados.length}</dd></div>
        <div><dt>⏱️ Horas validadas</dt><dd>{horas}</dd></div>
        <div><dt>⏳ Por validar</dt><dd>{snap.cursos.filter((c) => c.estado === 'pendiente').length}</dd></div>
        <div><dt>👩‍🏫 Teachers con cursos</dt><dd>{conCursos.length}</dd></div>
      </dl>

      <div className="te-toolbar">
        <div className="te-filtros" role="radiogroup" aria-label="Filtrar por estado">
          {chips.map(([id, txt]) => (
            <button key={id} type="button" role="radio" aria-checked={filtro === id} data-activo={filtro === id || undefined} onClick={() => setFiltro(id)}>
              {txt} <b>{id === 'todos' ? deTeacher.length : deTeacher.filter((c) => c.estado === id).length}</b>
            </button>
          ))}
        </div>
        <select className="te-input te-select-sm" value={teacherId} aria-label="Teacher"
          onChange={(e) => setTeacherId(e.target.value === 'todas' ? 'todas' : Number(e.target.value))}>
          <option value="todas">Todas las teachers</option>
          {snap.teachers.map((t) => <option key={t.maestro_id} value={t.maestro_id}>{t.nombre}</option>)}
        </select>
      </div>

      {!visibles.length ? (
        <Vacio emoji={filtro === 'pendiente' ? '🎉' : '🏅'} titulo={filtro === 'pendiente' ? 'No hay cursos por validar' : 'Nada por aquí'}>
          {!snap.cursos.length ? 'Cuando una teacher suba la constancia de un curso desde su portal, aparecerá aquí para validarla.' : null}
        </Vacio>
      ) : (
        <ul className="te-planes">
          {visibles.map((c, i) => (
            <li key={c.id} style={{ ['--i' as string]: i }}>
              <TarjetaCurso curso={c} teacher={teacherDe.get(c.maestro_id)} snap={snap} recargar={recargar} avisar={avisar} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const DATA_ESTADO: Record<EstadoCurso, string> = { pendiente: 'pendiente', validado: 'aprobada', rechazado: 'cambios' }

function TarjetaCurso({ curso, teacher, snap, recargar, avisar }: SeccionProps & { curso: TeCurso; teacher: TeTeacher | undefined }) {
  const [rechazando, setRechazando] = useState(false)
  const [comentario, setComentario] = useState(curso.comentario)
  const [guardando, setGuardando] = useState(false)
  const nombre = teacher?.nombre ?? `Maestra #${curso.maestro_id}`

  const revisar = async (estado: EstadoCurso, texto = '') => {
    setGuardando(true)
    try {
      await teAccion(snap.nivel, 'revisar_curso', { id: curso.id, estado, comentario: texto })
      await recargar()
      setRechazando(false)
      avisar(estado === 'validado' ? '¡Curso validado! 🏅' : estado === 'rechazado' ? 'Se regresó a la teacher para que lo corrija.' : 'Regresó a «Por validar».')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar «${curso.titulo}» de ${nombre} y su constancia?`)) return
    try {
      await teAccion(snap.nivel, 'eliminar_curso', { id: curso.id })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const estado = ESTADOS_CURSO[curso.estado]
  return (
    <article className="te-plan" data-estado={DATA_ESTADO[curso.estado]}>
      <header className="te-plan-head">
        <Avatar emoji={teacher?.emoji ?? '🌷'} fotoKey={teacher?.foto_key} nombre={nombre} tam="sm" />
        <div className="te-min0">
          <strong>{nombre}</strong>
          <small>{fechaCorta(curso.fecha)} · {MODALIDADES[curso.modalidad]}{curso.horas ? ` · ${curso.horas} h` : ''}</small>
        </div>
        <span className="te-sello">{estado.emoji} {estado.etiqueta}</span>
      </header>
      <p className="te-plan-titulo">{curso.titulo}</p>
      {curso.institucion ? <p className="te-plan-meta">🏫 {curso.institucion}</p> : null}
      {curso.notas ? <p className="te-plan-notas">💬 {curso.notas}</p> : null}
      {curso.comentario && !rechazando ? <p className="te-plan-comentario">✏️ {curso.comentario}</p> : null}
      {curso.revisado_por && curso.estado !== 'pendiente' ? <p className="te-plan-meta">Revisó: {curso.revisado_por}</p> : null}

      {rechazando ? (
        <div className="te-plan-form">
          <textarea className="te-input" rows={3} value={comentario} autoFocus placeholder="¿Qué le falta? Ej. la constancia no trae su nombre o las horas…"
            onChange={(e) => setComentario(e.target.value)} />
          <div className="te-fila-botones te-fila-fin">
            <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => setRechazando(false)}>Cancelar</button>
            <button type="button" className="te-btn te-btn-cambios te-btn-sm" disabled={guardando || !comentario.trim()} onClick={() => void revisar('rechazado', comentario)}>
              {guardando ? <Loader2 size={14} className="te-spin" aria-hidden /> : '✏️'} Regresar a la teacher
            </button>
          </div>
        </div>
      ) : (
        <div className="te-fila-botones">
          <button type="button" className="te-btn te-btn-sm" onClick={() => teAbrirArchivo(curso.archivo_key).catch((e) => avisar(e.message, 'error'))}>
            📎 Ver constancia
          </button>
          {curso.estado !== 'validado' ? (
            <button type="button" className="te-btn te-btn-ok te-btn-sm" disabled={guardando} onClick={() => void revisar('validado')}>🏅 Validar</button>
          ) : (
            <button type="button" className="te-btn te-btn-ghost te-btn-sm" disabled={guardando} onClick={() => void revisar('pendiente', curso.comentario)}>↩️ Regresar a validar</button>
          )}
          {curso.estado === 'pendiente' ? (
            <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => { setComentario(curso.comentario); setRechazando(true) }}>✏️ Rechazar</button>
          ) : null}
          <button type="button" className="te-btn te-btn-ghost te-btn-sm te-peligro" aria-label="Eliminar curso" onClick={() => void eliminar()}>🗑️</button>
        </div>
      )}
    </article>
  )
}
