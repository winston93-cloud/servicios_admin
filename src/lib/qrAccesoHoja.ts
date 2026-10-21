import { dibujarQrAccesoEnCanvas, QR_ACCESO_HOJA_PX } from '@/lib/qrAccesoCanvas'

/** Carta US. Sin margen de página: el QR ya trae quiet zone blanca. */
export const HOJA_CARTA = {
  anchoIn: 8.5,
  altoIn: 11,
} as const

export function ladoQrHojaCartaIn(): number {
  return Math.min(HOJA_CARTA.anchoIn, HOJA_CARTA.altoIn)
}

export async function qrAccesoPngDataUrl(
  codigo: string,
  ladoPx = QR_ACCESO_HOJA_PX
): Promise<string> {
  const canvas = document.createElement('canvas')
  await dibujarQrAccesoEnCanvas(canvas, codigo, ladoPx)
  return canvas.toDataURL('image/png')
}

export async function hojaQrAccesoPdf(codigo: string) {
  const { jsPDF } = await import('jspdf')
  const dataUrl = await qrAccesoPngDataUrl(codigo)
  const pdf = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  const lado = ladoQrHojaCartaIn()
  const x = (HOJA_CARTA.anchoIn - lado) / 2
  const y = (HOJA_CARTA.altoIn - lado) / 2
  pdf.addImage(dataUrl, 'PNG', x, y, lado, lado)
  return pdf
}

function htmlHojaQr(dataUrl: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>QR de acceso</title>
  <style>
    @page { size: letter; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      min-height: 11in;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img { display: block; width: 8.5in; height: 8.5in; }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="QR de acceso" />
</body>
</html>`
}

function imprimirCuandoCargue(win: Window): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = win.document.querySelector('img')
    if (!img) {
      reject(new Error('No se pudo abrir la hoja de impresión.'))
      return
    }
    const imprimir = () => {
      win.focus()
      win.print()
      resolve()
    }
    if (img.complete && img.naturalWidth > 0) {
      window.setTimeout(imprimir, 50)
      return
    }
    img.onload = () => window.setTimeout(imprimir, 50)
    img.onerror = () => reject(new Error('No se pudo cargar el QR para imprimir.'))
  })
}

export async function imprimirHojaQrAcceso(codigo: string): Promise<void> {
  const dataUrl = await qrAccesoPngDataUrl(codigo)
  const html = htmlHojaQr(dataUrl)

  const win = window.open('', '_blank', 'width=900,height=1100')
  if (win) {
    win.document.open()
    win.document.write(html)
    win.document.close()
    await imprimirCuandoCargue(win)
    return
  }

  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'Imprimir QR de acceso')
    iframe.style.cssText =
      'position:fixed;left:0;top:0;width:8.5in;height:11in;opacity:0;border:0;pointer-events:none;z-index:-1'
    iframe.onload = () => {
      const w = iframe.contentWindow
      if (!w) {
        iframe.remove()
        reject(new Error('No se pudo abrir la hoja de impresión.'))
        return
      }
      void imprimirCuandoCargue(w)
        .then(() => {
          window.setTimeout(() => iframe.remove(), 120_000)
          resolve()
        })
        .catch((err) => {
          iframe.remove()
          reject(err)
        })
    }
    document.body.appendChild(iframe)
    iframe.srcdoc = html
  })
}
