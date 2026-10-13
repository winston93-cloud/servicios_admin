'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import type { PortalTeacherData } from '@/lib/teamEnglish/teService'
import { ESTADOS_CURSO, MODALIDADES, TE_MAX_ARCHIVO_MB, fechaCorta, type TeCurso, type TeCursoSugerido } from '@/lib/teamEnglish/teTypes'
import { leerJson, teAbrirArchivo, validarTamano } from '../teApi'
import { ACEPTAR_DOCS, Campo, Hoja, SelectorArchivo, Vacio } from '../components/ui'

type Props = {
  data: PortalTeacherData
  setData: (d: PortalTeacherData) => void
  onOk: (t: string) => void
  onError: (t: string) => void
}

export type BorradorCurso = {
  id?: number
  titulo: string
  institucion: string
  modalidad: TeCurso['modalidad']
  fecha: string
  horas: string
  notas: string
  archivoPrevio: string | null
}
type Borrador = BorradorCurso

/** «¡Lo tomé!» del curso del día: la teacher solo adjunta su constancia. */
export function borradorDeSugerido(s: TeCursoSugerido, hoy: string): BorradorCurso {
  return {
    titulo: s.titulo,
    institucion: s.institucion ?? '',
    modalidad: s.modalidad,
    fecha: hoy,
    horas: s.horas == null ? '' : String(s.horas),
    notas: `📌 Curso del día · ${s.enlace}`,
    archivoPrevio: null,
  }
}

