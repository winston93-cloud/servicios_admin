import { Inter } from 'next/font/google'
import './facturacion-atmospheric-glass-theme.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export default function FacturacionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`facturacion-atmospheric-glass ${inter.variable}`}
      data-facturacion-theme="atmospheric-glass"
    >
      {children}
    </div>
  )
}
