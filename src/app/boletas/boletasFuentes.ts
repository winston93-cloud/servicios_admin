import { Fraunces, Nunito_Sans } from 'next/font/google'

const titulos = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT'],
  variable: '--font-boletas-titulos',
  display: 'swap',
})

const texto = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-boletas',
  display: 'swap',
})

export const boletasFuentes = `${titulos.variable} ${texto.variable}`
