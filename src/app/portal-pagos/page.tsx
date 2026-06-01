'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function PortalPagosPage() {
  const router = useRouter()
  const { session, isAlumno } = useAuth()

  return (
    <ProtectedRoute>
      <div className="dashboard-container dashboard-home">
        <div className="dashboard-home-bg" aria-hidden />

        <div className="dashboard-main">
          <div className="dashboard-main-center">
            <div className="dashboard-heading">
              <button
                type="button"
                className="servicios-back-btn"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft size={16} aria-hidden />
                Volver al inicio
              </button>
              <h1 className="dashboard-title">Portal de pagos</h1>
              <p className="dashboard-subtitle">
                {isAlumno
                  ? `No. de control ${String(session?.alumno_ref ?? '').padStart(5, '0')}`
                  : 'Consulta y registro de pagos en línea'}
              </p>
            </div>

            <div className="servicios-panel-card portal-pagos-welcome">
              <p className="servicios-panel-hint">
                {isAlumno ? (
                  <>
                    Bienvenido, <strong>{session?.displayName}</strong>. Aquí podrás
                    consultar y realizar tus pagos escolares. El módulo se habilitará
                    en breve.
                  </>
                ) : (
                  <>
                    Vista administrativa del portal de pagos. El módulo se habilitará
                    en breve.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
