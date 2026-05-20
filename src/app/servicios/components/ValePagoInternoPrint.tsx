'use client'

import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { importeEnLetrasPesos } from '@/lib/importeEnLetras'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'

export interface DatosValePagoInterno {
  fecha: string
  importe: number
  concepto: string
  conceptoExtra?: string
  nombreAlumno: string
  alumnoApp: string
  alumnoApm: string
  alumnoNombre: string
  alumnoNivel: number
  alumnoGrado: number | string | null
  cicloEtiqueta: string
}

function formatoFechaVale(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const meses = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ]
  if (!y || !m || !d) return iso
  return `${d} ${meses[m - 1]} ${y}`
}

function nombreValeLegacy(app: string, apm: string, nombre: string): string {
  return [app, apm, nombre].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toUpperCase()
}

function limpiarConcepto(texto: string): string {
  return texto.replace(/^\*\s*/, '').trim().toUpperCase()
}

function aniosCiclo(etiqueta: string): { inicio: string; fin: string } {
  const nums = etiqueta.match(/\d{4}/g) ?? []
  return { inicio: nums[0] ?? '', fin: nums[1] ?? nums[0] ?? '' }
}

function lineaGradoNivel(nivel: number, grado: number | string | null): string {
  const g = etiquetaGradoEscolar(nivel, grado)
  const n = etiquetaNivelEscolar(nivel)
  if (g && n) return `${g} ${n}`.trim()
  return g || n || ''
}

interface Props {
  datos: DatosValePagoInterno | null
}

export default function ValePagoInternoPrint({ datos }: Props) {
  if (!datos) return null

  const importeFmt = datos.importe.toFixed(2)
  const concepto =
    limpiarConcepto(datos.concepto) +
    (datos.conceptoExtra?.trim() ? ` ${datos.conceptoExtra.trim().toUpperCase()}` : '')
  const { inicio, fin } = aniosCiclo(datos.cicloEtiqueta)

  return (
    <div className="pi-vale-print-sheet" aria-hidden="true">
      <div className="pi-vale-print-inner">
        <div className="pi-vale-fecha-block">
          <div className="pi-vale-fecha">{formatoFechaVale(datos.fecha)}</div>
          <div className="pi-vale-importe-num">{importeFmt}</div>
        </div>
        <div className="pi-vale-linea pi-vale-letras">{importeEnLetrasPesos(datos.importe)}</div>
        <div className="pi-vale-linea pi-vale-concepto">{concepto}</div>
        <div className="pi-vale-linea pi-vale-nombre">
          {nombreValeLegacy(datos.alumnoApp, datos.alumnoApm, datos.alumnoNombre)}
        </div>
        <div className="pi-vale-linea pi-vale-pie">
          <span>{lineaGradoNivel(datos.alumnoNivel, datos.alumnoGrado)}</span>
          <span className="pi-vale-anio pi-vale-anio--inicio">{inicio}</span>
          <span className="pi-vale-anio pi-vale-anio--fin">{fin}</span>
        </div>
      </div>
    </div>
  )
}

export function imprimirValePagoInterno(): void {
  requestAnimationFrame(() => {
    setTimeout(() => window.print(), 80)
  })
}
