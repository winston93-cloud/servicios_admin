/** Convierte importe a leyenda de cheque (pesos mexicanos), estilo legacy. */
export function importeEnLetrasPesos(importe: number): string {
  const entero = Math.floor(Math.abs(importe))
  const centavos = Math.round((Math.abs(importe) - entero) * 100)

  if (entero === 0 && centavos === 0) {
    return 'CERO PESOS /100 MN'
  }

  const letras = numeroALetras(entero)
  const base = `${letras} PESOS`
  if (centavos > 0) {
    return `${base} ${String(centavos).padStart(2, '0')}/100 MN`
  }
  return `${base} /100 MN`
}

const UNIDADES = [
  '',
  'UN',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISEIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
  'VEINTIUN',
  'VEINTIDOS',
  'VEINTITRES',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISEIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
]

const DECENAS = [
  '',
  '',
  '',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
]

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
]

function numeroALetras(n: number): string {
  if (n === 0) return 'CERO'
  if (n === 100) return 'CIEN'

  const partes: string[] = []

  const millones = Math.floor(n / 1_000_000)
  if (millones > 0) {
    partes.push(millones === 1 ? 'UN MILLON' : `${numeroALetras(millones)} MILLONES`)
    n %= 1_000_000
  }

  const miles = Math.floor(n / 1000)
  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${numeroALetras(miles)} MIL`)
    n %= 1000
  }

  const centenas = Math.floor(n / 100)
  if (centenas > 0) {
    if (n === 100) {
      partes.push('CIEN')
      n = 0
    } else {
      partes.push(CENTENAS[centenas])
      n %= 100
    }
  }

  if (n > 0) {
    if (n < 30) {
      partes.push(UNIDADES[n])
    } else {
      const dec = Math.floor(n / 10)
      const uni = n % 10
      // DECENAS[dec] indexa por decena (3=30 … 9=90).
      if (uni === 0) {
        partes.push(DECENAS[dec])
      } else {
        partes.push(`${DECENAS[dec]} Y ${UNIDADES[uni]}`)
      }
    }
  }

  return partes.join(' ').replace(/\s+/g, ' ').trim()
}
