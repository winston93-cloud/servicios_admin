import { Schibsted_Grotesk } from 'next/font/google'

const boletasFont = Schibsted_Grotesk({
  weight: ['400', '600', '800'],
  subsets: ['latin'],
  variable: '--font-boletas',
  display: 'swap',
})

export default function BoletasSecundariaLayout({ children }: { children: React.ReactNode }) {
  return <div className={boletasFont.variable}>{children}</div>
}
