'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { boletasHubItems, type BoletasHubId, type BoletasHubItem } from '@/lib/boletasHubNav'
import { cicloEscolarEtiqueta, getCicloEscolarActual } from '@/lib/ciclosEscolares'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { useRouter } from 'next/navigation'
import './boletas-hub.css'

const HUB_SLIDES = [
  {
    src: '/boletas/hub/comunidad-winston.jpg',
    alt: 'Comunidad Winston Churchill',
  },
  {
    src: '/boletas/hub/pinlanes.jpg',
    alt: 'Proyecto Pinlanes — feria escolar',
  },
  {
    src: '/boletas/hub/egipto.jpg',
    alt: 'Proyecto Egipto — secundaria',
  },
  {
    src: '/boletas/hub/galeria-literatura.jpg',
    alt: 'Galería de Literatura — primaria',
  },
] as const

const SLIDE_MS = 5500

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
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const selected: BoletasHubItem =
    items.find((i) => i.id === selectedId) ?? items[0]

  const live = selected.activo

  useEffect(() => {
    if (paused) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % HUB_SLIDES.length)
    }, SLIDE_MS)
    return () => window.clearInterval(id)
  }, [paused])

  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null) return
    const end = e.changedTouches[0]?.clientX
    if (end == null) return
    const delta = end - start
    if (Math.abs(delta) < 48) return
    setSlide((s) =>
      delta < 0
        ? (s + 1) % HUB_SLIDES.length
        : (s - 1 + HUB_SLIDES.length) % HUB_SLIDES.length
    )
  }

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
        <p className="boletas-hub__school">Instituto Winston Churchill</p>
        <div className="boletas-hub__top-spacer" />
        <span className="boletas-hub__ciclo-pill">Ciclo {cicloShort}</span>
        <ThemeToggle />
      </header>

      <main className="boletas-hub__main">
        <header className="boletas-hub__pagehead">
          <h1 className="boletas-hub__title">Sistema Integral de Boletas Escolares</h1>
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
            <div className="boletas-hub__logo-flank" aria-hidden={false}>
              <Image
                src="/logos/logo-winston-w.png"
                alt="Instituto Winston Churchill"
                width={160}
                height={120}
                className="boletas-hub__flank-logo boletas-hub__flank-logo--w"
                priority
              />
              <Image
                src="/logos/logo-winston-educativo.png"
                alt="Winston Educativo"
                width={160}
                height={120}
                className="boletas-hub__flank-logo boletas-hub__flank-logo--edu"
                priority
              />
            </div>

            <div
              className="boletas-hub__portrait"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocusCapture={() => setPaused(true)}
              onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setPaused(false)
                }
              }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <div className="boletas-hub__carousel" aria-roledescription="carrusel">
                {HUB_SLIDES.map((item, i) => (
                  <div
                    key={item.src}
                    className={`boletas-hub__slide${i === slide ? ' is-active' : ''}`}
                    aria-hidden={i !== slide}
                  >
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 860px) 100vw, 640px"
                      className="boletas-hub__portrait-img"
                      priority={i === 0}
                    />
                  </div>
                ))}
              </div>

              <div className="boletas-hub__portrait-veil" aria-hidden />
              <div className="boletas-hub__portrait-fade" aria-hidden />
              <div className="boletas-hub__portrait-grain" aria-hidden />

              <div
                className="boletas-hub__dots"
                role="tablist"
                aria-label="Fotos de la comunidad"
              >
                {HUB_SLIDES.map((item, i) => (
                  <button
                    key={item.src}
                    type="button"
                    role="tab"
                    aria-selected={i === slide}
                    aria-label={`Foto ${i + 1}: ${item.alt}`}
                    className={`boletas-hub__dot${i === slide ? ' is-active' : ''}`}
                    onClick={() => setSlide(i)}
                  />
                ))}
              </div>

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
