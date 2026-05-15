'use client'

import AlumnoAutocomplete from '../components/AlumnoAutocomplete'

export default function AlumnosModulo() {
  return (
    <div className="servicios-panel-inner servicios-panel-inner--alumnos">
      <header className="servicios-panel-header">
        <h1 className="servicios-panel-title">Alumnos</h1>
        <p className="servicios-panel-lead">
          Busca por nombre, apellido paterno o apellido materno. Las mejores coincidencias aparecen
          abajo; elige con el ratón o con el teclado.
        </p>
      </header>

      <AlumnoAutocomplete />
    </div>
  )
}
