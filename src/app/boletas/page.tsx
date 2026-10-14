'use client'

import { NumeroAnimado } from '@/components/boletas-motion'
import ThemeToggle from '@/components/ThemeToggle'
import { boletasHubItems, type BoletasHubId, type BoletasHubItem } from '@/lib/boletasHubNav'
import type { HubEstado, HubEstadoModulo, HubModulo, HubNivel } from '@/lib/boletasHubEstado'
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

const ESTADO_MODULO: Record<HubEstadoModulo, string> = {
  'sin-entregas': 'Sin entregas',
  'en-captura': 'En captura',
  devuelta: 'Con devoluciones',
  enviada: 'Todo enviado',
  publicada: 'Publicada',
}

function Cifra({ n }: { n: number }) {
  return <NumeroAnimado valor={n} texto={String(n)} />
}

function NivelEstado({ trimestre, modulos }: { trimestre: number; modulos: HubModulo[] }) {
  const enviadas = modulos.reduce((s, m) => s + m.enviadas, 0)
  const total = modulos.reduce((s, m) => s + m.total, 0)
  const publicados = modulos.reduce((s, m) => s + m.publicados, 0)
  const publicables = modulos.reduce((s, m) => s + m.publicables, 0)
  const sec = modulos.find((m) => m.capturaAbierta != null)
  const avance = total ? Math.round((enviadas / total) * 100) : 0

  let pill = `Trimestre ${trimestre}`
  let tono = 'neutro'
  if (publicables > 0 && publicados === publicables) {
    pill = `Trimestre ${trimestre} publicado`
    tono = 'publicada'
  } else if (sec) {
    pill = sec.capturaAbierta ? `Captura abierta · Trimestre ${sec.capturaAbierta}` : `Captura cerrada · Trimestre ${trimestre}`
    tono = sec.capturaAbierta ? 'abierta' : 'cerrada'
  }

  return (
    <div className="bh-estado">
      <div className="bh-estado__top">
        <span className={`bh-pill is-${tono}`}>{pill}</span>
        <span className="bh-estado__pub">
          Publicado a papás{' '}
          <b>
            <Cifra n={publicados} />
          </b>
          /{publicables}
        </span>
      </div>
      <div className="bh-estado__barra">
        <span
          className="bh-estado__track"
          role="progressbar"
          aria-label={sec ? 'Materias entregadas a dirección' : 'Grupos entregados a dirección'}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={enviadas}
        >
          <i style={{ width: `${avance}%` }} />
        </span>
        <span className="bh-estado__label">
          {sec ? 'Materias' : 'Entregas'}{' '}
          <b>
            <Cifra n={enviadas} />
          </b>{' '}
          de {total}
        </span>
      </div>
    </div>
  )
}

function AccesoFila({
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
      <span className="bh-acceso__tag" aria-hidden>
        {acceso.tag || <GraduationCap size={18} strokeWidth={1.75} />}
      </span>
      <span className="bh-acceso__text">
        <span className="bh-acceso__label">
          {acceso.etiqueta}
          {estado && item?.activo ? (
            <span className={`bh-acceso__estado is-${estado.estado}`}>{ESTADO_MODULO[estado.estado]}</span>
          ) : null}
        </span>
        <span className="bh-acceso__desc">{acceso.detalle}</span>
      </span>
      {item?.activo ? (
        <ArrowRight className="bh-acceso__arrow" size={18} strokeWidth={2} aria-hidden />
      ) : (
        <span className="bh-acceso__soon">Pronto</span>
      )}
    </>
  )

  if (!item?.activo) {
    return <div className="bh-acceso is-soon">{contenido}</div>
  }
  return (
    <Link href={item.path} className="bh-acceso">
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
  const [sinSesion, setSinSesion] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch('/api/boletas-hub', { cache: 'no-store' })
      .then(async (r) => {
        if (!vivo) return
        if (r.status === 401) setSinSesion(true)
        else if (r.ok) setEstado((await r.json()) as HubEstado)
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
          <h1 className="bh-intro__title">Sistema Integral de Boletas</h1>
          <p className="bh-intro__lead">
            Avance del trimestre por nivel: entregas a dirección y boletas publicadas a papás. Entra al
            módulo para revisar, publicar y generar el PDF.
          </p>
          {sinSesion && (
            <p className="bh-intro__nota">Inicia sesión en cualquier módulo para ver aquí el avance del trimestre.</p>
          )}
        </section>

        <div className="bh-grid">
          {NIVELES.map((nivel, i) => (
            <article
              key={nivel.id}
              className={`bh-nivel bh-nivel--${nivel.id}`}
              style={{ '--i': i } as CSSProperties}
            >
              <div className="bh-nivel__media">
                <Image
                  src={nivel.foto}
                  alt={nivel.alt}
                  fill
                  sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 520px"
                  className="bh-nivel__img"
                  priority={i === 0}
                />
              </div>
              <div className="bh-nivel__body">
                <header className="bh-nivel__head">
                  <h2 className="bh-nivel__title">{nivel.titulo}</h2>
                  <span className="bh-nivel__grados">{nivel.grados}</span>
                </header>
                {estado && (
                  <NivelEstado
                    trimestre={estado.niveles[nivel.id].trimestre}
                    modulos={estado.niveles[nivel.id].modulos}
                  />
                )}
                <ul className="bh-nivel__accesos">
                  {nivel.accesos.map((a) => (
                    <li key={a.id}>
                      <AccesoFila acceso={a} item={porId.get(a.id)} estado={estadoModulo(a.modulo)} />
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}

          <article className="bh-portal" style={{ '--i': NIVELES.length } as CSSProperties}>
            <div className="bh-portal__media" aria-hidden>
              <Image
                src="/boletas/hub/comunidad-winston.jpg"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 360px"
                className="bh-portal__img"
              />
            </div>
            <div className="bh-portal__body">
              <p className="bh-portal__kicker">Maestras y teachers</p>
              <h2 className="bh-portal__title">Portal de captura</h2>
              <p className="bh-portal__desc">
                Cada docente entra con su cuenta a sus grupos, captura y envía a dirección.
              </p>
              <div className="bh-portal__actions">
                {portal?.activo !== false && (
                  <Link href={PORTAL_PATH} className="bh-btn bh-btn--primary">
                    Abrir portal
                    <ArrowUpRight size={17} strokeWidth={2} aria-hidden />
                  </Link>
                )}
                <button type="button" className="bh-btn bh-btn--ghost" onClick={copiarEnlace}>
                  {copiado ? (
                    <Check size={16} strokeWidth={2} aria-hidden />
                  ) : (
                    <Copy size={16} strokeWidth={2} aria-hidden />
                  )}
                  <span aria-live="polite">{copiado ? 'Enlace copiado' : 'Copiar enlace'}</span>
                </button>
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  )
}
