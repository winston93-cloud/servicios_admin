'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalDocumentosNiView from '../components/PortalDocumentosNiView'

export default function PortalDocumentosNiPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <PortalDocumentosNiView />
    </ProtectedRoute>
  )
}
