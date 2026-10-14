import Image from 'next/image'
import type { ReactNode } from 'react'

const ESCUDOS = {
  iew: { src: '/logos/logo-winston-educativo.png', alt: 'Escudo del Instituto Educativo Winston' },
  wci: { src: '/logos/logo-winston-churchill.png', alt: 'Escudo del Winston Churchill Institute' },
} as const

/** Encabezado de la hoja: el escudo del nivel (IEW en kinder, WCI en primaria y secundaria), como en la boleta impresa. */
export default function MembreteBoleta({
  escuela,
  titulo,
  detalle,
}: {
  escuela: keyof typeof ESCUDOS
  titulo: ReactNode
  detalle: ReactNode
}) {
  const escudo = ESCUDOS[escuela]
  return (
    <header className="bm-hero">
      <Image src={escudo.src} alt={escudo.alt} width={72} height={93} className="bm-escudo" priority />
      <div className="bm-hero-texto">
        <h1 className="ki-title">{titulo}</h1>
        <p className="ki-lead">{detalle}</p>
      </div>
    </header>
  )
}
