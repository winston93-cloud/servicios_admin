/** Control escolar ve su nivel; sistemas.desarrollo (17) los tres. Niveles: 1 maternal, 2 kinder, 3 primaria, 4 secundaria. */
const NIVELES_POR_USUARIO: Record<number, number[]> = {
  39: [1, 2], // fatima — control escolar maternal/kinder
  16: [3], // controlprim — control escolar primaria
  50: [4], // coordsec — control escolar secundaria
  17: [1, 2, 3, 4], // sistemas.desarrollo (Mario)
}

export function nivelesAlertaInscripcion(usuarioId: number): number[] {
  return NIVELES_POR_USUARIO[usuarioId] ?? []
}
