import './servicios-original-theme.css'
import './servicios-totality-alumno.css'
import './servicios-totality-dark.css'
import SoloPersonal from './SoloPersonal'

export default function ServiciosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 2026-10-12 - Seguridad: las familias no pueden abrir el panel de personal.
  return <SoloPersonal>{children}</SoloPersonal>
}
