import { boletasFuentes } from './boletasFuentes'

export default function BoletasLayout({ children }: { children: React.ReactNode }) {
  return <div className={boletasFuentes}>{children}</div>
}
