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

export default function BoletasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${instrumentSerif.variable} ${boletasSans.variable}`}>{children}</div>
  )
}
