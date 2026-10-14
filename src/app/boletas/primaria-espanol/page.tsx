'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PrimariaDireccion from '../primaria-comun/PrimariaDireccion'

export default function BoletasPrimariaEspanolPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <PrimariaDireccion idioma="es" />
    </ProtectedRoute>
  )
}
