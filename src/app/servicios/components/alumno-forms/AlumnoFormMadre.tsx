'use client'

import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import { CONFIG_FAMILIAR_MADRE } from '@/lib/alumnoFamiliarFormConfig'
import AlumnoFormFamiliar from './AlumnoFormFamiliar'

interface AlumnoFormMadreProps {
  alumno: AlumnoBusquedaResultado
}

export default function AlumnoFormMadre({ alumno }: AlumnoFormMadreProps) {
  return <AlumnoFormFamiliar alumno={alumno} config={CONFIG_FAMILIAR_MADRE} />
}
