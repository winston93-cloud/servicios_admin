'use client'

import { useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { portalSessionHeaderName, readPortalSessionForFetch } from '@/lib/insforgeDbProxyShared'

export default function AdminStaffGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const raw = readPortalSessionForFetch()
    if (!raw) return
    fetch('/api/auth/staff-session', {
      method: 'POST',
      headers: { [portalSessionHeaderName()]: raw },
    }).catch(() => {})
  }, [])

  return (
    <ProtectedRoute roles={['usuario']}>
      {children}
    </ProtectedRoute>
  )
}
