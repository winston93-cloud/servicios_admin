import { Plus_Jakarta_Sans } from 'next/font/google'
import './pos-paws-theme.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pos-paws-theme ${plusJakarta.variable}`} data-pos-theme="paws-paths">
      {children}
    </div>
  )
}