export default function MisCursos({ data, setData, onOk, onError, borrador, setBorrador }: Props & {
  borrador: BorradorCurso | null
  setBorrador: (b: BorradorCurso | null) => void
}) {
  const [borrando, setBorrando] = useState<number | null>(null)

  const validados = data.cursos.filter((c) => c.estado === 'validado')
  const horas = validados.reduce((s, c) => s + (c.horas ?? 0), 0)
  const proximas = data.capacitaciones.filter((c) => c.estado === 'programada' && (c.fecha_fin ?? c.fecha_inicio) >= data.hoy)

  const nuevo = (): Borrador => ({ titulo: '', institucion: '', modalidad: 'en_linea', fecha: data.hoy, horas: '', notas: '', archivoPrevio: null })
  const editar = (c: TeCurso): Borrador => ({
    id: c.id,
    titulo: c.titulo,
    institucion: c.institucion ?? '',
    modalidad: c.modalidad,
    fecha: c.fecha,
    horas: c.horas == null ? '' : String(c.horas),
    notas: c.notas,
    archivoPrevio: c.archivo_nombre ?? 'constancia',
  })

  const eliminar = async (c: TeCurso) => {
    if (!window.confirm(`¿Borrar «${c.titulo}» y su constancia?`)) return
    setBorrando(c.id)
    try {
      const res = await fetch(`/api/team-english/teacher/cursos?id=${c.id}`, { method: 'DELETE' })
      setData((await leerJson(res)) as unknown as PortalTeacherData)
      onOk('Curso borrado.')
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBorrando(null)
    }
  }

  return (
    <>
      <dl className="te-mini-stats te-mini-stats-3">
        <div><dt>🏅 Cursos validados</dt><dd>{validados.length}</dd></div>
        <div><dt>⏱️ Horas validadas</dt><dd>{horas}</dd></div>
        <div><dt>⏳ Por validar</dt><dd>{data.cursos.filter((c) => c.estado === 'pendiente').length}</dd></div>
      </dl>

      <div className="te-toolbar">
        <p className="te-nota te-min0">Sube la constancia o diploma de cada curso que termines; tu directora lo valida.</p>
        <button type="button" className="te-btn te-btn-primary" onClick={() => setBorrador(nuevo())}>
          <Plus size={16} aria-hidden /> Subir curso
        </button>
      </div>

      {!data.cursos.length ? (
        <Vacio emoji="🏅" titulo="Aún no has subido cursos">
          Webinars, certificaciones, diplomados… todo cuenta para tu formación.
        </Vacio>
      ) : (
        <ul className="te-historial">
          {data.cursos.map((c) => (
            <li key={c.id} data-estado={c.estado}>
              <span className="te-sello">{ESTADOS_CURSO[c.estado].emoji} {ESTADOS_CURSO[c.estado].etiqueta}</span>
              <span className="te-min0">
                <b>{c.titulo}</b>
                <small>
                  {fechaCorta(c.fecha)} · {MODALIDADES[c.modalidad]}{c.horas ? ` · ${c.horas} h` : ''}{c.institucion ? ` · ${c.institucion}` : ''}
                </small>
                {c.comentario ? <small className="te-plan-comentario">✏️ Tu directora: {c.comentario}</small> : null}
              </span>
              <span className="te-fila-botones te-historial-acciones">
                <button type="button" className="te-btn te-btn-ghost te-btn-sm" aria-label={`Ver constancia de ${c.titulo}`}
                  onClick={() => teAbrirArchivo(c.archivo_key, false).catch((e) => onError(e.message))}>📎</button>
                {c.estado !== 'validado' ? (
                  <>
                    <button type="button" className="te-icon-btn" aria-label={`Corregir ${c.titulo}`} onClick={() => setBorrador(editar(c))}>
                      <Pencil size={16} aria-hidden />
                    </button>
                    <button type="button" className="te-icon-btn" aria-label={`Borrar ${c.titulo}`} disabled={borrando === c.id} onClick={() => void eliminar(c)}>
                      {borrando === c.id ? <Loader2 size={16} className="te-spin" aria-hidden /> : <Trash2 size={16} aria-hidden />}
                    </button>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="te-subtitulo">🎓 Capacitaciones de la escuela</h2>
      {!data.capacitaciones.length ? (
        <Vacio emoji="🎓" titulo="Sin capacitaciones registradas" />
      ) : (
        <ul className="te-historial">
          {data.capacitaciones.map((c) => {
            const p = c.participantes[0]
            return (
              <li key={c.id}>
                <span className="te-sello">{proximas.includes(c) ? '🗓️ Próxima' : c.estado === 'realizada' ? '🎉 Realizada' : c.estado === 'cancelada' ? '🚫 Cancelada' : '🗓️ Programada'}</span>
                <span className="te-min0">
                  <b>{c.titulo}</b>
                  <small>{fechaCorta(c.fecha_inicio)} · {c.tipo === 'interna' ? 'Interna' : 'Externa'} · {MODALIDADES[c.modalidad]}{c.horas ? ` · ${c.horas} h` : ''}{c.lugar ? ` · 📍 ${c.lugar}` : ''}</small>
                </span>
                {p?.constancia_key ? (
                  <button type="button" className="te-btn te-btn-ghost te-btn-sm" aria-label={`Ver constancia de ${c.titulo}`}
                    onClick={() => teAbrirArchivo(p.constancia_key!, false).catch((e) => onError(e.message))}>🏅</button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <FormCurso borrador={borrador} setBorrador={setBorrador} hoy={data.hoy} setData={setData} onOk={onOk} onError={onError} />
    </>
  )
}

function FormCurso({ borrador, setBorrador, hoy, setData, onOk, onError }: Omit<Props, 'data'> & {
  borrador: Borrador | null
  setBorrador: (b: Borrador | null) => void
  hoy: string
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  if (!borrador) return null
  const b = borrador
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setBorrador({ ...b, [k]: v })

  const cerrar = () => {
    setArchivo(null)
    setBorrador(null)
  }

  const enviar = async () => {
    setEnviando(true)
    try {
      validarTamano(archivo)
      const form = new FormData()
      if (b.id) form.set('id', String(b.id))
      form.set('titulo', b.titulo)
      form.set('institucion', b.institucion)
      form.set('modalidad', b.modalidad)
      form.set('fecha', b.fecha)
      form.set('horas', b.horas)
      form.set('notas', b.notas)
      if (archivo) form.set('archivo', archivo)
      const res = await fetch('/api/team-english/teacher/cursos', { method: 'POST', body: form })
      setData((await leerJson(res)) as unknown as PortalTeacherData)
      onOk(b.id ? 'Curso corregido; tu directora lo revisará de nuevo. 💌' : '¡Curso enviado! Tu directora lo validará. 🏅')
      cerrar()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Hoja abierta titulo={b.id ? 'Corregir curso' : 'Subir curso'} emoji="🏅" onCerrar={cerrar}
      pie={
        <>
          <button type="button" className="te-btn te-btn-ghost" onClick={cerrar}>Cancelar</button>
          <button type="button" className="te-btn te-btn-primary" disabled={enviando || !b.titulo.trim() || !b.fecha || (!archivo && !b.archivoPrevio)} onClick={() => void enviar()}>
            {enviando ? <Loader2 size={16} className="te-spin" aria-hidden /> : <Upload size={16} aria-hidden />} {b.id ? 'Guardar' : 'Enviar curso'}
          </button>
        </>
      }>
      <div className="te-form">
        <Campo etiqueta="Nombre del curso" completo>
          <input className="te-input" value={b.titulo} maxLength={200} placeholder="Teaching phonics to young learners" onChange={(e) => set('titulo', e.target.value)} />
        </Campo>
        <Campo etiqueta="Institución (opcional)">
          <input className="te-input" value={b.institucion} maxLength={200} placeholder="Cambridge, British Council…" onChange={(e) => set('institucion', e.target.value)} />
        </Campo>
        <Campo etiqueta="Modalidad">
          <select className="te-input" value={b.modalidad} onChange={(e) => set('modalidad', e.target.value as Borrador['modalidad'])}>
            {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Fecha en que lo terminaste">
          <input className="te-input" type="date" value={b.fecha} max={hoy} onChange={(e) => set('fecha', e.target.value)} />
        </Campo>
        <Campo etiqueta="Horas (opcional)">
          <input className="te-input" type="number" min={0} step={0.5} inputMode="decimal" value={b.horas} onChange={(e) => set('horas', e.target.value)} />
        </Campo>
        <Campo etiqueta="Notas para tu directora (opcional)" completo>
          <textarea className="te-input" rows={2} value={b.notas} maxLength={2000} onChange={(e) => set('notas', e.target.value)} />
        </Campo>
        <div className="te-campo" data-completo>
          <SelectorArchivo etiqueta={b.archivoPrevio ? `Reemplazar constancia (opcional) · actual: ${b.archivoPrevio}` : 'Constancia o diploma'} archivo={archivo} onArchivo={setArchivo} aceptar={ACEPTAR_DOCS} />
          <span className="te-campo-ayuda">PDF o imagen (también Word) · máximo {TE_MAX_ARCHIVO_MB} MB.</span>
        </div>
      </div>
    </Hoja>
  )
}
