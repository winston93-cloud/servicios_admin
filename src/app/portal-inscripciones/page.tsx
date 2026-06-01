'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function PortalInscripcionesPage() {
  const router = useRouter()

  return (
    <ProtectedRoute>
      <div className="dashboard-container">
        <div className="dashboard-main">
          <div className="dashboard-heading">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft size={16} aria-hidden />
              Volver al inicio
            </button>
            <h1 className="dashboard-title">Portal de inscripciones</h1>
            <p className="dashboard-subtitle">Registro y seguimiento de inscripciones en línea</p>
          </div>

          <div className="servicios-panel-card">
            <p className="servicios-panel-hint">
              Este módulo estará disponible próximamente.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
