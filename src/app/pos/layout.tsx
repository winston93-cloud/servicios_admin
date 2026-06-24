import { Inter, Space_Grotesk } from 'next/font/google'
import './pos-totality-theme.css'

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

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`pos-totality-theme ${spaceGrotesk.variable} ${inter.variable}`}
      data-pos-theme="totality-festival"
    >
      {children}
    </div>
  )
}
