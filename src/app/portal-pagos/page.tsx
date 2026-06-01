'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalPagosAlumnoView from './components/PortalPagosAlumnoView'

export default function PortalPagosPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <PortalPagosAlumnoView />
    </ProtectedRoute>
  )
}
