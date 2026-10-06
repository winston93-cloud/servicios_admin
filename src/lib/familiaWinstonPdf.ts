/**
 * 2026-10-06 — Familia Winston: lectura del comprobante en PDF que trae el papá.
 * Extrae el QR (decodificando la imagen con jsQR; si no se puede, el número impreso debajo del QR
 * en los PDFs de AgendaW), el número de control de quien recomienda y el nombre del interesado.
 *
 * Formatos soportados (PDF con texto, no escaneado):
 * - Sistema anterior (PHP): «…el interesado X a ingresar a NIVEL en el ciclo Y, otorga al alumno con
 *   número de control Z el beneficio…» + imagen QR sin número impreso.
 * - AgendaW (impreso a PDF desde el navegador): mismo párrafo con «(Nombre)» después del control,
 *   número del QR debajo de la imagen y «Folio: WSP-00000». También la versión en inglés.
 *
 * Solo pdfjs-dist + @napi-rs/canvas (ya usados en slackDevoluciones, binarios prebuilt para Vercel)
 * y jsqr (JS puro). Estos datos solo llenan el formulario: el candado final es revisarFamiliaWinston.
 */

/** Vercel corta los cuerpos de más de 4.5 MB; un comprobante pesa ~150 KB. */
export const PDF_MAX_BYTES = 4 * 1024 * 1024
const MAX_PAGINAS = 2

export interface DatosPdfFamiliaWinston {
  /** Código del QR (imagen decodificada o número impreso). */
  qr: number | null
  qrFuente: 'imagen' | 'texto' | null
  /** Número impreso debajo del QR (AgendaW), aunque la imagen también se haya leído. */
  qrImpreso: number | null
  /** Número de control del alumno que recomienda (recibe el beneficio). */
  ctrl: number | null
  /** Nombre del interesado (alumno nuevo) en mayúsculas, como viene en el PDF. */
  interesado: string | null
  nivel: string | null
  ciclo: string | null
  folio: string | null
  formato: 'anterior' | 'agendaw' | null
  /** 2026-10-06 — ¿El PDF se editó después de generarse? (metadatos + guardados incrementales). */
  integridad: IntegridadPdfFamiliaWinston
}

/**
 * 2026-10-06 — Revisión de «PDF modificado».
 * Firmas originales:
 * - Sistema anterior (PHP): Producer «tFPDF 1.33», sin Creator, solo CreationDate, un solo %%EOF.
 * - AgendaW: no genera el PDF; el papá lo imprime desde el navegador (window.print), así que el
 *   Producer es el del navegador/sistema (Chrome «Skia/PDF», Safari/macOS «Quartz PDFContext»,
 *   Firefox «cairo», Windows «Microsoft: Print To PDF»).
 * Nivel: error = editado con un programa de edición, ModDate ≠ CreationDate o guardado incremental;
 * aviso = comprobante PHP re-impreso con una impresora de PDF o productor desconocido en AgendaW.
 */
export interface IntegridadPdfFamiliaWinston {
  nivel: 'ok' | 'aviso' | 'error'
  texto: string | null
  producer: string | null
  creator: string | null
  creacion: string | null
  modificacion: string | null
  /** Veces que se guardó (secciones con %%EOF; un PDF linealizado trae 2 de origen). */
  guardados: number
}

type ItemTexto = { str?: string; hasEOL?: boolean }

const RE_ES =
  /interesad[oa]\s+(.+?)\s+a\s+ingresar\s+a\s+(.+?)\s+en\s+el\s+ciclo\s+(.+?)\s*,\s*otorga\s+al\s+alumno\s+con\s+n[uú]mero\s+de\s+control\s+(\d{3,7})/i
const RE_EN =
  /applicant\s+(.+?)\s+to\s+enroll\s+in\s+(.+?)\s+for\s+the\s+(.+?)\s+school\s+year\s*,\s*grants\s+the\s+student\s+with\s+control\s+number\s+(\d{3,7})/i

