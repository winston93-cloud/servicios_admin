import type { AppInsforgeClient } from '@/lib/dbTypes'
import jsPDF from 'jspdf'
import type { PersonaCredencial } from './credencialesService'
import { resolverFondoCredencial } from './credencialesFondos'
import { etiquetaNivelMaestro } from './credencialesEtiquetas'

const CARD_W = 96
const CARD_H = 58
const ORIGIN_X = 8
const ORIGIN_Y = 5
const COL_STEP = 100
const ROW_STEP = 60
const CARDS_PER_COL = 4
const CARDS_PER_PAGE = 8

const fondoCache = new Map<number, { data: string; format: 'PNG' | 'JPEG' }>()

async function fondoDataUrl(
  client: AppInsforgeClient | null,
  nivel: number
): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  if (fondoCache.has(nivel)) return fondoCache.get(nivel)!

  const res = await resolverFondoCredencial(client, nivel)
  if (!res) return null

  const data = `data:image/${res.mime === 'JPEG' ? 'jpeg' : 'png'};base64,${res.buffer.toString('base64')}`
  const entry = { data, format: res.mime }
  fondoCache.set(nivel, entry)
  return entry
}

function limpiarCacheFondos() {
  fondoCache.clear()
}

export async function generarPdfCredenciales(
  client: AppInsforgeClient | null,
  personas: PersonaCredencial[]
): Promise<Buffer> {
  limpiarCacheFondos()

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  pdf.setFont('helvetica', 'bold')

  let x = 0
  let y = 0
  let c = 0

  for (const p of personas) {
    const fondo = await fondoDataUrl(client, p.nivel)
    if (!fondo) continue

    c++
    const px = ORIGIN_X + x
    const py = ORIGIN_Y + y

    pdf.addImage(fondo.data, fondo.format, px, py, CARD_W, CARD_H)

    const tx = 43 + x
    let ty = 27 + y

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)

    const apellidos = `${p.app} ${p.apm}`.trim()
    pdf.text(`Nombre: ${apellidos.toUpperCase()}`, tx, ty)

    ty += 6
    pdf.text(p.nombre.toUpperCase(), tx, ty)

    ty += 6
    if (p.esMaestro) {
      const titulo = p.sexoMaestro === 1 ? 'Maestra' : 'Maestro'
      pdf.text(`${titulo} de ${etiquetaNivelMaestro(p.nivel).toUpperCase()}`, tx, ty)
    } else {
      pdf.text(`No. Control: ${p.ref}`, tx, ty)
      ty += 6
      const gg = `Grado: ${p.gradoTexto}   Grupo: ${p.grupoLetra}`.toUpperCase()
      pdf.text(gg, tx, ty)
    }

    pdf.setTextColor(0, 0, 0)

    if (c % CARDS_PER_COL !== 0) {
      y += ROW_STEP
    } else {
      y = 0
      x += COL_STEP
    }

    if (c >= CARDS_PER_PAGE) {
      pdf.addPage()
      x = 0
      y = 0
      c = 0
    }
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
