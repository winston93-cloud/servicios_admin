'use client'

import { useState, type ReactNode } from 'react'
import { GraduationCap, UserRound } from 'lucide-react'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import AlumnoFormPlaceholder from './alumno-forms/AlumnoFormPlaceholder'

export type AlumnoDatosTabId = 'elementales' | 'madre' | 'padre'

const TABS: {
  id: AlumnoDatosTabId
  label: string
  shortLabel: string
  icon: ReactNode
}[] = [
  {
    id: 'elementales',
    label: 'Datos elementales de alumno',
    shortLabel: 'Alumno',
    icon: <GraduationCap size={18} strokeWidth={2} aria-hidden />,
  },
  {
    id: 'madre',
    label: 'Datos de la madre del alumno',
    shortLabel: 'Madre',
    icon: <UserRound size={18} strokeWidth={2} aria-hidden />,
  },
  {
    id: 'padre',
    label: 'Datos del padre del alumno',
    shortLabel: 'Padre',
    icon: <UserRound size={18} strokeWidth={2} aria-hidden />,
  },
]

interface AlumnoDatosTabsProps {
  alumno: AlumnoBusquedaResultado | null
}

export default function AlumnoDatosTabs({ alumno }: AlumnoDatosTabsProps) {
  const [tabActiva, setTabActiva] = useState<AlumnoDatosTabId>('elementales')

  const panelId = (id: AlumnoDatosTabId) => `alumno-tab-panel-${id}`

  return (
    <section className="alumno-tabs" aria-label="Datos del alumno">
      <div className="alumno-tabs-list" role="tablist" aria-label="Secciones de datos">
        {TABS.map((tab) => {
          const activa = tabActiva === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`alumno-tab-${tab.id}`}
              aria-selected={activa}
              aria-controls={panelId(tab.id)}
              tabIndex={activa ? 0 : -1}
              className={`alumno-tabs-trigger ${activa ? 'alumno-tabs-trigger--active' : ''}`}
              onClick={() => setTabActiva(tab.id)}
            >
              <span className="alumno-tabs-trigger-icon">{tab.icon}</span>
              <span className="alumno-tabs-trigger-label">{tab.label}</span>
              <span className="alumno-tabs-trigger-short">{tab.shortLabel}</span>
            </button>
          )
        })}
      </div>

      <div className="alumno-tabs-panels">
        {!alumno ? (
          <div className="alumno-tabs-empty" role="tabpanel">
            <p>Selecciona un alumno en el buscador para ver y editar sus datos.</p>
          </div>
        ) : (
          TABS.map((tab) => {
            const activa = tabActiva === tab.id
            return (
              <div
                key={tab.id}
                id={panelId(tab.id)}
                role="tabpanel"
                aria-labelledby={`alumno-tab-${tab.id}`}
                hidden={!activa}
                className={`alumno-tabs-panel ${activa ? 'alumno-tabs-panel--active' : ''}`}
              >
                {tab.id === 'elementales' && (
                  <AlumnoFormPlaceholder
                    titulo="Datos elementales de alumno"
                    descripcion="Aquí irán los campos básicos del alumno (nombre, nivel, grupo, contacto, etc.)."
                    alumno={alumno}
                  />
                )}
                {tab.id === 'madre' && (
                  <AlumnoFormPlaceholder
                    titulo="Datos de la madre del alumno"
                    descripcion="Aquí irán apellidos, nombre, correo, teléfono, CURP y preferencias de contacto."
                    alumno={alumno}
                  />
                )}
                {tab.id === 'padre' && (
                  <AlumnoFormPlaceholder
                    titulo="Datos del padre del alumno"
                    descripcion="Aquí irán apellidos, nombre, correo, teléfono, CURP y preferencias de contacto."
                    alumno={alumno}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