function limpiar(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Datos del párrafo «Este documento certifica que el interesado…». */
export function extraerDatosTexto(texto: string): Pick<
  DatosPdfFamiliaWinston,
  'ctrl' | 'interesado' | 'nivel' | 'ciclo' | 'folio' | 'formato'
> {
  const plano = limpiar(texto)
  const m = RE_ES.exec(plano) ?? RE_EN.exec(plano)
  const folio = /WSP-\s?(\d{3,})/i.exec(plano)
  const nombre = m ? limpiar(m[1]).replace(/[^\p{L}\s'.-]/gu, ' ') : ''
  return {
    ctrl: m ? Number(m[4]) : null,
    interesado: limpiar(nombre).toUpperCase() || null,
    nivel: m ? limpiar(m[2]).toUpperCase() : null,
    ciclo: m ? limpiar(m[3]) : null,
    folio: folio ? `WSP-${folio[1].padStart(5, '0')}` : null,
    // El de AgendaW trae folio y «(Nombre)» tras el control; el anterior no.
    formato: !m ? null : folio || new RegExp(`${m[4]}\\s*\\(`).test(plano) ? 'agendaw' : 'anterior',
  }
}

type PdfjsModulo = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

/** pdfjs en Node usa un «fake worker»; se importa explícito para que Vercel lo incluya en la función. */
async function cargarPdfjs(): Promise<PdfjsModulo> {
  const g = globalThis as { pdfjsWorker?: unknown }
  // @ts-expect-error -- pdfjs-dist no publica tipos para el worker
  if (!g.pdfjsWorker) g.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  return import('pdfjs-dist/legacy/build/pdf.mjs')
}

type PaginaPdf = Awaited<ReturnType<Awaited<ReturnType<PdfjsModulo['getDocument']>['promise']>['getPage']>>

/** Renderiza la página y busca el QR con jsQR (dos escalas por si la imagen es chica). */
async function leerQrPagina(pagina: PaginaPdf): Promise<number | null> {
  const [{ createCanvas }, { default: jsQR }] = await Promise.all([import('@napi-rs/canvas'), import('jsqr')])
  for (const escala of [2, 3]) {
    const viewport = pagina.getViewport({ scale: escala })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // pdfjs tipa canvas DOM; @napi-rs/canvas es compatible en runtime.
    await pagina.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    }).promise
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const codigo = jsQR(new Uint8ClampedArray(img.data.buffer), img.width, img.height, {
      inversionAttempts: 'dontInvert',
    })
    const valor = (codigo?.data ?? '').replace(/\D/g, '')
    if (valor) return Number(valor.slice(0, 9))
  }
  return null
}

/* 2026-10-06 — Firmas de generadores para la revisión de «PDF modificado». */
const RE_PHP_ORIGINAL = /^t?FPDF\b/i
/** Impresoras de PDF del navegador o del sistema (así sale el comprobante de AgendaW). */
const RE_IMPRESORAS =
  /skia\/pdf|chrom(e|ium)|mozilla|firefox|safari|edg(e|\/)|quartz|mac ?os|ios version|cairo|microsoft:? print to pdf|print to pdf/i
/** Programas con los que se edita un PDF: siempre bloquea. */
const RE_EDITORES =
  /acrobat|adobe|ilovepdf|smallpdf|sejda|pdfescape|pdf-lib|pdfsharp|itext|foxit|nitro|pdf-xchange|pdfelement|wondershare|libreoffice|openoffice|microsoft.{0,12}word|\bword\b|qpdf|pdftk|canva|google docs|wps|pdf24|xodo|pdfcandy|soda pdf|pdffiller|dochub|preview|vista previa|inkscape|gimp|photoshop|tcpdf|dompdf|mpdf|reportlab|pypdf|pdfium/i

type MetaPdf = { info?: Record<string, unknown>; metadata?: { get(name: string): unknown } | null }

function textoMeta(v: unknown): string | null {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  return s || null
}

/** «D:20251129105056-07'00'» → milisegundos (null si no se puede leer). */
function fechaPdf(s: string | null): number | null {
  const m = s ? /D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+-])?(\d{2})?'?(\d{2})?/.exec(s) : null
  if (!m) return null
  const [, y, mo = '01', d = '01', h = '00', mi = '00', se = '00', signo, oh = '00', om = '00'] = m
  const base = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se)
  if (!signo || signo.toUpperCase() === 'Z') return base
  const off = (+oh * 60 + +om) * 60_000
  return signo === '+' ? base - off : base + off
}

