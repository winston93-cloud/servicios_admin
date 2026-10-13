import { DIAS_PLAN, MATERIALES_CLASE, SKILLS, bloquesDePlan, normalizarPlan, sumarDias, type PlanContenido } from './teTypes'

type PdfjsModulo = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type ItemTexto = { str?: string; transform?: number[]; hasEOL?: boolean }

const MAX_PAGINAS = 12
const MAX_CARACTERES = 45_000
/** Menos texto que esto = PDF escaneado (imagen); se manda a OCR. */
const MIN_TEXTO = 120

/** Mismos límites que normalizarPlan; se recorta en vez de fallar por una actividad larga. */
const LIMITES = { unidad: 200, objetivo: 1500, tema: 200, actividades: 3000, participacion: 1000, recursos: 1000, tarea: 1000 }

async function cargarPdfjs(): Promise<PdfjsModulo> {
  const g = globalThis as { pdfjsWorker?: unknown }
  // @ts-expect-error -- pdfjs-dist no publica tipos para el worker
  if (!g.pdfjsWorker) g.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  return import('pdfjs-dist/legacy/build/pdf.mjs')
}

/** Texto por renglones (agrupado por altura) para que las tablas de la planeación conserven su orden. */
async function textoPdf(bytes: Uint8Array): Promise<string> {
  const { getDocument } = await cargarPdfjs()
  const tarea = getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true, stopAtErrors: false } as Parameters<typeof getDocument>[0])
  let doc: Awaited<typeof tarea.promise>
  try {
    doc = await tarea.promise
  } catch {
    await tarea.destroy().catch(() => undefined)
    throw new Error('No se pudo abrir el PDF (¿está dañado o con contraseña?).')
  }
  try {
    const paginas: string[] = []
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGINAS); n++) {
      const pagina = await doc.getPage(n)
      const items = (await pagina.getTextContent()).items as ItemTexto[]
      const renglones = new Map<number, { x: number; s: string }[]>()
      for (const it of items) {
        const s = (it.str ?? '').trim()
        if (!s) continue
        const y = Math.round((it.transform?.[5] ?? 0) / 3) * 3
        const fila = renglones.get(y) ?? []
        fila.push({ x: it.transform?.[4] ?? 0, s })
        renglones.set(y, fila)
      }
      const lineas = [...renglones.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, fila]) => fila.sort((a, b) => a.x - b.x).map((f) => f.s).join(' | '))
      paginas.push(`--- Página ${n} ---\n${lineas.join('\n')}`)
    }
    return paginas.join('\n\n').slice(0, MAX_CARACTERES)
  } finally {
    await tarea.destroy().catch(() => undefined)
  }
}

