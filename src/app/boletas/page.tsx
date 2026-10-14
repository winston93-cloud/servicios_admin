'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { boletasHubItems, type BoletasHubId, type BoletasHubItem } from '@/lib/boletasHubNav'
import type { HubEstado, HubModulo, HubNivel } from '@/lib/boletasHubEstado'
import type { BoletaModulo } from '@/lib/boletasPdfModulo'
import { cicloEscolarEtiqueta, getCicloEscolarActual } from '@/lib/ciclosEscolares'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, GraduationCap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './boletas-hub.css'

type Acceso = {
  id: BoletasHubId
  modulo: BoletaModulo
  etiqueta: string
  tag: string
  detalle: string
}

type Nivel = {
  id: HubNivel
  titulo: string
  grados: string
  foto: string
  alt: string
  accesos: Acceso[]
}

const NIVELES: Nivel[] = [
  {
    id: 'preescolar',
    titulo: 'Preescolar',
    grados: 'K1, K2 y K3',
    foto: '/boletas/hub/galeria-literatura.jpg',
    alt: 'Alumnos en la Galería de Literatura',
    accesos: [
      {
        id: 'kinder-espanol',
        modulo: 'kinder-es',
        etiqueta: 'Español',
        tag: 'ES',
        detalle: 'Entregas de maestras, revisión, publicación y PDF',
      },
      {
        id: 'kinder-ingles',
        modulo: 'kinder-en',
        etiqueta: 'Inglés',
        tag: 'EN',
        detalle: 'English Preschool: entregas de teachers y PDF',
      },
    ],
  },
  {
    id: 'primaria',
    titulo: 'Primaria',
    grados: '1° a 6°',
    foto: '/boletas/hub/pinlanes.jpg',
    alt: 'Alumnos presentando el proyecto Pinlanes',
    accesos: [
      {
        id: 'primaria-espanol',
        modulo: 'primaria-es',
        etiqueta: 'Español',
        tag: 'ES',
        detalle: 'Grados, grupos, PDF y reportes',
      },
      {
        id: 'primaria-ingles',
        modulo: 'primaria-en',
        etiqueta: 'Inglés',
        tag: 'EN',
        detalle: 'Captura docente y emisión de PDF',
      },
    ],
  },
  {
    id: 'secundaria',
    titulo: 'Secundaria',
    grados: '1° a 3°',
    foto: '/boletas/hub/egipto.jpg',
    alt: 'Alumnos de secundaria en el proyecto Egipto',
    accesos: [
      {
        id: 'secundaria',
        modulo: 'secundaria',
        etiqueta: 'Boleta única',
        tag: '',
        detalle: 'Captura por materia, medallas, PDF y ciclos históricos',
      },
    ],
  },
]

const PORTAL_PATH = '/boletas-captura'

function AccesoPuerta({
  acceso,
  item,
  estado,
}: {
  acceso: Acceso
  item: BoletasHubItem | undefined
  estado: HubModulo | undefined
}) {
  const contenido = (
    <>
      <span className="bh-pase__top">
        <span className="bh-pase__tag" aria-hidden>
          {acceso.tag || <GraduationCap size={18} strokeWidth={2} />}
        </span>
        <span className="bh-pase__label">{acceso.etiqueta}</span>
        {item?.activo && estado?.estado === 'publicada' ? (
          <span className="bh-pase__sello">Publicada</span>
        ) : null}
        {item?.activo ? (
          <ArrowRight className="bh-pase__arrow" size={17} strokeWidth={2} aria-hidden />
        ) : (
          <span className="bh-pase__soon">Pronto</span>
        )}
      </span>
      <span className="bh-pase__desc">{acceso.detalle}</span>
    </>
  )

  if (!item?.activo) {
    return <div className="bh-pase is-soon">{contenido}</div>
  }
  return (
    <Link href={item.path} className="bh-pase">
      {contenido}
    </Link>
  )
}

export default function BoletasHubPage() {
  const items = boletasHubItems()
  const porId = new Map(items.map((i) => [i.id, i]))
  const ciclo = cicloEscolarEtiqueta(getCicloEscolarActual())
  const portal = porId.get('portal-captura')

  const [copiado, setCopiado] = useState(false)
  const timer = useRef<number | null>(null)
  const [estado, setEstado] = useState<HubEstado | null>(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/boletas-hub', { cache: 'no-store' })
      .then(async (r) => {
        if (vivo && r.ok) setEstado((await r.json()) as HubEstado)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  const estadoModulo = (modulo: BoletaModulo) =>
    estado
      ? Object.values(estado.niveles)
          .flatMap((n) => n.modulos)
          .find((m) => m.modulo === modulo)
      : undefined

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )

  async function copiarEnlace() {
    const url = `${window.location.origin}${PORTAL_PATH}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copia el enlace del portal:', url)
      return
    }
    setCopiado(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopiado(false), 2200)
  }

  return (
    <div className="boletas-hub">
      <header className="bh-top">
        <Link href="/dashboard" className="bh-top__back">
          <ArrowLeft size={16} aria-hidden />
          <span>Dashboard</span>
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
          <h1 className="bh-intro__title">Sistema Integral de Boletas</h1>
          <p className="bh-intro__lead">
            Elige nivel e idioma para capturar, revisar, publicar a papás y generar el PDF.
          </p>
        </section>

        <div className="bh-puertas">
          {NIVELES.map((nivel, i) => (
            <article
              key={nivel.id}
              className={`bh-puerta bh-puerta--${nivel.id}`}
              style={{ '--i': i } as CSSProperties}
            >
              <Image
                src={nivel.foto}
                alt={nivel.alt}
                fill
                sizes="(max-width: 1023px) 100vw, 60vw"
                className="bh-puerta__img"
                priority={i === 0}
              />
              <div className="bh-puerta__content">
                <header className="bh-puerta__head">
                  <span className="bh-puerta__grados">{nivel.grados}</span>
                  <h2 className="bh-puerta__title">{nivel.titulo}</h2>
                </header>
                <ul className="bh-puerta__accesos">
                  {nivel.accesos.map((a) => (
                    <li key={a.id}>
                      <AccesoPuerta acceso={a} item={porId.get(a.id)} estado={estadoModulo(a.modulo)} />
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <article className="bh-portal">
          <div className="bh-portal__body">
            <p className="bh-portal__kicker">Maestras y teachers</p>
            <h2 className="bh-portal__title">Portal de captura</h2>
            <p className="bh-portal__desc">
              Cada docente entra con su cuenta a sus grupos, captura y envía a dirección.
            </p>
          </div>
          <div className="bh-portal__actions">
            {portal?.activo !== false && (
              <Link href={PORTAL_PATH} className="bh-btn bh-btn--primary">
                Abrir portal
                <ArrowUpRight size={17} strokeWidth={2} aria-hidden />
              </Link>
            )}
            <button type="button" className="bh-btn bh-btn--ghost" onClick={copiarEnlace}>
              {copiado ? <Check size={16} strokeWidth={2} aria-hidden /> : <Copy size={16} strokeWidth={2} aria-hidden />}
              <span aria-live="polite">{copiado ? 'Enlace copiado' : 'Copiar enlace'}</span>
            </button>
          </div>
        </article>
      </main>
    </div>
  )
}
