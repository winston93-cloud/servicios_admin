'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalQrAccesoView from './components/PortalQrAccesoView'

export default function PortalQrAccesoPage() {
  return (
    <ProtectedRoute>
      <PortalQrAccesoView />
    </ProtectedRoute>
  )
}
