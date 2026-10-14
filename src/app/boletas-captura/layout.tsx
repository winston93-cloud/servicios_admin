import type { Metadata } from 'next'
import { Schibsted_Grotesk } from 'next/font/google'

const boletasFont = Schibsted_Grotesk({
  weight: ['400', '600', '800'],
  subsets: ['latin'],
  variable: '--font-boletas',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Captura de boletas · Winston Churchill',
}

export default function BoletasCapturaLayout({ children }: { children: React.ReactNode }) {
  return <div className={boletasFont.variable}>{children}</div>
}
