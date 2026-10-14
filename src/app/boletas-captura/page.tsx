'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { cicloEscolarEtiqueta, getCicloEscolarActual } from '@/lib/ciclosEscolares'
import { ArrowLeft, ArrowRight, LogIn } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import '../boletas/boletas-hub.css'

const NIVELES = [
  {
    id: 'preescolar',
    titulo: 'Preescolar',
    grados: 'Maternal y Kinder',
    desc: 'Maestras de español y teachers de inglés: capturan las boletas de sus grupos y las envían a dirección.',
    foto: '/boletas/hub/galeria-literatura.jpg',
    alt: 'Alumnos en la Galería de Literatura',
    ruta: '/boletas-captura/maternal-kinder',
  },
  {
    id: 'primaria',
    titulo: 'Primaria',
    grados: '1° a 6°',
    desc: 'Maestras de español y teachers de inglés de 1° a 6°: capturan las boletas de sus grupos y las envían a dirección.',
    foto: '/boletas/hub/pinlanes.jpg',
    alt: 'Alumnos presentando el proyecto Pinlanes',
    ruta: '/boletas-captura/primaria',
  },
  {
    id: 'secundaria',
    titulo: 'Secundaria',
    grados: '7° a 9°',
    desc: 'Maestros de 7° a 9°: capturan calificaciones, faltas y conducta de sus materias y grupos y las envían a dirección.',
    foto: '/boletas/hub/egipto.jpg',
    alt: 'Alumnos de secundaria en el proyecto Egipto',
    ruta: '/boletas-captura/secundaria',
  },
]

/** Enlace público para maestros y teachers: eligen su nivel y entran con su usuario o correo institucional. */
export default function BoletasCapturaHubPage() {
  const ciclo = cicloEscolarEtiqueta(getCicloEscolarActual())

  return (
    <div className="boletas-hub">
      <header className="bh-top">
        <Link href="/" className="bh-top__back">
          <ArrowLeft size={16} aria-hidden />
          <span>Inicio</span>
        </Link>
        <div className="bh-top__brand">
          <Image
            src="/logos/logo-winston-w.png"
            alt=""
            width={36}
            height={27}
            className="bh-top__logo"
            priority
          />
          <span className="bh-top__school">Instituto Winston Churchill</span>
        </div>
        <span className="bh-top__ciclo">Ciclo {ciclo}</span>
        <ThemeToggle />
      </header>

      <main className="bh-main">
        <section className="bh-intro">
          <span className="bh-intro__ciclo" aria-hidden>
            {ciclo.replace(/^(\d{4})-\d{2}(\d{2})$/, '$1—$2')}
          </span>
          <h1 className="bh-intro__title">Captura de boletas</h1>
          <p className="bh-intro__lead">
            Elige tu nivel. Después entra con tu usuario y contraseña o con tu correo institucional.
          </p>
        </section>

        <div className="bh-puertas">
          {NIVELES.map((n, i) => (
            <article key={n.id} className="bh-puerta" style={{ '--i': i } as CSSProperties}>
              <Image
                src={n.foto}
                alt={n.alt}
                fill
                sizes="(max-width: 1023px) 100vw, 60vw"
                className="bh-puerta__img"
                priority={i === 0}
              />
              <div className="bh-puerta__content">
                <header className="bh-puerta__head">
                  <span className="bh-puerta__grados">{n.grados}</span>
                  <h2 className="bh-puerta__title">{n.titulo}</h2>
                </header>
                <ul className="bh-puerta__accesos">
                  <li>
                    <Link href={n.ruta} className="bh-pase">
                      <span className="bh-pase__top">
                        <span className="bh-pase__tag" aria-hidden>
                          <LogIn size={17} strokeWidth={2} />
                        </span>
                        <span className="bh-pase__label">Entrar a capturar</span>
                        <ArrowRight className="bh-pase__arrow" size={17} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="bh-pase__desc">{n.desc}</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
