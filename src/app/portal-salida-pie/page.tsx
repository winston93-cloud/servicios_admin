'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalSalidaPieView from './components/PortalSalidaPieView'

export default function PortalSalidaPiePage() {
  return (
    <ProtectedRoute>
      <PortalSalidaPieView />
    </ProtectedRoute>
  )
}
