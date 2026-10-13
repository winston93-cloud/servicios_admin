import type { Metadata } from 'next'
import { Instrument_Serif, Inter } from 'next/font/google'

const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-boletas-serif',
  display: 'swap',
})

const boletasSans = Inter({
  subsets: ['latin'],
  variable: '--font-boletas-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Captura de boletas · Winston Churchill',
}

export default function BoletasCapturaLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${instrumentSerif.variable} ${boletasSans.variable}`}>{children}</div>
}
