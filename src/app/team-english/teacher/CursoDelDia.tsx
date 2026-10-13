'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { COSTOS_SUGERIDO, MODALIDADES, cursoDelDia, skillDe, type TeCursoSugerido } from '@/lib/teamEnglish/teTypes'
import { Hoja } from '../components/ui'

function Detalle({ s }: { s: TeCursoSugerido }) {
  const costo = COSTOS_SUGERIDO[s.costo]
  return (
    <p className="te-cdd-meta">
      <span className="te-chip te-chip-suave">{costo.emoji} {costo.etiqueta}</span>
      <span className="te-chip te-chip-suave">{MODALIDADES[s.modalidad]}</span>
      {s.horas ? <span className="te-chip te-chip-suave">⏱️ {s.horas} h</span> : null}
    </p>
  )
}

function Acciones({ s, onLoTome }: { s: TeCursoSugerido; onLoTome: (s: TeCursoSugerido) => void }) {
  return (
    <div className="te-cdd-acciones">
      <a className="te-btn te-btn-sm" href={s.enlace} target="_blank" rel="noopener noreferrer">
        Ver curso <ExternalLink size={14} aria-hidden />
      </a>
      <button type="button" className="te-btn te-btn-primary te-btn-sm" onClick={() => onLoTome(s)}>🏅 ¡Lo tomé!</button>
    </div>
  )
}

/** Tarjeta «Curso del día» del portal de teachers: rota diario sobre el catálogo de la coordinación. */
export default function CursoDelDia({ sugeridos, hoy, onLoTome }: {
  sugeridos: TeCursoSugerido[]
  hoy: string
  onLoTome: (s: TeCursoSugerido) => void
}) {
  const [verTodos, setVerTodos] = useState(false)
  const s = cursoDelDia(sugeridos, hoy)
  if (!s) return null
  const sk = s.skill ? skillDe(s.skill) : null
  const elegir = (x: TeCursoSugerido) => {
    setVerTodos(false)
    onLoTome(x)
  }

  return (
    <aside className="te-cdd" aria-labelledby="te-cdd-titulo" data-skill={s.skill ?? undefined}>
      <header className="te-cdd-head">
        <span className="te-cdd-pin" aria-hidden>📌</span>
        <span id="te-cdd-titulo" className="te-cdd-kicker">Curso del día</span>
        <span className="te-cdd-sticker" aria-hidden>{sk?.emoji ?? '🎓'}</span>
      </header>
      <h2 className="te-cdd-titulo">{s.titulo}</h2>
      {s.institucion ? <p className="te-cdd-inst">{s.institucion}</p> : null}
      <Detalle s={s} />
      {s.descripcion ? <p className="te-cdd-desc">{s.descripcion}</p> : null}
      <Acciones s={s} onLoTome={onLoTome} />
      {sugeridos.length > 1 ? (
        <button type="button" className="te-cdd-mas" onClick={() => setVerTodos(true)}>
          Ver los {sugeridos.length} cursos recomendados →
        </button>
      ) : null}

      <Hoja abierta={verTodos} titulo="Cursos recomendados" emoji="🎓" onCerrar={() => setVerTodos(false)}>
        <p className="te-nota">Los recomienda tu coordinación. Si terminas uno, toca «¡Lo tomé!» y sube tu constancia.</p>
        <ul className="te-cdd-lista">
          {sugeridos.map((x) => (
            <li key={x.id} data-hoy={x.id === s.id || undefined}>
              <b>{x.skill ? `${skillDe(x.skill).emoji} ` : '🎓 '}{x.titulo}</b>
              {x.institucion ? <small>{x.institucion}{x.id === s.id ? ' · 📌 hoy' : ''}</small> : null}
              <Detalle s={x} />
              {x.descripcion ? <p className="te-cdd-desc">{x.descripcion}</p> : null}
              <Acciones s={x} onLoTome={elegir} />
            </li>
          ))}
        </ul>
      </Hoja>
    </aside>
  )
}
