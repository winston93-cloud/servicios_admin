/** Misma placa que `qr-entrada/scripts/lib/qr-imagen.mjs` (`placaLogo` + composite centre). */
export const QR_ACCESO_CANVAS_PX = 320
const LOGO_QR_ACCESO = '/logos/logo-winston-w.png'

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar el logo del QR.'))
    img.src = src
  })
}

/**
 * Logo al 16% del lado del QR, relleno contain, pixeles casi negros transparentes,
 * aplanado sobre blanco y margen blanco (~10% del logo, mínimo 8px).
 */
async function placaLogo(ladoQr: number): Promise<HTMLCanvasElement> {
  const ladoLogo = Math.max(20, Math.round(ladoQr * 0.16))
  const padding = Math.max(8, Math.round(ladoLogo * 0.095))
  const img = await cargarImagen(LOGO_QR_ACCESO)

  const tmp = document.createElement('canvas')
  tmp.width = ladoLogo
  tmp.height = ladoLogo
  const ctx = tmp.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No hay canvas 2d.')

  const scale = Math.min(ladoLogo / img.naturalWidth, ladoLogo / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, ladoLogo, ladoLogo)
  ctx.drawImage(img, (ladoLogo - w) / 2, (ladoLogo - h) / 2, w, h)

  const imageData = ctx.getImageData(0, 0, ladoLogo, ladoLogo)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 28 && data[i + 1] < 28 && data[i + 2] < 28) {
      data[i + 3] = 0
    }
  }
  ctx.putImageData(imageData, 0, 0)

  const placa = document.createElement('canvas')
  placa.width = ladoLogo + padding * 2
  placa.height = ladoLogo + padding * 2
  const pctx = placa.getContext('2d')
  if (!pctx) throw new Error('No hay canvas 2d.')
  pctx.fillStyle = '#ffffff'
  pctx.fillRect(0, 0, placa.width, placa.height)
  pctx.drawImage(tmp, padding, padding)
  return placa
}

export const QR_ACCESO_HOJA_PX = 1200

/** Dibuja `A.ref.firma` y superpone el logo W. El kiosk lee el texto, no el dibujo. */
export async function dibujarQrAccesoEnCanvas(
  canvas: HTMLCanvasElement,
  codigo: string,
  ladoPx = QR_ACCESO_CANVAS_PX
): Promise<void> {
  const QRCode = (await import('qrcode')).default
  await QRCode.toCanvas(canvas, codigo, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: ladoPx,
    color: { dark: '#000000', light: '#ffffff' },
  })
  try {
    const placa = await placaLogo(canvas.width)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const x = Math.round((canvas.width - placa.width) / 2)
    const y = Math.round((canvas.height - placa.height) / 2)
    ctx.drawImage(placa, x, y)
  } catch {
    // El código firmado sigue siendo válido sin el logo.
  }
}
