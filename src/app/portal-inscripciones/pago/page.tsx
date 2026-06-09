'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalInscripcionPagoView from '../components/PortalInscripcionPagoView'

export default function PortalInscripcionPagoPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <PortalInscripcionPagoView />
    </ProtectedRoute>
  )
}
