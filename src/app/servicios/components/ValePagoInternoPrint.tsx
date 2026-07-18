'use client'

import { getFullLevel } from '@/lib/boucherCore'
import { importeEnLetrasPesos } from '@/lib/importeEnLetras'

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

const MESES_CORTO = [
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

function partesFecha(iso: string): { dia: string; mes: string; anio: string } {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return { dia: '', mes: '', anio: '' }
  return {
    dia: String(d).padStart(2, '0'),
    mes: MESES_CORTO[m - 1] ?? '',
    anio: String(y),
  }
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

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** CSS del vale: letter landscape, campos absolutos sobre el talón preimpreso. */
function cssVale(): string {
  return `
    @page { size: letter landscape; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 11in;
      height: 8.5in;
      background: transparent;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    * { box-sizing: border-box; }
    .vale {
      position: relative;
      width: 11in;
      height: 8.5in;
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      overflow: hidden;
    }
    .vale span {
      position: absolute;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      line-height: 1.1;
      font-weight: 400;
    }
    /* Fecha: cajas Día / Mes / Año (arriba derecha) */
    .v-dia  { top: 0.92in; right: 3.35in; width: 0.5in;  text-align: center; font-size: 12pt; }
    .v-mes  { top: 0.92in; right: 2.55in; width: 0.55in; text-align: center; font-size: 12pt; }
    .v-anio { top: 0.92in; right: 1.65in; width: 0.7in;  text-align: center; font-size: 12pt; }
    /* Importe numérico (caja $) */
    .v-importe { top: 1.35in; right: 0.55in; width: 1.85in; text-align: left; font-size: 14pt; }
    /* La cantidad de (letras) */
    .v-letras {
      top: 2.28in; left: 2.15in; width: 7.6in;
      font-size: 12pt; white-space: normal;
    }
    /* Por concepto de */
    .v-concepto {
      top: 2.95in; left: 2.35in; width: 7.4in;
      font-size: 13pt; white-space: normal; text-transform: uppercase;
    }
    /* Nombre del alumno */
    .v-nombre {
      top: 3.55in; left: 2.55in; width: 7.2in;
      font-size: 13pt; text-transform: uppercase;
    }
    /* Grado + ciclo escolar … al … */
    .v-grado { top: 4.15in; left: 1.35in; width: 3.6in; font-size: 12pt; }
    .v-ciclo-ini { top: 4.15in; left: 6.35in; width: 0.9in; text-align: center; font-size: 12pt; }
    .v-ciclo-fin { top: 4.15in; left: 7.85in; width: 0.9in; text-align: center; font-size: 12pt; }
  `
}

export function construirHtmlValePagoInterno(datos: DatosValePagoInterno): string {
  const { dia, mes, anio } = partesFecha(datos.fecha)
  const importeFmt = Number(datos.importe).toFixed(2)
  const letras = importeEnLetrasPesos(datos.importe)
  const concepto =
    limpiarConcepto(datos.concepto) +
    (datos.conceptoExtra?.trim() ? ` ${datos.conceptoExtra.trim().toUpperCase()}` : '')
  const nombre = nombreValeLegacy(datos.alumnoApp, datos.alumnoApm, datos.alumnoNombre)
  const grado = getFullLevel(
    Number(datos.alumnoNivel),
    Number(datos.alumnoGrado ?? 0)
  )
  const { inicio, fin } = aniosCiclo(datos.cicloEtiqueta)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Vale pago interno</title>
  <style>${cssVale()}</style>
</head>
<body>
  <div class="vale">
    <span class="v-dia">${escapeHtml(dia)}</span>
    <span class="v-mes">${escapeHtml(mes)}</span>
    <span class="v-anio">${escapeHtml(anio)}</span>
    <span class="v-importe">${escapeHtml(importeFmt)}</span>
    <span class="v-letras">${escapeHtml(letras)}</span>
    <span class="v-concepto">${escapeHtml(concepto)}</span>
    <span class="v-nombre">${escapeHtml(nombre)}</span>
    <span class="v-grado">${escapeHtml(grado)}</span>
    <span class="v-ciclo-ini">${escapeHtml(inicio)}</span>
    <span class="v-ciclo-fin">${escapeHtml(fin)}</span>
  </div>
</body>
</html>`
}

/**
 * Imprime el vale en un iframe aislado (no depende del paint de React).
 * Una sola copia por ahora; original+copia cuando el cuadrado esté OK.
 */
export function imprimirValePagoInterno(datos: DatosValePagoInterno): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const html = construirHtmlValePagoInterno(datos)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'vale-pago-interno')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument
  if (!win || !doc) {
    iframe.remove()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    window.setTimeout(() => {
      try {
        iframe.remove()
      } catch {
        /* ignore */
      }
    }, 1500)
  }

  const doPrint = () => {
    try {
      win.focus()
      win.print()
    } finally {
      cleanup()
    }
  }

  // Esperar a que el documento del iframe esté listo.
  if (doc.readyState === 'complete') {
    window.setTimeout(doPrint, 50)
  } else {
    iframe.onload = () => window.setTimeout(doPrint, 50)
  }
}

/** Componente residual: la impresión real va por iframe en `imprimirValePagoInterno`. */
export default function ValePagoInternoPrint(_props: {
  datos: DatosValePagoInterno | null
}) {
  return null
}
