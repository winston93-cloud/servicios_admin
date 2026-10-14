import type { Metadata } from 'next'
import { boletasFuentes } from '@/app/boletas/boletasFuentes'

export const metadata: Metadata = {
  title: 'Captura de boletas · Winston Churchill',
}

export default function BoletasCapturaLayout({ children }: { children: React.ReactNode }) {
  return <div className={boletasFuentes}>{children}</div>
}
