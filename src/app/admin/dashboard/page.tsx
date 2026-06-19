import DirectorDashboard from './DirectorDashboard'
import { getAllPermissionRequests } from './actions'
import type { PermissionRequest } from '@/types/admissionDatabase'

export const dynamic = 'force-dynamic'

export default async function DirectorDashboardPage() {
  let requests: PermissionRequest[] = []
  let loadError: string | null = null
  try {
    requests = await getAllPermissionRequests()
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
      <DirectorDashboard requests={requests} />
    </>
  )
}
