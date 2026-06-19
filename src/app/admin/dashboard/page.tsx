import { cookies } from 'next/headers'
import DirectorDashboard from './DirectorDashboard'
import DirectorLogin from './DirectorLogin'
import { getPermissionRequests } from './actions'
import type { AdmissionLevel, PermissionRequest } from '@/types/admissionDatabase'

export const dynamic = 'force-dynamic'

export default async function DirectorDashboardPage() {
  const cookieStore = await cookies()
  const level = cookieStore.get('director_session')?.value as AdmissionLevel | undefined

  if (!level || !['maternal_kinder', 'primaria', 'secundaria'].includes(level)) {
    return <DirectorLogin />
  }

  let requests: PermissionRequest[] = []
  let loadError: string | null = null
  try {
    requests = await getPermissionRequests(level)
  } catch (e) {
    console.error('Error cargando solicitudes:', e)
    loadError = e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes.'
  }

  return (
    <>
      {loadError && (
        <div style={{
          maxWidth: 980,
          margin: '1rem auto -0.5rem',
          padding: '0 1rem',
        }}>
          <div style={{
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '0.75rem 1rem',
            fontWeight: 700,
          }}>
            Error cargando solicitudes: {loadError}
          </div>
        </div>
      )}
      <DirectorDashboard level={level} requests={requests} />
    </>
  )
}
