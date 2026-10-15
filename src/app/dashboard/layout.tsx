import localFont from 'next/font/local'

// Fuentes de los estilos de Team English: solo se descargan si el estilo elegido las usa.
const fredoka = localFont({ src: '../team-english/fonts/Fredoka-latin.woff2', weight: '300 700', variable: '--dt-f-fredoka', preload: false })
const nunito = localFont({ src: '../team-english/fonts/Nunito-latin.woff2', weight: '200 1000', variable: '--dt-f-nunito', preload: false })
const orbitron = localFont({ src: '../team-english/fonts/Orbitron-latin.woff2', weight: '500 800', variable: '--dt-f-orbitron', preload: false })
const mono = localFont({
  src: [
    { path: '../team-english/fonts/SpaceMono-400-latin.woff2', weight: '400' },
    { path: '../team-english/fonts/SpaceMono-700-latin.woff2', weight: '700' },
  ],
  variable: '--dt-f-mono',
  preload: false,
})
const caveat = localFont({
  src: '../team-english/fonts/Caveat-latin.woff2',
  weight: '400 700',
  variable: '--dt-f-caveat',
  preload: false,
  declarations: [{ prop: 'size-adjust', value: '118%' }],
})
const pixel = localFont({ src: '../team-english/fonts/PressStart2P-latin.woff2', weight: '400', variable: '--dt-f-pixel', preload: false })
const vt = localFont({
  src: '../team-english/fonts/VT323-latin.woff2',
  weight: '400',
  variable: '--dt-f-vt',
  preload: false,
  declarations: [{ prop: 'size-adjust', value: '128%' }],
})

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const fuentes = [fredoka, nunito, orbitron, mono, caveat, pixel, vt].map((f) => f.variable).join(' ')
  return (
    <div className={fuentes} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
