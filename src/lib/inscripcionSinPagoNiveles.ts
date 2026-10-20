/** Días sin pagar inscripción para avisar a control escolar (y sistemas). */
export const DIAS_AVISO_CONTROL_ESCOLAR = 15
/** Días sin pagar para avisar a las directoras de cada nivel (15 de control escolar + 30). */
export const DIAS_AVISO_DIRECCION = 45

export type EtapaAvisoInscripcion = 'control-escolar' | 'direccion'

type ReglaAviso = { niveles: number[]; etapa: EtapaAvisoInscripcion }

/**
 * Quién recibe el aviso, de qué niveles y en qué escalón. Niveles: 1 maternal, 2 kinder, 3 primaria, 4 secundaria.
 * Las directoras ven lo mismo que control escolar de su nivel (kinder incluye maternal).
 */
const AVISO_POR_USUARIO: Record<number, ReglaAviso> = {
  39: { niveles: [1, 2], etapa: 'control-escolar' }, // fatima — control escolar maternal/kinder
  16: { niveles: [3], etapa: 'control-escolar' }, // controlprim — control escolar primaria
  50: { niveles: [4], etapa: 'control-escolar' }, // coordsec — control escolar secundaria
  17: { niveles: [1, 2, 3, 4], etapa: 'control-escolar' }, // sistemas.desarrollo (Mario)
  8: { niveles: [1, 2], etapa: 'direccion' }, // direccion.kinder
  54: { niveles: [1, 2], etapa: 'direccion' }, // englishcoord.educativo — dirección inglés kinder
  7: { niveles: [3], etapa: 'direccion' }, // direccion.primaria
  10: { niveles: [3], etapa: 'direccion' }, // coordinacioninglesprimaria — dirección inglés primaria
  13: { niveles: [4], etapa: 'direccion' }, // direccion.secundaria
}

export function diasAvisoEtapa(etapa: EtapaAvisoInscripcion): number {
  return etapa === 'direccion' ? DIAS_AVISO_DIRECCION : DIAS_AVISO_CONTROL_ESCOLAR
}

export function reglaAvisoInscripcion(usuarioId: number): (ReglaAviso & { dias: number }) | null {
  const r = AVISO_POR_USUARIO[usuarioId]
  return r ? { ...r, dias: diasAvisoEtapa(r.etapa) } : null
}

export function nivelesAlertaInscripcion(usuarioId: number): number[] {
  return AVISO_POR_USUARIO[usuarioId]?.niveles ?? []
}

export function usuariosAlertaInscripcion(): number[] {
  return Object.keys(AVISO_POR_USUARIO).map(Number)
}

export const TODOS_NIVELES_ALERTA_INSCRIPCION = [1, 2, 3, 4]
