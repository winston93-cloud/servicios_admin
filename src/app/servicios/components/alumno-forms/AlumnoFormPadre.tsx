'use client'

import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { CONFIG_FAMILIAR_PADRE } from '@/lib/alumnoFamiliarFormConfig'
import AlumnoFormFamiliar from './AlumnoFormFamiliar'

interface AlumnoFormPadreProps {
  alumno: AlumnoBusquedaResultado
}

export default function AlumnoFormPadre({ alumno }: AlumnoFormPadreProps) {
  return <AlumnoFormFamiliar alumno={alumno} config={CONFIG_FAMILIAR_PADRE} />
}
