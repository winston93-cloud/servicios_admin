'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalInscripcionesView from './components/PortalInscripcionesView'

export default function PortalInscripcionesPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <PortalInscripcionesView />
    </ProtectedRoute>
  )
}
