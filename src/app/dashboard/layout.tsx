import { Instrument_Serif, Poppins } from 'next/font/google'

// Fuentes de los estilos del dashboard: solo se descargan si el estilo elegido las usa.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--dt-f-poppins',
  display: 'swap',
  preload: false,
})
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: '400',
  variable: '--dt-f-serif',
  display: 'swap',
  preload: false,
})

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${poppins.variable} ${instrumentSerif.variable}`} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
