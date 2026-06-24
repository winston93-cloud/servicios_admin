import { Inter, Space_Grotesk } from 'next/font/google'
import '../pos/pos-totality-theme.css'
import './facturacion-totality-overrides.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export default function FacturacionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`pos-totality-theme facturacion-cfdi-shell ${spaceGrotesk.variable} ${inter.variable}`}
      data-facturacion-theme="totality-festival"
    >
      {children}
    </div>
  )
}
