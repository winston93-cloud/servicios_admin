import type { Metadata } from 'next'
import localFont from 'next/font/local'

// Locales: Google a veces sirve Fredoka por /l/font?kit=…&skey=… y Turbopack no puede resolverlo en el build.
const fredoka = localFont({ src: './fonts/Fredoka-latin.woff2', weight: '300 700', variable: '--te-font-display' })
const nunito = localFont({ src: './fonts/Nunito-latin.woff2', weight: '200 1000', variable: '--te-font-body' })

export const metadata: Metadata = {
  title: 'Team English · Instituto Winston Churchill',
  description: 'Seguimiento del equipo de teachers de inglés.',
}

export default function TeamEnglishLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fredoka.variable} ${nunito.variable}`}>{children}</div>
}
