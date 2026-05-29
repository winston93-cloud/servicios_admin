'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function ProrrogasPage() {
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
            <h1 className="dashboard-title">Prórrogas</h1>
            <p className="dashboard-subtitle">Gestión de prórrogas de pago escolar</p>
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
