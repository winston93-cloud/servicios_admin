import { cookies } from 'next/headers'
import { hasAdmissionInsforgeEnv } from '@/lib/admission/admissionInsforgeEnv'
import { getAdmissionAppointments, getBlockedDates, getSchedules, getRecorridos } from './actions'
import AdminDashboard from './AdminDashboard'
import AdminThemeToggle from './AdminThemeToggle'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  psi_mk:  'Psicología – Maternal y Kinder',
  psi_pri: 'Psicología – Primaria',
  psi_sec: 'Psicología – Secundaria',
  vin_mk:  'Vinculación – Maternal y Kinder',
  vin_pri: 'Vinculación – Primaria y Secundaria',
}

// Niveles de BD que puede ver cada rol (admission_appointments.level usa valores atómicos)
const ROLE_LEVELS: Record<string, string[]> = {
  psi_mk:  ['maternal', 'kinder'],
  psi_pri: ['primaria'],
  psi_sec: ['secundaria'],
  vin_mk:  ['maternal', 'kinder'],
  vin_pri: ['primaria', 'secundaria'],
}

export default async function AdminPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('admin_session')?.value ?? ''
  const roleLabel = ROLE_LABELS[role] ?? 'Panel Administrativo'
  const allowedLevels = ROLE_LEVELS[role] ?? []

  let appointments: Awaited<ReturnType<typeof getAdmissionAppointments>> = []
  let blockedDates: Awaited<ReturnType<typeof getBlockedDates>> = []
  let schedules: Awaited<ReturnType<typeof getSchedules>> = []
  let recorridos: Awaited<ReturnType<typeof getRecorridos>> = []
  if (hasAdmissionInsforgeEnv()) {
    try {
      ;[appointments, blockedDates, schedules, recorridos] = await Promise.all([
        getAdmissionAppointments(allowedLevels.length > 0 ? { levels: allowedLevels } : undefined),
        getBlockedDates(),
        getSchedules(),
        getRecorridos(),
      ])
    } catch (e) {
      console.error('Admin load error:', e)
    }
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-header-brand">
            <h1>{roleLabel}</h1>
            <span className="admin-header-badge">
              <span aria-hidden="true">🎓</span>
              Citas de examen de admisión
            </span>
          </div>
          <div className="admin-header-actions">
            <AdminThemeToggle />
            <a href="/dashboard" className="admin-link">← Servicios</a>
            <a href="/api/admin/logout" className="admin-link">Cambiar área</a>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <AdminDashboard
          appointments={appointments}
          blockedDates={blockedDates}
          schedules={schedules}
          recorridos={recorridos}
          allowedLevels={allowedLevels}
        />
      </main>
    </div>
  )
}
