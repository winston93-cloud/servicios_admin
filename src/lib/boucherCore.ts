/** Utilidades legacy para bauchers (port de core.php). */

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

export function vigenciaBoucherPorDefecto(fecha = new Date()): string {
  const yyyy = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  let dd = fecha.getDate()
  if (dd < 29) dd += 2
  return `${yyyy}-${mm}-${String(dd).padStart(2, '0')}`
}

export function getPaymentConcept(conceptoNo: string): string {
  const c = normalizarConceptoNo(conceptoNo)
  switch (c) {
    case '00':
      return 'Cuota de inicio de ciclo escolar'
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