/**
 * Secciones guardadas del archivo (cada guardado incremental agrega un %%EOF) y si la estructura
 * es la de FPDF: cabecera %PDF-1.3, tabla xref clásica y trailer sin /ID ni flujos de objetos.
 * Un programa que reescribe el archivo (qpdf, etc.) puede dejar «tFPDF» en Producer pero no esto.
 */
function revisarEstructura(bytes: Uint8Array): { eof: number; linealizado: boolean; estructuraFpdf: boolean } {
  const txt = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1')
  const final = txt.slice(-600)
  return {
    eof: txt.split('%%EOF').length - 1,
    linealizado: /\/Linearized\b/.test(txt.slice(0, 2048)),
    estructuraFpdf:
      txt.startsWith('%PDF-1.3\n') &&
      /\nxref\n0 \d+\n/.test(txt.slice(-4096)) &&
      !/\/ID\s*\[/.test(final) &&
      !/\/ObjStm|\/XRefStm|\/Type\s*\/XRef\b/.test(txt),
  }
}

export function evaluarIntegridad(opts: {
  meta: MetaPdf
  eof: number
  linealizado: boolean
  estructuraFpdf: boolean
  formato: DatosPdfFamiliaWinston['formato']
}): IntegridadPdfFamiliaWinston {
  const info = opts.meta.info ?? {}
  const xmp = (k: string) => textoMeta(opts.meta.metadata?.get?.(k))
  const producer = textoMeta(info.Producer) ?? xmp('pdf:producer')
  const creator = textoMeta(info.Creator) ?? xmp('xmp:creatortool')
  const creacion = textoMeta(info.CreationDate)
  const modificacion = textoMeta(info.ModDate)
  const base = { producer, creator, creacion, modificacion, guardados: opts.eof }
  const herramientas = [producer, creator, xmp('pdf:producer'), xmp('xmp:creatortool')].filter(
    (x): x is string => !!x
  )
  const editadoCon = (x: string | null | undefined) =>
    `Este PDF fue modificado después de generarse (editado con ${x || 'otro programa'}). No procede.`
  const err = (texto: string): IntegridadPdfFamiliaWinston => ({ nivel: 'error', texto, ...base })
  const aviso = (texto: string): IntegridadPdfFamiliaWinston => ({ nivel: 'aviso', texto, ...base })
  const php = !!producer && RE_PHP_ORIGINAL.test(producer)
  /** Quién lo tocó: el productor si no es el original; si no, el Creator. */
  const quien = (!php ? producer : null) ?? creator

  const editor = herramientas.find((h) => RE_EDITORES.test(h) && !RE_PHP_ORIGINAL.test(h))
  if (editor) return err(editadoCon(editor))
  if (opts.eof > (opts.linealizado ? 2 : 1)) {
    const n = opts.eof - 1
    return err(editadoCon(`${quien ?? 'otro programa'}; se guardó ${n === 1 ? '1 vez' : `${n} veces`} encima del original`))
  }
  const tc = fechaPdf(creacion)
  const tm = fechaPdf(modificacion)
  // Tolerancia de 2 min: algunos generadores ponen ModDate unos segundos después de CreationDate.
  if (tm != null && (tc == null || Math.abs(tm - tc) > 120_000)) {
    return err(editadoCon(quien ?? 'otro programa; la fecha de modificación no es la de creación'))
  }
  if (php && !opts.estructuraFpdf) {
    return err(editadoCon('un programa que conservó la firma tFPDF pero reescribió el archivo'))
  }
  if (opts.formato === 'anterior') {
    if (php && !creator) return { nivel: 'ok', texto: null, ...base }
    if (quien && herramientas.every((h) => RE_IMPRESORAS.test(h))) {
      return aviso(
        `El comprobante original lo genera el sistema (tFPDF), pero este PDF se volvió a imprimir con «${quien}». Compáralo con el original del papá antes de aplicar.`
      )
    }
    return err(editadoCon(quien))
  }
  // AgendaW (o formato no reconocido): el PDF sale de imprimir en el navegador.
  if (php || herramientas.some((h) => RE_IMPRESORAS.test(h))) return { nivel: 'ok', texto: null, ...base }
  return aviso(
    `No se reconoce el programa que generó este PDF (${producer ?? creator ?? 'sin datos'}). Revisa que sea el comprobante impreso desde AgendaW.`
  )
}

/** Lee el comprobante. Lanza Error con mensaje claro si el archivo no es un PDF legible. */
export async function leerComprobantePdf(bytes: Uint8Array): Promise<DatosPdfFamiliaWinston> {
  if (bytes.length > PDF_MAX_BYTES) throw new Error('El PDF pesa más de 4 MB.')
  if (new TextDecoder().decode(bytes.slice(0, 1024)).indexOf('%PDF') < 0) {
    throw new Error('El archivo no es un PDF.')
  }
  // 2026-10-06: antes de abrirlo (pdfjs puede quedarse con el buffer)
  const estructura = revisarEstructura(bytes)
  const { getDocument } = await cargarPdfjs()
  const tarea = getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
    stopAtErrors: false,
  } as Parameters<typeof getDocument>[0])
  let doc: Awaited<typeof tarea.promise>
  try {
    doc = await tarea.promise
  } catch {
    await tarea.destroy().catch(() => undefined)
    throw new Error('No se pudo abrir el PDF (¿está dañado o con contraseña?).')
  }
  try {
    const paginas = Math.min(doc.numPages, MAX_PAGINAS)
    const textos: string[] = []
    const sueltos: string[] = []
    for (let n = 1; n <= paginas; n++) {
      const pagina = await doc.getPage(n)
      const contenido = await pagina.getTextContent()
      const items = contenido.items as ItemTexto[]
      textos.push(items.map((i) => `${i.str ?? ''}${i.hasEOL ? ' ' : ''}`).join(' '))
      for (const i of items) sueltos.push(limpiar(i.str ?? ''))
    }
    const datos = extraerDatosTexto(textos.join(' '))
    // Número impreso debajo del QR (AgendaW): un renglón solo con 6–9 dígitos que no es el control.
    // AgendaW lo imprime con letter-spacing y pdfjs lo devuelve como «2 2 4 5 6 0».
    const impreso = sueltos
      .filter((s) => /^(\d ?){6,9}$/.test(s))
      .map((s) => s.replace(/ /g, ''))
      .find((s) => Number(s) !== datos.ctrl)
    const qrImpreso = impreso ? Number(impreso) : null

    let qrImagen: number | null = null
    for (let n = 1; n <= paginas && qrImagen == null; n++) {
      qrImagen = await leerQrPagina(await doc.getPage(n)).catch(() => null)
    }
    // 2026-10-06 — Revisión de «PDF modificado» (metadatos + estructura del archivo).
    const meta = (await doc.getMetadata().catch(() => ({}))) as MetaPdf
    return {
      ...datos,
      qr: qrImagen ?? qrImpreso,
      qrFuente: qrImagen != null ? 'imagen' : qrImpreso != null ? 'texto' : null,
      qrImpreso,
      integridad: evaluarIntegridad({ meta, ...estructura, formato: datos.formato }),
    }
  } finally {
    await tarea.destroy().catch(() => undefined)
  }
}
