'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalFacturacionView from './components/PortalFacturacionView'

export default function PortalFacturacionPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <PortalFacturacionView />
    </ProtectedRoute>
  )
}