function instrucciones(lunes: string, grupos: string[]): string {
  const dias = DIAS_PLAN.map((d) => `${d.clave} = ${d.en} ${sumarDias(lunes, d.offset)}`).join('; ')
  const skills = SKILLS.map((s) => `${s.clave} (${s.etiqueta})`).join(', ')
  const materiales = MATERIALES_CLASE.map((m) => `${m.clave} (${m.etiqueta})`).join(', ')
  return [
    'You convert a primary-school English teacher\'s weekly lesson plan (extracted from a PDF) into JSON for her principal.',
    `The week starts on Monday ${lunes}. Days: ${dias}.`,
    grupos.length ? `Groups: ${grupos.join(', ')} (if the plan repeats the same lesson for several groups, include it once).` : '',
    'Answer ONLY a JSON object: {"unidad": string, "objetivo": string, "dias": {"lun": Block[], "mar": Block[], "mie": Block[], "jue": Block[], "vie": Block[]}}.',
    'Block = {"skill": string, "tema": string, "actividades": string, "participacion": string, "tarea": string, "materiales": string[], "recursos": string}.',
    `"skill" must be one of: ${skills}. Spelling, phonics and vocabulary → vocabulary. Quizzes, tests, assessments → evaluation. Unknown subject → otro.`,
    '"tema" = the topic/lesson title of that class. "actividades" = what students do in class (CLASSWORK; keep page numbers and steps). "participacion" = participation/oral activity if mentioned. "tarea" = HOMEWORK. "recursos" = links, videos, songs, worksheets mentioned.',
    `"materiales" = what students must bring, only from: ${materiales}.`,
    '"unidad" = unit or weekly theme; "objetivo" = weekly goal/objective if present.',
    'Rules: keep the original wording and language (do not translate, do not invent). Use "" when something is not in the plan. One block per subject per day, in the order of the plan, max 8 per day. Map dates or weekday names (English or Spanish) to the right day key. Omit days with no classes.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function llamarIA(mensajes: unknown[], plugins?: unknown[]): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('Falta configurar la IA (OPENROUTER_API_KEY).')
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Winston Team English' },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: process.env.OPENROUTER_PLAN_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? 'openai/gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: mensajes,
      ...(plugins ? { plugins } : {}),
    }),
  })
  if (!r.ok) {
    console.error('Planeación PDF IA:', r.status, (await r.text().catch(() => '')).slice(0, 500))
    throw new Error('La IA no respondió; intenta de nuevo en un momento.')
  }
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
  return j.choices?.[0]?.message?.content ?? ''
}

function recortar(raw: unknown): unknown {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const corta = (v: unknown, max: number) => {
    const s = String(v ?? '').trim()
    return /^([-–—.]+|n\/?a|none|no|ninguna?|sin tarea|no homework)$/i.test(s) ? '' : s.slice(0, max)
  }
  const dias = (o.dias && typeof o.dias === 'object' ? o.dias : {}) as Record<string, unknown>
  return {
    unidad: corta(o.unidad, LIMITES.unidad),
    objetivo: corta(o.objetivo, LIMITES.objetivo),
    dias: Object.fromEntries(
      DIAS_PLAN.map((d) => {
        const lista = Array.isArray(dias[d.clave]) ? (dias[d.clave] as Record<string, unknown>[]) : []
        return [
          d.clave,
          lista.slice(0, 8).map((b) => ({
            skill: String(b?.skill ?? 'otro'),
            tema: corta(b?.tema, LIMITES.tema),
            actividades: corta(b?.actividades, LIMITES.actividades),
            participacion: corta(b?.participacion, LIMITES.participacion),
            tarea: corta(b?.tarea, LIMITES.tarea),
            materiales: Array.isArray(b?.materiales) ? b.materiales : [],
            recursos: corta(b?.recursos, LIMITES.recursos),
          })),
        ]
      }),
    ),
  }
}

/** Lee el PDF de la planeación y lo acomoda por días y materias (mismo formato que el lienzo). */
export async function procesarPlanPdf(bytes: Uint8Array, ctx: { lunes: string; grupos: string[]; nombre: string }): Promise<PlanContenido> {
  if (new TextDecoder().decode(bytes.slice(0, 1024)).indexOf('%PDF') < 0) throw new Error('El archivo no es un PDF.')
  const sistema = { role: 'system', content: instrucciones(ctx.lunes, ctx.grupos) }
  const texto = await textoPdf(bytes)
  const raw =
    texto.replace(/[\s|-]|Página \d+/g, '').length >= MIN_TEXTO
      ? await llamarIA([sistema, { role: 'user', content: `Lesson plan PDF text:\n\n${texto}` }])
      : await llamarIA(
          [
            sistema,
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Lesson plan PDF (scanned):' },
                { type: 'file', file: { filename: ctx.nombre || 'planeacion.pdf', file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}` } },
              ],
            },
          ],
          [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }],
        )
  let json: unknown
  try {
    json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  } catch {
    throw new Error('La IA no devolvió la planeación en el formato esperado.')
  }
  const plan = normalizarPlan(recortar(json))
  if (!bloquesDePlan(plan)) throw new Error('No encontramos días ni actividades en el PDF.')
  return plan
}
