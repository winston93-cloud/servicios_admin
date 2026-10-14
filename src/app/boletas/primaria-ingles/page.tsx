'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PrimariaDireccion from '../primaria-comun/PrimariaDireccion'

export default function BoletasPrimariaInglesPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <PrimariaDireccion idioma="en" />
    </ProtectedRoute>
  )
}
