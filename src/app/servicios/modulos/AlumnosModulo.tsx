'use client'

import { useState } from 'react'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import AlumnoDatosTabs from '../components/AlumnoDatosTabs'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'

export default function AlumnosModulo() {
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<AlumnoBusquedaResultado | null>(
    null
  )

  return (
    <div className="servicios-panel-inner servicios-panel-inner--alumnos">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Alumnos</h1>
      </header>

      <AlumnoAutocomplete onSeleccionar={setAlumnoSeleccionado} />

      <AlumnoDatosTabs alumno={alumnoSeleccionado} />
    </div>
  )
}
