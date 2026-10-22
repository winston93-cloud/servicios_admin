import { Poppins, Source_Serif_4 } from 'next/font/google'

// Fuentes de los estilos del dashboard: solo se descargan si el estilo elegido las usa.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--dt-f-poppins',
  display: 'swap',
  preload: false,
})
const serif = Source_Serif_4({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--dt-f-serif',
  display: 'swap',
  preload: false,
})

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${poppins.variable} ${serif.variable}`} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
