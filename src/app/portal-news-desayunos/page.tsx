'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PortalNewsDesayunosView from './components/PortalNewsDesayunosView'

export default function PortalNewsDesayunosPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <PortalNewsDesayunosView />
    </ProtectedRoute>
  )
}
