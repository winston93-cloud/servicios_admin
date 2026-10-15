import type { Metadata } from 'next'
import localFont from 'next/font/local'

// Locales: Google a veces sirve Fredoka por /l/font?kit=…&skey=… y Turbopack no puede resolverlo en el build.
const fredoka = localFont({ src: './fonts/Fredoka-latin.woff2', weight: '300 700', variable: '--te-font-display' })
const nunito = localFont({ src: './fonts/Nunito-latin.woff2', weight: '200 1000', variable: '--te-font-body' })

// Fuentes de los temas de estructura: solo se descargan si el tema elegido las usa.
const orbitron = localFont({ src: './fonts/Orbitron-latin.woff2', weight: '500 800', variable: '--te-font-orbitron', preload: false })
const mono = localFont({
  src: [
    { path: './fonts/SpaceMono-400-latin.woff2', weight: '400' },
    { path: './fonts/SpaceMono-700-latin.woff2', weight: '700' },
  ],
  variable: '--te-font-mono',
  preload: false,
})
const caveat = localFont({
  src: './fonts/Caveat-latin.woff2',
  weight: '400 700',
  variable: '--te-font-caveat',
  preload: false,
  declarations: [{ prop: 'size-adjust', value: '118%' }],
})
const pixel = localFont({ src: './fonts/PressStart2P-latin.woff2', weight: '400', variable: '--te-font-pixel', preload: false })
const vt = localFont({
  src: './fonts/VT323-latin.woff2',
  weight: '400',
  variable: '--te-font-vt',
  preload: false,
  declarations: [{ prop: 'size-adjust', value: '128%' }],
})

export const metadata: Metadata = {
  title: 'Team English · Instituto Winston Churchill',
  description: 'Seguimiento del equipo de teachers de inglés.',
}

export default function TeamEnglishLayout({ children }: { children: React.ReactNode }) {
  const fuentes = [fredoka, nunito, orbitron, mono, caveat, pixel, vt].map((f) => f.variable).join(' ')
  return <div className={fuentes}>{children}</div>
}
