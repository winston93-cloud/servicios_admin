'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { boletasHubItems, type BoletasHubId, type BoletasHubItem } from '@/lib/boletasHubNav'
import { cicloEscolarEtiqueta, getCicloEscolarActual } from '@/lib/ciclosEscolares'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import './boletas-hub.css'

function cicloCorto(etiqueta: string): string {
  // "2026-2027" → "26-27"
  const parts = etiqueta.split('-')
  if (parts.length !== 2) return etiqueta
  return `${parts[0].slice(-2)}-${parts[1].slice(-2)}`
}

export default function BoletasHubPage() {
  const router = useRouter()
  const items = boletasHubItems()
  const cicloEtiqueta = cicloEscolarEtiqueta(getCicloEscolarActual())
  const cicloShort = cicloCorto(cicloEtiqueta)

  const iniciales = useMemo(() => {
    const live = items.find((i) => i.activo)
    return live?.id ?? items[0]?.id ?? 'secundaria'
  }, [items])

  const [selectedId, setSelectedId] = useState<BoletasHubId>(iniciales)

  const selected: BoletasHubItem =
    items.find((i) => i.id === selectedId) ?? items[0]

  const live = selected.activo

  return (
    <div className="boletas-hub">
      <header className="boletas-hub__top">
        <button
          type="button"
          className="boletas-hub__back"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft size={15} aria-hidden />
          Volver
        </button>
        <p className="boletas-hub__school">Winston Churchill</p>
        <div className="boletas-hub__top-spacer" />
        <span className="boletas-hub__ciclo-pill">Ciclo {cicloShort}</span>
        <ThemeToggle />
      </header>

      <main className="boletas-hub__main">
        <header className="boletas-hub__pagehead">
          <h1 className="boletas-hub__title">Boletas</h1>
          <p className="boletas-hub__lead">Ciclo {cicloEtiqueta}</p>
        </header>

        <div className="boletas-hub__stage">
          <nav className="boletas-hub__index" aria-label="Sistemas de boletas">
            <ul className="boletas-hub__list">
              {items.map((item) => {
                const isActive = item.id === selected.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`boletas-hub__row${isActive ? ' is-active' : ''}${
                        item.activo ? '' : ' is-soon'
                      }`}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="boletas-hub__row-dot" aria-hidden />
                      <span className="boletas-hub__row-text">
                        <span className="boletas-hub__row-label">{item.label}</span>
                        {!item.activo && (
                          <span className="boletas-hub__row-soon">Pronto</span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <section
            className="boletas-hub__sheet-panel"
            aria-label={`Vista de ${selected.label}`}
          >
            <div className="boletas-hub__sheet" aria-hidden={!live}>
              <div className="boletas-hub__sheet-inner">
                <header className="boletas-hub__sheet-head">
                  <div className="boletas-hub__sheet-crest" aria-hidden>
                    <span>IWC</span>
                  </div>
                  <div className="boletas-hub__sheet-meta">
                    <p className="boletas-hub__sheet-school">
                      Instituto Winston Churchill
                    </p>
                    <p className="boletas-hub__sheet-doc">Boleta de calificaciones</p>
                  </div>
                </header>

                <div className="boletas-hub__sheet-aluno">
                  <span>Alumno</span>
                  <em />
                  <span>Grupo</span>
                  <em className="boletas-hub__sheet-short" />
                </div>

                <div className="boletas-hub__sheet-lines">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="boletas-hub__sheet-line">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>

                <footer className="boletas-hub__sheet-foot">
                  <span>{selected.label}</span>
                  <span>Ciclo {cicloEtiqueta}</span>
                </footer>
              </div>
            </div>

            <div className="boletas-hub__sheet-actions">
              <p className="boletas-hub__sheet-caption">
                {live
                  ? 'Sistema en uso. Captura, consulta y PDF.'
                  : 'Se habilita al cerrar el ciclo de Secundaria.'}
              </p>
              {live ? (
                <button
                  type="button"
                  className="boletas-hub__open"
                  onClick={() => router.push(selected.path)}
                >
                  Abrir sistema
                  <ArrowRight size={15} aria-hidden />
                </button>
              ) : (
                <span className="boletas-hub__open-disabled">Aún no disponible</span>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
