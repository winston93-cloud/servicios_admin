'use client'

import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import AlumnoDatosTabs from '../components/AlumnoDatosTabs'

export default function AlumnosModulo() {
  const { cicloSeleccionado } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado } = useAlumnoSeleccionado()

  return (
    <div className="servicios-panel-inner servicios-panel-inner--alumnos">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Alumnos</h1>
      </header>

      <AlumnoAutocomplete
        alumnoSeleccionado={alumnoSeleccionado}
        onSeleccionar={setAlumnoSeleccionado}
      />

      <AlumnoDatosTabs key={cicloSeleccionado} alumno={alumnoSeleccionado} />
    </div>
  )
}
