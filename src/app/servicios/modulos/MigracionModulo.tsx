'use client'

import MigracionAlumnoPanel from '../components/MigracionAlumnoPanel'

export default function MigracionModulo() {
  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Migración de tablas</h1>
        <p className="servicios-panel-lead">
          Sincroniza phpMyAdmin (MySQL) → Supabase. Ejecuta en Vercel con reporte por tabla:
          insertados, actualizados, sin cambios y eliminados.
        </p>
      </header>
      <MigracionAlumnoPanel />
    </div>
  )
}
