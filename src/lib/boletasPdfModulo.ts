import { generarPdfKinderEs } from './boletasKinderEsService'
import { generarPdfKinderEn } from './boletasKinderEnService'
import { generarPdfPrimariaEs } from './boletasPrimariaEsService'
import { generarPdfPrimariaEn } from './boletasPrimariaEnService'
import { generarBoletaPdfBuffer } from './boletasPdf'

/** Las boletas solo se descargan (portal de papás y dirección); no se envían por correo. */

export type BoletaModulo = 'kinder-es' | 'kinder-en' | 'primaria-es' | 'primaria-en' | 'secundaria'

export async function pdfModulo(input: { modulo: BoletaModulo; alumnoId: number; bimestre: number; ciclo: number }): Promise<Buffer> {
  const { modulo, alumnoId, bimestre, ciclo } = input
  switch (modulo) {
    case 'kinder-es':
      return generarPdfKinderEs({ alumnoId, bimestre, ciclo })
    case 'kinder-en':
      return generarPdfKinderEn({ alumnoId, bimestre, ciclo })
    case 'primaria-es':
      return generarPdfPrimariaEs({ alumnoId, bimestre, ciclo })
    case 'primaria-en':
      return generarPdfPrimariaEn({ alumnoId, bimestre, ciclo })
    case 'secundaria':
      return generarBoletaPdfBuffer({ alumnoId, ciclo, periodo: bimestre })
    default:
      throw new Error('Módulo no soportado')
  }
}
