import type { CfdiInstitucionEducativa } from './cfdiTypes'

export function institucionPorNivel(
  nivel: number,
  nombreCompleto: string,
  curp: string
): CfdiInstitucionEducativa {
  if (nivel < 3) {
    return {
      nombreAlumno: nombreCompleto,
      curp: curp || 'XXXXXXXXXXXXXXXXXX',
      nivelEducativo: 'Preescolar',
      claveInstitucion: '28PJN0671F',
    }
  }
  if (nivel === 3) {
    return {
      nombreAlumno: nombreCompleto,
      curp: curp || 'XXXXXXXXXXXXXXXXXX',
      nivelEducativo: 'Primaria',
      claveInstitucion: '28PPR0160V',
    }
  }
  return {
    nombreAlumno: nombreCompleto,
    curp: curp || 'XXXXXXXXXXXXXXXXXX',
    nivelEducativo: 'Secundaria',
    claveInstitucion: '28PES0124J',
  }
}
