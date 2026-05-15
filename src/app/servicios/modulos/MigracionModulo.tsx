'use client'

import MigracionAlumnoPanel from '../components/MigracionAlumnoPanel'

export default function MigracionModulo() {
  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Migración de tablas</h1>
      </header>
      <MigracionAlumnoPanel />
    </div>
  )
}
