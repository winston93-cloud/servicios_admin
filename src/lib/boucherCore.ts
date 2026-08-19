/** Utilidades legacy para bauchers (port de core.php). */

import {
  anioCalendarioConcepto,
  diaLimiteSinRecargo,
  mesDeConcepto,
} from './colegiaturaPrecioReglas'
import { normalizarConceptoNo } from './pagoReferenciaColegiatura'

export { normalizarConceptoNo }

const MESES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export function formatearMonedaBoucher(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatearFechaBoucher(fechaIso: string): string {
  const m = fechaIso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return fechaIso
  const mes = parseInt(m[2], 10)
  return `${parseInt(m[3], 10)} de ${MESES[mes] ?? m[2]} de ${m[1]}`
}

/** ISO YYYY-MM-DD en calendario local (evita corrimiento UTC). */
function isoFechaLocal(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Vigencia de cortesía: hoy + 7 días (tras el día 10 del concepto). */
export function vigenciaBoucherMasUnaSemana(fecha = new Date()): string {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 7)
  return isoFechaLocal(d)
}

/** @deprecated Preferir vigenciaBoucherParaConcepto; queda como hoy+7. */
export function vigenciaBoucherPorDefecto(fecha = new Date()): string {
  return vigenciaBoucherMasUnaSemana(fecha)
}

/**
 * Validez impresa en baucher (ventanilla Banorte):
 * - Concepto 00 (Cuota de Inicio de Curso): siempre día 24 de agosto del ciclo
 *   (límite real; no usar cortesía hoy+7).
 * - Otros conceptos con mes (01…): hasta el día 10 de ese mes/año del ciclo.
 * - Si ya pasó el 10 (colegiaturas): vigencia = hoy + 7 días.
 * - Sin mes de concepto (inscripción, etc.): hoy + 7 días.
 */
export function vigenciaBoucherParaConcepto(
  conceptoNo: string,
  cicloEscolar: number,
  fecha = new Date()
): string {
  const c = normalizarConceptoNo(conceptoNo)
  const mes = mesDeConcepto(c)
  const anio =
    Number.isFinite(cicloEscolar) && cicloEscolar > 0
      ? anioCalendarioConcepto(c, cicloEscolar)
      : null

  if (mes != null && anio != null) {
    const diaLimite = diaLimiteSinRecargo(c)
    const limiteIso = `${anio}-${String(mes).padStart(2, '0')}-${String(diaLimite).padStart(2, '0')}`
    // Cuota de inicio de curso: fecha límite fija (24 ago), aunque ya haya pasado.
    if (c === '00') {
      return limiteIso
    }
    const limite = new Date(anio, mes - 1, diaLimite)
    const hoy = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
    if (hoy.getTime() <= limite.getTime()) {
      return limiteIso
    }
    return vigenciaBoucherMasUnaSemana(fecha)
  }

  return vigenciaBoucherMasUnaSemana(fecha)
}

/**
 * Placeholder del UI admin (`0` / vacío). No confundir con concepto `00`
 * (Cuota de Inicio de Curso), que sí es válido.
 */
export function conceptoBoucherAusente(raw: unknown): boolean {
  if (raw == null) return true
  const s = String(raw).trim()
  return !s || s === '0'
}

export function getPaymentConcept(conceptoNo: string): string {
  const c = normalizarConceptoNo(conceptoNo)
  switch (c) {
    case '00':
      return 'Cuota de Inicio de Curso'
    case '01':
      return 'Colegiatura Septiembre'
    case '02':
      return 'Colegiatura Octubre'
    case '03':
      return 'Colegiatura Noviembre'
    case '04':
      return 'Colegiatura Diciembre'
    case '05':
      return 'Colegiatura Enero'
    case '06':
      return 'Colegiatura Febrero'
    case '07':
      return 'Colegiatura Marzo'
    case '08':
      return 'Colegiatura Abril'
    case '09':
      return 'Colegiatura Mayo'
    case '10':
      return 'Colegiatura Junio'
    case '11':
      return 'Reinscripción (Diferido 1)'
    case '12':
      return 'Reinscripción (Diferido 2)'
    case '13':
      return 'Inscripción'
    case '16':
      return 'Material (legacy)'
    case '17':
      return 'Herramientas Tecnológicas y Evaluaciones'
    case '18':
      return 'Seguro'
    case '19':
      return 'Certificación Cambridge 1'
    case '20':
      return 'Certificación Cambridge 2'
    case '21':
      return 'Cuota de Padres'
    case '22':
      return 'Certificación Cambridge 3'
    case '23':
      return 'Doble Titulación 1'
    case '24':
      return 'Doble Titulación 2'
    case '25':
      return 'Doble Titulación 3'
    case '26':
      return 'Colegiatura Julio'
    case '30':
      return 'Pago Anual'
    default:
      return '-None-'
  }
}

export function getFullLevel(nivel: number, grado: number): string {
  switch (nivel) {
    case 1:
      if (grado === 1) return 'Maternal A'
      if (grado === 2) return 'Maternal B'
      return 'Maternal'
    case 2:
      return `Kinder-${grado}`
    case 3:
      return `${grado}° Primaria`
    case 4:
      if (grado === 1) return '7mo Secundaria'
      if (grado === 2) return '8vo Secundaria'
      if (grado === 3) return '9no Secundaria'
      if (grado > 3) return 'EGRESADO'
      return `${grado}° Secundaria`
    default:
      return '-'
  }
}

export function nivelPrecioBoucher(nivel: number, grado: number): number {
  if (nivel === 2 && grado === 1) return 1
  return nivel
}

/**
 * Filas de `pago_boucher_precio.alumno_nivel` (no es el mismo mapeo que alumno_nivel escolar).
 * 1 = Maternal A/B + Kinder-1 · 2 = Kinder-2/3 · 3 = Primaria · 4 = Secundaria
 */
export const NIVELES_PRECIO_BOUCHER_OPCIONES = [
  { valor: 1, etiqueta: 'Maternal A/B + Kinder-1', detalle: 'Maternal A, Maternal B y Kinder-1' },
  { valor: 2, etiqueta: 'Kinder-2 + Kinder-3', detalle: 'Kinder-2 y Kinder-3' },
  { valor: 3, etiqueta: 'Primaria', detalle: '1° a 6° de Primaria' },
  { valor: 4, etiqueta: 'Secundaria', detalle: '7mo, 8vo y 9no' },
] as const

export function etiquetaNivelPrecioBoucher(
  nivel: number | null | undefined
): string {
  const n = Number(nivel)
  const hit = NIVELES_PRECIO_BOUCHER_OPCIONES.find((o) => o.valor === n)
  return hit?.etiqueta ?? (Number.isFinite(n) ? `Nivel precio ${n}` : '')
}

export function gradoPdfBoucher(nivel: number, grado: number): number {
  if (nivel === 4 && grado === 4) return 3
  return grado
}

export function getEmitter(nivel: number, _grado: number, tipo: 1 | 2 = 1): string {
  if (tipo === 1) {
    if (nivel === 1 || nivel === 2) return '139206'
    return '50966'
  }
  if (nivel === 1 || nivel === 2) return '139193'
  return '49671'
}

export function getClient(nivel: number): string {
  if (nivel === 1) return 'Instituto Educativo Winston.'
  if (nivel === 2) return 'Instituto Educativo Winston.'
  return 'Instituto Winston Churchill AC.'
}

export function getDiscount(amount: number, percent: number): number {
  return amount - amount * (percent * 0.01)
}

/** Normaliza importe con formato es-MX o símbolo $ (legacy number_format). */
export function parseImporteBoucher(valor: number | string | null | undefined): number {
  if (valor == null || valor === '') return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const limpio = String(valor).replace(/[$\s]/g, '').replace(/,/g, '')
  const n = parseFloat(limpio)
  return Number.isFinite(n) ? n : 0
}

/** Referencia de 12 dígitos: base + dígito importe + 2 verificadores Banorte. */
export function formatearReferenciaBoucher(ref: string): string {
  const d = ref.replace(/\D/g, '')
  if (d.length !== 12) return ref
  return `${d.slice(0, 5)} ${d.slice(5, 10)} ${d.slice(10)}`
}

/** Dígito verificador Banorte (Alan-Fn, legacy getDigVerif). */
export function getDigVerif(importe: number | string, referenciaBase: string): string {
  const importeTotal = parseImporteBoucher(importe)
  let importeStr = importeTotal.toFixed(2)
  importeStr = importeStr.replace('.', '').replace(',', '')

  const arRef = [17, 13, 11, 23, 19, 17, 13, 11, 23, 19, 17, 13, 11, 23, 19, 17, 13, 0]
  const arImp = [1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7]

  const imp: number[] = new Array(12).fill(0)
  const posImp = 12 - importeStr.length
  let aux = 0
  for (let i = 0; i < arImp.length; i++) {
    if (i < posImp) imp[i] = 0
    else {
      imp[i] = parseInt(importeStr.charAt(aux), 10)
      aux++
    }
  }

  let digImp = 0
  for (let i = 0; i < 12; i++) digImp += imp[i] * arImp[i]
  digImp %= 10

  let digitoFinal = `${referenciaBase}${digImp}`

  const num: number[] = new Array(18).fill(0)
  const posRef = 18 - digitoFinal.length
  aux = 0
  for (let i = 0; i < arRef.length; i++) {
    if (i < posRef) num[i] = 0
    else {
      num[i] = parseInt(digitoFinal.charAt(aux), 10)
      aux++
    }
  }

  let digRef = 0
  for (let i = 0; i < 18; i++) digRef += num[i] * arRef[i]
  digRef = ((digRef + 330) % 97) + 1

  const digRefStr = digRef < 10 ? `0${digRef}` : String(digRef)
  return `${digitoFinal}${digRefStr}`
}

export function referenciaSemibase(
  alumnoRef: string | number,
  conceptoNo: string,
  cicloEscolar: number
): string {
  const ref = String(alumnoRef).replace(/\D/g, '')
  const concepto = normalizarConceptoNo(conceptoNo)
  const ciclo = String(cicloEscolar).replace(/\D/g, '')
  return `${ref}${concepto}${ciclo}`
}
