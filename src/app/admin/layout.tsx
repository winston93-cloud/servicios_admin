import '../agenda-admin.css'
import AdminThemeWrapper from './AdminThemeWrapper'
import AdminStaffGate from './AdminStaffGate'

export const metadata = {
  title: 'Agenda de admisión | Servicios Administrativos',
  description: 'Panel de psicólogas y directoras: citas y autorizaciones de admisión',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminStaffGate>
      <AdminThemeWrapper>
        {children}
      </AdminThemeWrapper>
    </AdminStaffGate>
  )
}
