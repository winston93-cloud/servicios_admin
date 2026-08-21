/**
 * 2026-08-21 - Helpers para convertir texto/imagen a PNG de firma (cliente).
 */

/** Renderiza texto cursivo a PNG transparente (fondo blanco). */
export async function textoAFirmaPng(texto: string): Promise<string> {
  const t = texto.trim()
  if (!t) throw new Error('Escribe tu nombre para generar la firma.')

  const root = document.querySelector('.fe-page') as HTMLElement | null
  const cssFamily =
    root
      ? getComputedStyle(root).getPropertyValue('--font-firma-script').trim()
      : ''
  const family = cssFamily
    ? cssFamily
    : '"Dancing Script", "Segoe Script", cursive'

  try {
    await document.fonts.load(`600 72px ${family}`)
  } catch {
    // Si la fuente no carga, usamos cursiva del sistema.
  }

  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 280
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear la vista previa.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0f172a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 72px ${family}, "Segoe Script", cursive`

  // Ajuste de tamaño si el texto es largo
  let size = 72
  while (size > 36 && ctx.measureText(t).width > canvas.width - 80) {
    size -= 4
    ctx.font = `600 ${size}px ${family}, "Segoe Script", cursive`
  }

  ctx.fillText(t, canvas.width / 2, canvas.height / 2 + 8)
  return canvas.toDataURL('image/png')
}

/** Normaliza una imagen subida a PNG con fondo blanco. */
export async function imagenArchivoAFirmaPng(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Sube una imagen (PNG, JPG o WEBP).')
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('La imagen debe pesar menos de 4 MB.')
  }

  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const maxW = 900
  const maxH = 320
  const scale = Math.min(maxW / img.width, maxH / img.height, 1)
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/png')
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Imagen inválida.'))
    img.src = src
  })
}
