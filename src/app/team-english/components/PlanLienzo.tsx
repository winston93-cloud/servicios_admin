'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import {
  DIAS_PLAN,
  PLAN_MAX_BLOQUES_DIA,
  SKILLS,
  bloqueVacio,
  fechaCorta,
  skillDe,
  sumarDias,
  type DiaClave,
  type PlanBloque,
  type PlanContenido,
  type SkillClave,
} from '@/lib/teamEnglish/teTypes'

/** Lienzo editable de la semana: tema, objetivo y por día los bloques de skill. */
export function PlanLienzoEditor({ valor, onCambiar, lunes }: { valor: PlanContenido; onCambiar: (v: PlanContenido) => void; lunes: string }) {
  const [eligiendo, setEligiendo] = useState<DiaClave | null>(null)

  const setDia = (dia: DiaClave, bloques: PlanBloque[]) => onCambiar({ ...valor, dias: { ...valor.dias, [dia]: bloques } })
  const agregar = (dia: DiaClave, skill: SkillClave) => {
    setDia(dia, [...valor.dias[dia], bloqueVacio(skill)])
    setEligiendo(null)
  }
  const cambiarBloque = (dia: DiaClave, i: number, cambios: Partial<PlanBloque>) =>
    setDia(dia, valor.dias[dia].map((b, j) => (j === i ? { ...b, ...cambios } : b)))
  const quitar = (dia: DiaClave, i: number) => {
    const b = valor.dias[dia][i]
    if ((b.tema || b.actividades || b.recursos || b.tarea) && !window.confirm(`¿Quitar ${skillDe(b.skill).etiqueta} del ${DIAS_PLAN.find((d) => d.clave === dia)?.es.toLowerCase()}?`)) return
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
    <div className="te-lienzo">
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

      <ol className="te-lienzo-dias">
        {DIAS_PLAN.map((d, di) => {
          const bloques = valor.dias[d.clave]
          return (
            <li key={d.clave} className="te-dia" style={{ ['--i' as string]: di }}>
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
                        <input className="te-input te-bloque-tema" value={b.tema} maxLength={200} placeholder="Tema · ej. Present simple"
                          aria-label={`Tema de ${sk.etiqueta}`} onChange={(e) => cambiarBloque(d.clave, i, { tema: e.target.value })} />
                        <textarea className="te-input" rows={3} value={b.actividades} maxLength={3000} placeholder="Actividades: warm-up, práctica, cierre…"
                          aria-label={`Actividades de ${sk.etiqueta}`} onChange={(e) => cambiarBloque(d.clave, i, { actividades: e.target.value })} />
                        <input className="te-input" value={b.recursos} maxLength={1000} placeholder="📚 Recursos · Book p. 24, video…"
                          aria-label={`Recursos de ${sk.etiqueta}`} onChange={(e) => cambiarBloque(d.clave, i, { recursos: e.target.value })} />
                        <input className="te-input" value={b.tarea} maxLength={1000} placeholder="🏠 Tarea (opcional)"
                          aria-label={`Tarea de ${sk.etiqueta}`} onChange={(e) => cambiarBloque(d.clave, i, { tarea: e.target.value })} />
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="te-dia-vacio">Elige qué skill trabajan este día ✨</p>
              )}

              {eligiendo === d.clave ? (
                <div className="te-skills" role="group" aria-label={`Elegir skill para el ${d.es}`}>
                  {SKILLS.map((s) => (
                    <button key={s.clave} type="button" className="te-skill" onClick={() => agregar(d.clave, s.clave)}>
                      <span aria-hidden>{s.emoji}</span> {s.etiqueta}
                    </button>
                  ))}
                  <button type="button" className="te-skill te-skill-cerrar" onClick={() => setEligiendo(null)}><X size={14} aria-hidden /> Cancelar</button>
                </div>
              ) : bloques.length < PLAN_MAX_BLOQUES_DIA ? (
                <button type="button" className="te-btn te-btn-ghost te-btn-sm te-dia-agregar" onClick={() => setEligiendo(d.clave)}>
                  <Plus size={14} aria-hidden /> {bloques.length ? 'Otra skill' : 'Agregar skill'}
                </button>
              ) : null}
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
                        {b.actividades ? <p className="te-bloque-texto">{b.actividades}</p> : null}
                        {b.recursos ? <p className="te-bloque-extra">📚 {b.recursos}</p> : null}
                        {b.tarea ? <p className="te-bloque-extra">🏠 {b.tarea}</p> : null}
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
