'use client'

import AlumnoAutocomplete from '../components/AlumnoAutocomplete'

export default function AlumnosModulo() {
  return (
    <div className="servicios-panel-inner servicios-panel-inner--alumnos">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Alumnos</h1>
      </header>

      <AlumnoAutocomplete />
    </div>
  )
}
