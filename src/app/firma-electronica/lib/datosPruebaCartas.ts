/**
 * 2026-08-21 - Datos de prueba para cartas de aceptación de beca (sandbox).
 */
import type { NivelFirma } from './plantillasNivel'

export type DatosCartaBeca = {
  tutorNombre: string
  alumnoNombre: string
  grado: string
  tipoBeca: string
  porcentaje: string
  cicloLabel: string
  fechaCarta: string
  ciudadFecha: string
  promedioMinimo: string
  promedioMinimoLetras: string
  comiteLabel: string
  condicionesExtra?: string[]
}

export const DATOS_PRUEBA_POR_NIVEL: Record<NivelFirma, DatosCartaBeca> = {
  'maternal-kinder': {
    tutorNombre: 'PADRE DE FAMILIA',
    alumnoNombre: 'CASTILLO RODRIGUEZ JAMES DAVID',
    grado: 'KINDER 2',
    tipoBeca: 'PEMEX',
    porcentaje: '20%',
    cicloLabel: '2026-2027',
    fechaCarta: '21/agosto/2026',
    ciudadFecha: 'Cd. Madero, Tam. agosto de 2026',
    promedioMinimo: '8.0',
    promedioMinimoLetras: 'OCHO PUNTO CERO',
    comiteLabel: 'COMITÉ DE BECAS',
  },
  primaria: {
    tutorNombre: 'ISIS BOURDON',
    alumnoNombre: 'HERNANDEZ BOURDON GAEL ALFONSO',
    grado: '2°',
    tipoBeca: 'Académica',
    porcentaje: '10%',
    cicloLabel: '2026-2027',
    fechaCarta: '21/agosto/2026',
    ciudadFecha: 'Cd. Madero, Tam. agosto de 2026',
    promedioMinimo: '8.5',
    promedioMinimoLetras: 'OCHO PUNTO CINCO',
    comiteLabel: 'COMITÉ DE BECAS PRIMARIA',
    condicionesExtra: [
      'Si el promedio baja de 8.5 a 8.0 el porcentaje de beca se reduce 5%; si baja de 8.0, se cancela.',
    ],
  },
  secundaria: {
    tutorNombre: 'CEDILLO DE LA CRUZ BRENDA LYSETT',
    alumnoNombre: 'VERONICO CEDILLO FRIDA',
    grado: '9no',
    tipoBeca: 'Beca de WINSTON',
    porcentaje: '20%',
    cicloLabel: '2026-2027',
    fechaCarta: '21/agosto/2026',
    ciudadFecha: 'Cd. Madero, Tam. Agosto 2026',
    promedioMinimo: '8.0',
    promedioMinimoLetras: 'OCHO PUNTO CERO',
    comiteLabel: 'COMITÉ DE BECAS SECUNDARIA',
  },
}
