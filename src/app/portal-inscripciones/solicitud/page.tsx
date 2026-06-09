'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import SolicitudInscripcionForm from '../components/SolicitudInscripcionForm'

export default function SolicitudInscripcionPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <div className="dashboard-container portal-inscripciones-page">
        <div className="dashboard-main portal-inscripciones-main portal-inscripciones-main--form">
          <SolicitudInscripcionForm />
        </div>
      </div>
    </ProtectedRoute>
  )
}
