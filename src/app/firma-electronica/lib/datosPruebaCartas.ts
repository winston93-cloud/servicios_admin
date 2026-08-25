/**
 * Datos de prueba para la Carta de Resolución de Beca (sandbox).
 * Ciclo: temporada actual (cicloOrigen calendario ago–jul), nunca un número fijo permanente.
 */
import {
  cicloEscolarActualBoletas,
  etiquetaCicloBoletas,
} from '@/lib/boletasCiclo'
import type { NivelFirma } from './plantillasNivel'
import { resolverPromedioMinimoCartaPdf } from './promedioMinimoCartaBeca'

export type DatosCartaBeca = {
  tutorNombre: string
  alumnoNombre: string
  grado: string
  tipoBeca: string
  becaId?: number | null
  porcentaje: string
  cicloLabel: string
  fechaCarta: string
  ciudadFecha: string
  promedioMinimo: string
  promedioMinimoLetras: string
  /** Override admin (beca Académica). */
  promedioMinimoCartaOverride?: number | null
  comiteLabel: string
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function cicloCartaBecaActual(now = new Date()): string {
  return etiquetaCicloBoletas(cicloEscolarActualBoletas(now)).replace('-', '–')
}

export function fechaCartaLarga(now = new Date()): string {
  return `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`
}

export function ciudadFechaCarta(now = new Date()): string {
  return `Cd. Madero, Tam. ${MESES[now.getMonth()]} de ${now.getFullYear()}`
}

export function tipoBecaCompleto(tipo: string, porcentaje: string): string {
  const p = porcentaje.trim()
  if (!p) return tipo
  return `${tipo} (${p})`
}

export const DATOS_PRUEBA_POR_NIVEL: Record<NivelFirma, DatosCartaBeca> = {
  'maternal-kinder': {
    tutorNombre: 'PADRE DE FAMILIA',
    alumnoNombre: 'CASTILLO RODRIGUEZ JAMES DAVID',
    grado: 'KINDER 2',
    tipoBeca: 'PEMEX',
    becaId: 1,
    porcentaje: '20%',
    cicloLabel: '',
    fechaCarta: '',
    ciudadFecha: '',
    promedioMinimo: '',
    promedioMinimoLetras: '',
    comiteLabel: 'COMITÉ DE BECAS',
  },
  primaria: {
    tutorNombre: 'ISIS BOURDON',
    alumnoNombre: 'HERNANDEZ BOURDON GAEL ALFONSO',
    grado: '2° PRIMARIA',
    tipoBeca: 'Académica',
    becaId: 8,
    porcentaje: '10%',
    cicloLabel: '',
    fechaCarta: '',
    ciudadFecha: '',
    promedioMinimo: '',
    promedioMinimoLetras: '',
    comiteLabel: 'COMITÉ DE BECAS',
  },
  secundaria: {
    tutorNombre: 'CEDILLO DE LA CRUZ BRENDA LYSETT',
    alumnoNombre: 'VERONICO CEDILLO FRIDA',
    grado: '3° SECUNDARIA',
    tipoBeca: 'Beca Winston',
    becaId: 3,
    porcentaje: '20%',
    cicloLabel: '',
    fechaCarta: '',
    ciudadFecha: '',
    promedioMinimo: '',
    promedioMinimoLetras: '',
    comiteLabel: 'COMITÉ DE BECAS',
  },
}

export function datosCartaParaPdf(
  nivel: NivelFirma,
  override?: Partial<DatosCartaBeca>,
  now = new Date()
): DatosCartaBeca {
  const base = DATOS_PRUEBA_POR_NIVEL[nivel]
  const merged = {
    ...base,
    cicloLabel: cicloCartaBecaActual(now),
    fechaCarta: fechaCartaLarga(now),
    ciudadFecha: ciudadFechaCarta(now),
    ...override,
  }
  const promedio = resolverPromedioMinimoCartaPdf({
    becaId: merged.becaId,
    becaClase: merged.tipoBeca,
    promedioAcademicoOverride: merged.promedioMinimoCartaOverride,
  })
  return {
    ...merged,
    ...promedio,
  }
}
