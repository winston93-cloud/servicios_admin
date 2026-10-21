'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalAutorizadosView from './components/PortalAutorizadosView'

export default function PortalAutorizadosPage() {
  return (
    <ProtectedRoute>
      <PortalAutorizadosView />
    </ProtectedRoute>
  )
}
