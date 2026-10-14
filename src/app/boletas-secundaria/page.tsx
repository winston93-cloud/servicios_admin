'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import SecDireccion from '../boletas/secundaria-comun/SecDireccion'

export default function BoletasSecundariaPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <SecDireccion />
    </ProtectedRoute>
  )
}
