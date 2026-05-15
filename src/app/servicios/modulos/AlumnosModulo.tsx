'use client'

import { useEffect, useState } from 'react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import AlumnoDatosTabs from '../components/AlumnoDatosTabs'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'

export default function AlumnosModulo() {
  const { cicloSeleccionado } = useCicloEscolar()
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<AlumnoBusquedaResultado | null>(
    null
  )

  useEffect(() => {
    setAlumnoSeleccionado(null)
  }, [cicloSeleccionado])

  return (
    <div className="servicios-panel-inner servicios-panel-inner--alumnos">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Alumnos</h1>
      </header>

      <AlumnoAutocomplete onSeleccionar={setAlumnoSeleccionado} />

      <AlumnoDatosTabs key={cicloSeleccionado} alumno={alumnoSeleccionado} />
    </div>
  )
}
