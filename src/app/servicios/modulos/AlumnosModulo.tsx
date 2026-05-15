'use client'

import { useState } from 'react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import AlumnoDatosTabs from '../components/AlumnoDatosTabs'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'

export default function AlumnosModulo() {
  const { cicloSeleccionado } = useCicloEscolar()
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<AlumnoBusquedaResultado | null>(
    null
  )

  return (
    <div className="servicios-panel-inner servicios-panel-inner--alumnos">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Alumnos</h1>
      </header>

      <AlumnoAutocomplete
        key={cicloSeleccionado}
        onSeleccionar={setAlumnoSeleccionado}
      />

      <AlumnoDatosTabs key={cicloSeleccionado} alumno={alumnoSeleccionado} />
    </div>
  )
}
