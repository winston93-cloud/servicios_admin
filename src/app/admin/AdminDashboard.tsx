'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import AdminCitas from './AdminCitas'
import AdminBloquear from './AdminBloquear'
import AdminHorarios from './AdminHorarios'
import AdminBuscar from './AdminBuscar'
import AdminRecorridos from './AdminRecorridos'
import AdminMigracion from './AdminMigracion'
import AdminSyncRefs from './AdminSyncRefs'
import AdminReenviarInfo from './AdminReenviarInfo'
import type { AdmissionAppointment } from '@/types/admissionDatabase'
import type { BlockedDate } from '@/types/admissionDatabase'
import type { AdmissionSchedule } from '@/types/admissionDatabase'
import type { TourRecorrido } from '@/types/admissionDatabase'

type Section = 'citas' | 'horarios' | 'bloquear' | 'buscar' | 'recorridos' | 'migracion' | 'sync-refs' | 'reenviar-info' | null

const CARDS: { id: Section; icon: string; title: string; description: string; accent: string }[] = [
  {
    id: 'citas',
    icon: '📅',
    title: 'Examenes programados',
    description: 'Ver, reagendar y cambiar estado de las citas',
    accent: 'citas',
  },
  {
    id: 'horarios',
    icon: '🕐',
    title: 'Horarios por nivel',
    description: 'Configurar horarios disponibles por nivel',
    accent: 'horarios',
  },
  {
    id: 'bloquear',
    icon: '🚫',
    title: 'Días bloqueados por nivel',
    description: 'Bloquear fechas para un nivel',
    accent: 'bloquear',
  },
  {
    id: 'buscar',
    icon: '🔍',
    title: 'Buscar alumno',
    description: 'Búsqueda por nombre o fecha; ver datos y reagendar',
    accent: 'buscar',
  },
  {
    id: 'recorridos',
    icon: '🚌',
    title: 'Recorridos programados',
    description: 'Ver y gestionar recorridos programados',
    accent: 'recorridos',
  },
  {
    id: 'migracion',
    icon: '🗃️',
    title: 'Migración sistema anterior',
    description: 'Importar alumnos pendientes del ciclo 2025-2026 y 2026-2027',
    accent: 'migracion',
  },
  {
    id: 'sync-refs',
    icon: '🔄',
    title: 'Sincronizar números de control',
    description: 'Vincular números de control de MySQL a citas completadas',
    accent: 'sync',
  },
  {
    id: 'reenviar-info',
    icon: '✉️',
    title: 'Reenviar información',
    description: 'Reenviar correo de confirmación con enlace a documentos y expediente',
    accent: 'reenviar',
  },
]

export default function AdminDashboard({
  appointments,
  blockedDates,
  schedules,
  recorridos,
  allowedLevels,
}: {
  appointments: AdmissionAppointment[]
  blockedDates: BlockedDate[]
  schedules: AdmissionSchedule[]
  recorridos: TourRecorrido[]
  allowedLevels: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sectionParam = searchParams.get('section') as Section

  // Estado local sincronizado con URL
  const [activeSection, setActiveSectionState] = useState<Section>(sectionParam)

  // Sincronizar cuando cambia la URL (por navegación atrás/adelante)
  useEffect(() => {
    setActiveSectionState(sectionParam)
  }, [sectionParam])

  const handleSetSection = (section: Section) => {
    setActiveSectionState(section)
    const params = new URLSearchParams(searchParams)
    if (section) {
      params.set('section', section)
    } else {
      params.delete('section')
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  if (activeSection) {
    return (
      <div className="admin-dashboard-content">
        <button
          type="button"
          className="admin-back-cards"
          onClick={() => handleSetSection(null)}
        >
          <span aria-hidden="true">←</span> Volver
        </button>
        {activeSection === 'citas' && (
          <section className="admin-section admin-section-citas">
            <h2><span className="admin-section-icon" aria-hidden="true">📅</span> Exámenes programados</h2>
            <AdminCitas appointments={appointments} allowedLevels={allowedLevels} />
          </section>
        )}
        {activeSection === 'horarios' && (
          <section className="admin-section admin-section-horarios">
            <h2><span className="admin-section-icon" aria-hidden="true">🕐</span> Horarios por nivel</h2>
            <AdminHorarios schedules={schedules} />
          </section>
        )}
        {activeSection === 'bloquear' && (
          <section className="admin-section admin-section-bloquear">
            <h2><span className="admin-section-icon" aria-hidden="true">🚫</span> Días bloqueados por nivel</h2>
            <p className="admin-hint">
              Si bloqueas un día para un nivel (ej. Secundaria), los otros niveles (Maternal/Kinder, Primaria) siguen pudiendo agendar ese día.
            </p>
            <AdminBloquear blockedDates={blockedDates} schedules={schedules} />
          </section>
        )}
        {activeSection === 'buscar' && (
          <section className="admin-section admin-section-buscar">
            <h2><span className="admin-section-icon" aria-hidden="true">🔍</span> Buscar alumno</h2>
            <p className="admin-hint">
              Busque por nombre del alumno o tutor, por fecha en que se agendó la cita o por fecha del examen. Al seleccionar un resultado verá el registro completo y podrá reagendar.
            </p>
            <AdminBuscar allowedLevels={allowedLevels} />
          </section>
        )}
        {activeSection === 'recorridos' && (
          <section className="admin-section admin-section-recorridos">
            <h2><span className="admin-section-icon" aria-hidden="true">🚌</span> Recorridos programados</h2>
            <AdminRecorridos recorridos={recorridos} />
          </section>
        )}
        {activeSection === 'migracion' && (
          <section className="admin-section admin-section-migracion">
            <h2><span className="admin-section-icon" aria-hidden="true">🗃️</span> Migración sistema anterior</h2>
            <AdminMigracion />
          </section>
        )}
        {activeSection === 'sync-refs' && (
          <section className="admin-section admin-section-sync">
            <AdminSyncRefs />
          </section>
        )}
        {activeSection === 'reenviar-info' && (
          <section className="admin-section admin-section-reenviar">
            <h2>
              <span className="admin-section-icon" aria-hidden="true">
                ✉️
              </span>{' '}
              Reenviar información
            </h2>
            <AdminReenviarInfo appointments={appointments} allowedLevels={allowedLevels} />
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="admin-cards-grid">
      {CARDS.map((card) => (
        <button
          key={card.id}
          type="button"
          className={`admin-card admin-card-${card.accent}`}
          onClick={() => handleSetSection(card.id)}
          aria-label={`${card.title}. ${card.description}`}
        >
          <span className="admin-card-icon" aria-hidden="true">{card.icon}</span>
          <h3 className="admin-card-title">{card.title}</h3>
          <p className="admin-card-desc">{card.description}</p>
          <span className="admin-card-arrow" aria-hidden="true">→</span>
        </button>
      ))}
    </div>
  )
}
