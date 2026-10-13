'use client'

import { useState, type DragEvent } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'
import {
  DIAS_PLAN,
  MATERIALES_CLASE,
  PLAN_MAX_BLOQUES_DIA,
  SKILLS,
  bloqueTieneTexto,
  bloqueVacio,
  fechaCorta,
  materialDe,
  skillDe,
  sumarDias,
  type DiaClave,
  type PlanBloque,
  type PlanContenido,
  type SkillClave,
} from '@/lib/teamEnglish/teTypes'

const MIME_SKILL = 'application/x-te-skill'
const MIME_BLOQUE = 'application/x-te-bloque'

/** Tras soltar una materia, el bloque nuevo se monta en el siguiente render. */
function enfocarTema(dia: DiaClave, i: number) {
  window.setTimeout(() => {
    const el = document.getElementById(`te-tema-${dia}-${i}`)
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, 60)
}

/** Lienzo editable de la semana: tema, objetivo y por día un bloque por materia (como en Classroom). */
export function PlanLienzoEditor({ valor, onCambiar, lunes }: { valor: PlanContenido; onCambiar: (v: PlanContenido) => void; lunes: string }) {
  /** Materia elegida con un toque (móvil/teclado) que espera a que toquen el día. */
  const [armada, setArmada] = useState<SkillClave | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [sobre, setSobre] = useState<DiaClave | null>(null)

  const setDia = (dia: DiaClave, bloques: PlanBloque[]) => onCambiar({ ...valor, dias: { ...valor.dias, [dia]: bloques } })
  const agregar = (dia: DiaClave, skill: SkillClave) => {
    const lista = valor.dias[dia]
    if (lista.length >= PLAN_MAX_BLOQUES_DIA) return
    const previo = lista.at(-1)
    setDia(dia, [...lista, bloqueVacio(skill, previo ? previo.materiales : ['classwork', 'pencil_case'])])
    setArmada(null)
    enfocarTema(dia, lista.length)
  }
  const moverADia = (origen: DiaClave, i: number, destino: DiaClave) => {
    const b = valor.dias[origen][i]
    if (!b || origen === destino || valor.dias[destino].length >= PLAN_MAX_BLOQUES_DIA) return
    onCambiar({
      ...valor,
      dias: { ...valor.dias, [origen]: valor.dias[origen].filter((_, j) => j !== i), [destino]: [...valor.dias[destino], b] },
    })
  }
  const soltar = (e: DragEvent, dia: DiaClave) => {
    e.preventDefault()
    setSobre(null)
    setArrastrando(false)
    const skill = e.dataTransfer.getData(MIME_SKILL)
    if (skill) return agregar(dia, skillDe(skill).clave)
    const [origen, i] = e.dataTransfer.getData(MIME_BLOQUE).split(':')
    if (origen) moverADia(origen as DiaClave, Number(i), dia)
  }
  const sobreDia = (e: DragEvent, dia: DiaClave) => {
    const t = e.dataTransfer.types
    if (!t.includes(MIME_SKILL) && !t.includes(MIME_BLOQUE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = t.includes(MIME_BLOQUE) ? 'move' : 'copy'
    if (sobre !== dia) setSobre(dia)
  }
  const salirDia = (e: DragEvent, dia: DiaClave) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre((s) => (s === dia ? null : s))
  }
  const finArrastre = () => {
    setArrastrando(false)
    setSobre(null)
  }
  const fichaArmada = armada ? skillDe(armada) : null
  const cambiarBloque = (dia: DiaClave, i: number, cambios: Partial<PlanBloque>) =>
    setDia(dia, valor.dias[dia].map((b, j) => (j === i ? { ...b, ...cambios } : b)))
  const quitar = (dia: DiaClave, i: number) => {
    const b = valor.dias[dia][i]
    if (bloqueTieneTexto(b) && !window.confirm(`¿Quitar ${skillDe(b.skill).etiqueta} del ${DIAS_PLAN.find((d) => d.clave === dia)?.es.toLowerCase()}?`)) return
    setDia(dia, valor.dias[dia].filter((_, j) => j !== i))
  }
  const mover = (dia: DiaClave, i: number, delta: -1 | 1) => {
    const l = [...valor.dias[dia]]
    const j = i + delta
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    setDia(dia, l)
  }

  return (
    <div className="te-lienzo" data-arrastrando={arrastrando || !!armada || undefined}>
      <div className="te-lienzo-cabeza">
        <label className="te-campo">
          <span className="te-campo-label">🌈 Unit / tema de la semana</span>
          <input className="te-input" value={valor.unidad} maxLength={200} placeholder="Unit 3 · Animals around us"
            onChange={(e) => onCambiar({ ...valor, unidad: e.target.value })} />
        </label>
        <label className="te-campo">
          <span className="te-campo-label">🎯 Objetivo de la semana</span>
          <textarea className="te-input" rows={2} value={valor.objetivo} maxLength={1500} placeholder="Students will describe animals using adjectives and the present simple."
            onChange={(e) => onCambiar({ ...valor, objetivo: e.target.value })} />
        </label>
      </div>

      <div className="te-paleta" role="group" aria-label="Materias para armar la semana">
        <p className="te-paleta-ayuda" aria-live="polite">
          {fichaArmada ? (
            <>Ahora toca <b>«Soltar aquí»</b> en el día de {fichaArmada.emoji} {fichaArmada.etiqueta}</>
          ) : (
            <>✋ Arrastra cada materia a su día · o tócala y luego toca el día</>
          )}
        </p>
        <div className="te-paleta-fichas">
          {SKILLS.map((s) => (
            <button key={s.clave} type="button" draggable className="te-skill te-ficha" data-skill={s.clave} aria-pressed={armada === s.clave}
              onDragStart={(e) => {
                e.dataTransfer.setData(MIME_SKILL, s.clave)
                e.dataTransfer.effectAllowed = 'copy'
                setArmada(null)
                setArrastrando(true)
              }}
              onDragEnd={finArrastre}
              onClick={() => setArmada((a) => (a === s.clave ? null : s.clave))}>
              <span aria-hidden>{s.emoji}</span> {s.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <ol className="te-lienzo-dias">
        {DIAS_PLAN.map((d, di) => {
          const bloques = valor.dias[d.clave]
          const lleno = bloques.length >= PLAN_MAX_BLOQUES_DIA
          return (
            <li key={d.clave} className="te-dia" style={{ ['--i' as string]: di }} data-sobre={sobre === d.clave || undefined} data-lleno={lleno || undefined}
              onDragOver={(e) => sobreDia(e, d.clave)} onDragLeave={(e) => salirDia(e, d.clave)} onDrop={(e) => soltar(e, d.clave)}>
              <header className="te-dia-head">
                <span className="te-dia-nombre">{d.en}</span>
                <small>{d.es} · {fechaCorta(sumarDias(lunes, d.offset))}</small>
              </header>

              {bloques.length ? (
                <ul className="te-bloques">
                  {bloques.map((b, i) => {
                    const sk = skillDe(b.skill)
                    return (
                      <li key={i} className="te-bloque" data-skill={b.skill}>
                        <div className="te-bloque-head">
                          <span className="te-bloque-agarre" draggable title="Arrastra para pasarla a otro día" aria-hidden
                            onDragStart={(e) => {
                              e.dataTransfer.setData(MIME_BLOQUE, `${d.clave}:${i}`)
                              e.dataTransfer.effectAllowed = 'move'
                              const tarjeta = e.currentTarget.closest('li')
                              if (tarjeta) e.dataTransfer.setDragImage(tarjeta, 24, 24)
                              setArrastrando(true)
                            }}
                            onDragEnd={finArrastre}>
                            <GripVertical size={14} />
                          </span>
                          <span className="te-bloque-emoji" aria-hidden>{sk.emoji}</span>
                          <select className="te-bloque-skill" value={b.skill} aria-label={`Skill del bloque ${i + 1} del ${d.es}`}
                            onChange={(e) => cambiarBloque(d.clave, i, { skill: e.target.value as SkillClave })}>
                            {SKILLS.map((s) => <option key={s.clave} value={s.clave}>{s.emoji} {s.etiqueta}</option>)}
                          </select>
                          <span className="te-bloque-acciones">
                            {bloques.length > 1 ? (
                              <>
                                <button type="button" className="te-mini-btn" aria-label="Subir" disabled={i === 0} onClick={() => mover(d.clave, i, -1)}><ArrowUp size={14} aria-hidden /></button>
                                <button type="button" className="te-mini-btn" aria-label="Bajar" disabled={i === bloques.length - 1} onClick={() => mover(d.clave, i, 1)}><ArrowDown size={14} aria-hidden /></button>
                              </>
                            ) : null}
                            <button type="button" className="te-mini-btn" aria-label={`Quitar ${sk.etiqueta}`} onClick={() => quitar(d.clave, i)}><Trash2 size={14} aria-hidden /></button>
                          </span>
                        </div>
                        <input id={`te-tema-${d.clave}-${i}`} className="te-input te-bloque-tema" value={b.tema} maxLength={200} placeholder="Topic · ej. Reflexive pronouns"
                          aria-label={`Topic de ${sk.etiqueta}`} onChange={(e) => cambiarBloque(d.clave, i, { tema: e.target.value })} />
                        <label className="te-bloque-campo">
                          <span>📝 Classwork</span>
                          <textarea className="te-input" rows={3} value={b.actividades} maxLength={3000} placeholder="Activity Book p. 26-27 · Watch video explanation"
                            onChange={(e) => cambiarBloque(d.clave, i, { actividades: e.target.value })} />
                        </label>
                        <label className="te-bloque-campo">
                          <span>✋ Participation</span>
                          <input className="te-input" value={b.participacion} maxLength={1000} placeholder="Kahoot · Turn and talk (opcional)"
                            onChange={(e) => cambiarBloque(d.clave, i, { participacion: e.target.value })} />
                        </label>
                        <label className="te-bloque-campo">
                          <span>📒 Homework</span>
                          <input className="te-input" value={b.tarea} maxLength={1000} placeholder="HW #4 · Print the worksheet… (opcional)"
                            onChange={(e) => cambiarBloque(d.clave, i, { tarea: e.target.value })} />
                        </label>
                        <div className="te-bloque-campo" role="group" aria-label={`Class materials de ${sk.etiqueta}`}>
                          <span>🎒 Class materials</span>
                          <div className="te-materiales">
                            {MATERIALES_CLASE.map((m) => {
                              const on = b.materiales.includes(m.clave)
                              return (
                                <button key={m.clave} type="button" className="te-material" aria-pressed={on}
                                  onClick={() => cambiarBloque(d.clave, i, { materiales: on ? b.materiales.filter((x) => x !== m.clave) : [...b.materiales, m.clave] })}>
                                  <span aria-hidden>{m.emoji}</span> {m.etiqueta}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <input className="te-input" value={b.recursos} maxLength={1000} placeholder="🔗 Recursos · video, worksheet, link (opcional)"
                          aria-label={`Recursos de ${sk.etiqueta}`} onChange={(e) => cambiarBloque(d.clave, i, { recursos: e.target.value })} />
                      </li>
                    )
                  })}
                </ul>
              ) : null}

              {fichaArmada && !lleno ? (
                <button type="button" className="te-dia-soltar" onClick={() => agregar(d.clave, fichaArmada.clave)}>
                  Soltar aquí {fichaArmada.emoji} {fichaArmada.etiqueta}
                </button>
              ) : (
                <p className="te-dia-vacio" aria-hidden={!!bloques.length}>
                  {lleno ? `Día lleno (${PLAN_MAX_BLOQUES_DIA} materias)` : bloques.length ? '＋ Suelta otra materia aquí' : 'Suelta aquí sus materias ✨'}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Vista de solo lectura del lienzo (dirección y teacher con plan enviado/aprobado). */
export function PlanLienzoVista({ contenido, lunes }: { contenido: PlanContenido; lunes: string }) {
  return (
    <div className="te-lienzo" data-vista>
      {contenido.unidad || contenido.objetivo ? (
        <div className="te-lienzo-resumen">
          {contenido.unidad ? <p className="te-lienzo-unidad">🌈 {contenido.unidad}</p> : null}
          {contenido.objetivo ? <p className="te-lienzo-objetivo">🎯 {contenido.objetivo}</p> : null}
        </div>
      ) : null}
      <ol className="te-lienzo-dias">
        {DIAS_PLAN.map((d) => {
          const bloques = contenido.dias[d.clave] ?? []
          return (
            <li key={d.clave} className="te-dia">
              <header className="te-dia-head">
                <span className="te-dia-nombre">{d.en}</span>
                <small>{d.es} · {fechaCorta(sumarDias(lunes, d.offset))}</small>
              </header>
              {bloques.length ? (
                <ul className="te-bloques">
                  {bloques.map((b, i) => {
                    const sk = skillDe(b.skill)
                    return (
                      <li key={i} className="te-bloque" data-skill={b.skill}>
                        <p className="te-bloque-titulo"><span aria-hidden>{sk.emoji}</span> {sk.etiqueta}</p>
                        {b.tema ? <p className="te-bloque-tema-v">{b.tema}</p> : null}
                        {b.actividades ? <p className="te-bloque-texto">📝 {b.actividades}</p> : null}
                        {b.participacion ? <p className="te-bloque-extra">✋ {b.participacion}</p> : null}
                        {b.tarea ? <p className="te-bloque-extra">📒 {b.tarea}</p> : null}
                        {b.materiales?.length ? (
                          <p className="te-bloque-extra">🎒 {b.materiales.map((m) => { const x = materialDe(m); return x ? `${x.emoji} ${x.etiqueta}` : null }).filter(Boolean).join(' · ')}</p>
                        ) : null}
                        {b.recursos ? <p className="te-bloque-extra">🔗 {b.recursos}</p> : null}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="te-dia-vacio">Sin actividades</p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Fila de emojis de la semana, ej. «L 🧩 · M 📖 · …», para tarjetas compactas. */
export function PlanMiniSemana({ contenido }: { contenido: PlanContenido }) {
  return (
    <p className="te-mini-semana" aria-label="Skills por día">
      {DIAS_PLAN.map((d) => (
        <span key={d.clave} title={d.es}>
          <b>{d.en.slice(0, 2)}</b> {(contenido.dias[d.clave] ?? []).map((b) => skillDe(b.skill).emoji).join('') || '·'}
        </span>
      ))}
    </p>
  )
}
