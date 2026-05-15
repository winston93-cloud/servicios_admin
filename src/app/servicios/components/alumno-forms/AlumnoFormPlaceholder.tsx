'use client'

import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'

interface AlumnoFormPlaceholderProps {
  titulo: string
  descripcion: string
  alumno: AlumnoBusquedaResultado
}

export default function AlumnoFormPlaceholder({
  titulo,
  descripcion,
  alumno,
}: AlumnoFormPlaceholderProps) {
  return (
    <div className="alumno-form-placeholder">
      <h3 className="alumno-form-placeholder-title">{titulo}</h3>
      <p className="alumno-form-placeholder-desc">{descripcion}</p>
      <p className="alumno-form-placeholder-ref">
        Alumno: <strong>{alumno.nombre_completo}</strong> · No. control {alumno.alumno_ref}
      </p>
    </div>
  )
}
