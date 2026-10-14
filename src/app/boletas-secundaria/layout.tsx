import { boletasFuentes } from '@/app/boletas/boletasFuentes'

export default function BoletasSecundariaLayout({ children }: { children: React.ReactNode }) {
  return <div className={boletasFuentes}>{children}</div>
}
