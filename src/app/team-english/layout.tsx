import type { Metadata } from 'next'
import { Fredoka, Nunito } from 'next/font/google'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--te-font-display' })
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'], variable: '--te-font-body' })

export const metadata: Metadata = {
  title: 'Team English · Instituto Winston Churchill',
  description: 'Seguimiento del equipo de teachers de inglés.',
}

export default function TeamEnglishLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fredoka.variable} ${nunito.variable}`}>{children}</div>
}
