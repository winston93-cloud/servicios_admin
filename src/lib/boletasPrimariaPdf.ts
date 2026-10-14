import { readFile } from 'fs/promises'
import path from 'path'
import type { jsPDF } from 'jspdf'

/** Las plantillas de primaria son carta a 300 dpi (2550×3300 px): se mide en px y se dibuja en mm. */
export const px = (v: number) => (v * 25.4) / 300

export type Rgb = [number, number, number]

const cache = new Map<string, string>()

export async function plantillaPrimaria(rel: string): Promise<string> {
  let data = cache.get(rel)
  if (!data) {
    const buf = await readFile(path.join(process.cwd(), 'public', 'boletas', rel))
    data = `data:image/jpeg;base64,${buf.toString('base64')}`
    cache.set(rel, data)
  }
  return data
}

export function fondo(doc: jsPDF, dataUrl: string): void {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  doc.addImage(dataUrl, 'JPEG', 0, 0, w, h, undefined, 'FAST')
}

export function rectPx(doc: jsPDF, x0: number, y0: number, x1: number, y1: number, color: Rgb): void {
  doc.setFillColor(...color)
  doc.rect(px(x0), px(y0), px(x1 - x0), px(y1 - y0), 'F')
}

export function lineaPx(doc: jsPDF, x0: number, y0: number, x1: number, y1: number, color: Rgb, grosorPx = 3): void {
  doc.setDrawColor(...color)
  doc.setLineWidth(px(grosorPx))
  doc.line(px(x0), px(y0), px(x1), px(y1))
}

export type EstiloTexto = {
  size: number
  color: Rgb
  estilo?: 'normal' | 'bold' | 'italic' | 'bolditalic'
  align?: 'left' | 'center' | 'right'
  /** Ancho máximo en px: reduce la letra hasta que quepa. */
  maxW?: number
}

/** Texto centrado verticalmente en `yMid` (px). */
export function textoPx(doc: jsPDF, s: string, x: number, yMid: number, e: EstiloTexto): void {
  if (!s) return
  doc.setFont('helvetica', e.estilo ?? 'normal')
  let size = e.size
  doc.setFontSize(size)
  if (e.maxW) {
    while (size > 5 && doc.getTextWidth(s) > px(e.maxW)) {
      size -= 0.5
      doc.setFontSize(size)
    }
  }
  doc.setTextColor(...e.color)
  const capMm = size * 0.3528 * 0.716
  doc.text(s, px(x), px(yMid) + capMm / 2, { align: e.align ?? 'left' })
}
