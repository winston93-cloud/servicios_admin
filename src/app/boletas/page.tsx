'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { boletasHubItems, type BoletasHubId, type BoletasHubItem } from '@/lib/boletasHubNav'
import { cicloEscolarEtiqueta, getCicloEscolarActual } from '@/lib/ciclosEscolares'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import './boletas-hub.css'

function cicloCorto(etiqueta: string): string {
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
    const sec = items.find((i) => i.id === 'secundaria' && i.activo)
    const live = sec ?? items.find((i) => i.activo)
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

        <div className="boletas-hub__brand">
          <Image
            src="/logos/logo-winston-w.png"
            alt="Instituto Winston Churchill"
            width={48}
            height={36}
            className="boletas-hub__logo boletas-hub__logo--w"
            priority
          />
          <Image
            src="/logos/logo-winston-educativo.png"
            alt="Winston Educativo"
            width={48}
            height={36}
            className="boletas-hub__logo boletas-hub__logo--edu"
            priority
          />
          <p className="boletas-hub__school">Instituto Winston Churchill</p>
        </div>

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
            className="boletas-hub__stage-right"
            aria-label={`Vista de ${selected.label}`}
          >
            <div className="boletas-hub__portrait">
              <Image
                src="/boletas/hub/comunidad-winston.jpg"
                alt="Comunidad Winston Churchill"
                fill
                sizes="(max-width: 860px) 100vw, 640px"
                className="boletas-hub__portrait-img"
                priority
              />
              <div className="boletas-hub__portrait-veil" aria-hidden />
              <div className="boletas-hub__portrait-grain" aria-hidden />

              <div className="boletas-hub__sheet">
                <div className="boletas-hub__sheet-inner">
                  <header className="boletas-hub__sheet-head">
                    <Image
                      src="/logos/logo-winston-w.png"
                      alt=""
                      width={40}
                      height={30}
                      className="boletas-hub__sheet-crest"
                    />
                    <div className="boletas-hub__sheet-meta">
                      <p className="boletas-hub__sheet-school">
                        Instituto Winston Churchill
                      </p>
                      <p className="boletas-hub__sheet-doc">{selected.label}</p>
                    </div>
                  </header>

                  <p className="boletas-hub__sheet-body">
                    {live
                      ? 'Captura, consulta y emisión de PDF para el ciclo en curso.'
                      : 'Se habilita al cerrar el ciclo de Secundaria.'}
                  </p>

                  <footer className="boletas-hub__sheet-foot">
                    <span>Ciclo {cicloEtiqueta}</span>
                    {live ? (
                      <button
                        type="button"
                        className="boletas-hub__open"
                        onClick={() => router.push(selected.path)}
                      >
                        Abrir
                        <ArrowRight size={15} aria-hidden />
                      </button>
                    ) : (
                      <span className="boletas-hub__open-disabled">Pronto</span>
                    )}
                  </footer>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
