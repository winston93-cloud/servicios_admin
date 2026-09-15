import { enviarCorreoMasivo, htmlCuerpoCorreoMasivo } from './emailServicios'
import { createBoletasDb } from './boletasInsforge'
import { etiquetaCicloBoletas } from './boletasCiclo'
import { generarPdfKinderEs } from './boletasKinderEsService'
import { generarPdfKinderEn } from './boletasKinderEnService'
import { generarPdfPrimariaEs } from './boletasPrimariaEsService'
import { generarPdfPrimariaEn } from './boletasPrimariaEnService'
import { generarBoletaPdfBuffer } from './boletasPdf'
import { BOLETAS_NIVEL_KINDER } from './boletasKinderEsCatalog'
import { BOLETAS_NIVEL_SECUNDARIA } from './boletasCiclo'

export type BoletasModuloEmail =
  | 'kinder-es'
  | 'kinder-en'
  | 'primaria-es'
  | 'primaria-en'
  | 'secundaria'

const NIVEL_MODULO: Record<BoletasModuloEmail, number> = {
  'kinder-es': BOLETAS_NIVEL_KINDER,
  'kinder-en': BOLETAS_NIVEL_KINDER,
  'primaria-es': 3,
  'primaria-en': 3,
  secundaria: BOLETAS_NIVEL_SECUNDARIA,
}

async function emailsFamilia(alumnoId: number): Promise<string[]> {
  const db = createBoletasDb()
  const { data, error } = await db
    .from('alumno_familiar')
    .select('familiar_email, familiar_recibir_email')
    .eq('alumno_id', alumnoId)
  if (error) throw new Error(error.message)
  const set = new Set<string>()
  for (const f of data ?? []) {
    if (Number(f.familiar_recibir_email) !== 1) continue
    const email = String(f.familiar_email ?? '').trim().toLowerCase()
    if (email.includes('@')) set.add(email)
  }
  return [...set]
}

async function nombreAlumno(alumnoId: number): Promise<string> {
  const db = createBoletasDb()
  const { data, error } = await db
    .from('alumno')
    .select('alumno_app, alumno_apm, alumno_nombre')
    .eq('alumno_id', alumnoId)
    .limit(1)
  if (error) throw new Error(error.message)
  const a = data?.[0]
  if (!a) throw new Error('Alumno no encontrado')
  return [a.alumno_app, a.alumno_apm, a.alumno_nombre]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

async function pdfModulo(input: {
  modulo: BoletasModuloEmail
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<Buffer> {
  const { modulo, alumnoId, bimestre, ciclo } = input
  switch (modulo) {
    case 'kinder-es':
      return generarPdfKinderEs({ alumnoId, bimestre, ciclo })
    case 'kinder-en':
      return generarPdfKinderEn({ alumnoId, bimestre, ciclo })
    case 'primaria-es':
      return generarPdfPrimariaEs({ alumnoId, bimestre, ciclo })
    case 'primaria-en':
      return generarPdfPrimariaEn({ alumnoId, bimestre, ciclo })
    case 'secundaria':
      return generarBoletaPdfBuffer({ alumnoId, ciclo, periodo: bimestre })
    default:
      throw new Error('Módulo no soportado')
  }
}

export async function enviarBoletaIndividual(input: {
  modulo: BoletasModuloEmail
  alumnoId: number
  bimestre: number
  ciclo: number
  dryRun?: boolean
}): Promise<{ ok: boolean; emails: string[]; error?: string }> {
  const emails = await emailsFamilia(input.alumnoId)
  if (!emails.length) {
    return { ok: false, emails: [], error: 'Sin correos de familia con recibir_email=1' }
  }
  if (input.dryRun) return { ok: true, emails }

  const nombre = await nombreAlumno(input.alumnoId)
  const pdf = await pdfModulo(input)
  const cicloLabel = etiquetaCicloBoletas(input.ciclo)
  const nivel = NIVEL_MODULO[input.modulo]
  const mensaje = `Estimada familia:\n\nAdjuntamos la boleta de calificaciones de ${nombre} (trimestre ${input.bimestre}) del ciclo ${cicloLabel}.`

  const result = await enviarCorreoMasivo({
    to: emails,
    subject: `Boleta — ${nombre} · T${input.bimestre} (${cicloLabel})`,
    html: htmlCuerpoCorreoMasivo(mensaje, nivel),
    nivel,
    attachments: [
      {
        filename: `boleta_${input.modulo}_${input.alumnoId}_t${input.bimestre}_${input.ciclo}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      },
    ],
  })

  if (!result.ok) return { ok: false, emails, error: result.error || 'Error de envío' }
  return { ok: true, emails }
}
