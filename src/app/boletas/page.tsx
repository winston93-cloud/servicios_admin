'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { boletasHubItems, type BoletasHubId, type BoletasHubItem } from '@/lib/boletasHubNav'
import { cicloEscolarEtiqueta, getCicloEscolarActual } from '@/lib/ciclosEscolares'
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  BookMarked,
  BookOpen,
  GraduationCap,
  Languages,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import './boletas-hub.css'

type NivelFilter = 'todos' | 'kinder' | 'primaria' | 'secundaria'
type IdiomaFilter = 'todos' | 'espanol' | 'ingles'

const ICONOS: Record<BoletasHubId, LucideIcon> = {
  'kinder-espanol': Baby,
  'kinder-ingles': Languages,
  'primaria-espanol': BookOpen,
  'primaria-ingles': BookMarked,
  secundaria: GraduationCap,
}

function nivelDeItem(item: BoletasHubItem): Exclude<NivelFilter, 'todos'> {
  if (item.id.startsWith('kinder')) return 'kinder'
  if (item.id.startsWith('primaria')) return 'primaria'
  return 'secundaria'
}

function idiomaDeItem(item: BoletasHubItem): IdiomaFilter {
  if (item.id === 'secundaria') return 'todos'
  if (item.id.endsWith('ingles')) return 'ingles'
  return 'espanol'
}

export default function BoletasHubPage() {
  const router = useRouter()
  const items = boletasHubItems()
  const [nivel, setNivel] = useState<NivelFilter>('todos')
  const [idioma, setIdioma] = useState<IdiomaFilter>('todos')

  const activos = items.filter((i) => i.activo).length
  const proximos = items.length - activos
  const cicloEtiqueta = cicloEscolarEtiqueta(getCicloEscolarActual())

  const filtrados = useMemo(() => {
    const list = items.filter((item) => {
      const n = nivelDeItem(item)
      const idi = idiomaDeItem(item)
      if (nivel !== 'todos' && n !== nivel) return false
      if (idioma !== 'todos' && item.id !== 'secundaria' && idi !== idioma) return false
      if (idioma !== 'todos' && item.id === 'secundaria') return false
      return true
    })
    // Activo primero: protagonista visual
    return [...list].sort((a, b) => Number(b.activo) - Number(a.activo))
  }, [items, nivel, idioma])

  const hayProximos = filtrados.some((i) => !i.activo)

  return (
    <div className="boletas-hub">
      <div className="boletas-hub__glow" aria-hidden="true" />

      <header className="boletas-hub__top">
        <button
          type="button"
          className="boletas-hub__back"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft size={16} aria-hidden />
          Volver
        </button>
        <p className="boletas-hub__school">Instituto Winston Churchill</p>
        <div className="boletas-hub__top-spacer" />
        <ThemeToggle />
      </header>

      <main className="boletas-hub__main">
        <header className="boletas-hub__pagehead">
          <p className="boletas-hub__eyebrow">Instituto Winston Churchill</p>
          <h1 className="boletas-hub__title">Boletas escolares</h1>
          <p className="boletas-hub__lead">
            Sistema integral · Kinder a Secundaria · captura, consulta y PDF
          </p>
        </header>

        <div className="boletas-hub__toolbar" role="toolbar" aria-label="Filtrar módulos">
          <div className="boletas-hub__seg" role="group" aria-label="Nivel">
            {(
              [
                ['todos', 'Todos'],
                ['kinder', 'Kinder'],
                ['primaria', 'Primaria'],
                ['secundaria', 'Secundaria'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`boletas-hub__seg-btn${nivel === value ? ' is-active' : ''}`}
                aria-pressed={nivel === value}
                onClick={() => setNivel(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="boletas-hub__seg" role="group" aria-label="Idioma">
            {(
              [
                ['todos', 'Todos'],
                ['espanol', 'Español'],
                ['ingles', 'Inglés'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`boletas-hub__seg-btn${idioma === value ? ' is-active' : ''}`}
                aria-pressed={idioma === value}
                onClick={() => setIdioma(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="boletas-hub__toolbar-status" aria-live="polite">
            <span className="boletas-hub__status-live">{activos} activo</span>
            <span aria-hidden> · </span>
            <span>{proximos} próximos</span>
          </p>
        </div>

        <section className="boletas-hub__grid" aria-label="Sistemas de boletas">
          {filtrados.length === 0 ? (
            <p className="boletas-hub__empty">
              No hay módulos con ese filtro. Prueba “Todos” en nivel o idioma.
            </p>
          ) : (
            filtrados.map((item) => {
              const live = item.activo
              const Icon = ICONOS[item.id]
              return (
                <article
                  key={item.id}
                  className={`boletas-hub__card${live ? ' boletas-hub__card--live' : ' boletas-hub__card--soon'}`}
                >
                  <div className="boletas-hub__card-head">
                    <div className="boletas-hub__card-icon" aria-hidden>
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    {!live && <span className="boletas-hub__card-badge">Próximo</span>}
                  </div>

                  <h2 className="boletas-hub__card-title">{item.label}</h2>
                  <p className="boletas-hub__card-desc">{item.desc}</p>

                  {live && (
                    <p className="boletas-hub__card-cycle">
                      Sistema en uso este ciclo · {cicloEtiqueta}
                    </p>
                  )}

                  <ul className="boletas-hub__card-chips" aria-label="Etiquetas">
                    {item.tags.slice(0, 2).map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>

                  {live && (
                    <div className="boletas-hub__card-footer">
                      <button
                        type="button"
                        className="boletas-hub__enter"
                        onClick={() => router.push(item.path)}
                      >
                        Entrar al sistema
                        <ArrowRight size={16} aria-hidden />
                      </button>
                    </div>
                  )}
                </article>
              )
            })
          )}
        </section>

        {hayProximos && (
          <p className="boletas-hub__soon-note">
            Se habilita al cerrar el ciclo de Secundaria
          </p>
        )}
      </main>
    </div>
  )
}
