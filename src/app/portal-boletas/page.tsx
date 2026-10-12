'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalBoletasView from './components/PortalBoletasView'

export default function PortalBoletasPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <PortalBoletasView />
    </ProtectedRoute>
  )
}
