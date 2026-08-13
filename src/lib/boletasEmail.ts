import { enviarCorreoMasivo, htmlCuerpoCorreoMasivo } from './emailServicios'
import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_SECUNDARIA,
  etiquetaCicloBoletas,
  etiquetaGradoSecundaria,
  letraDesdeGrupoNum,
} from './boletasCiclo'
import { generarBoletaPdfBuffer } from './boletasPdf'

export type FiltroEnvioBoletas = {
  ciclo: number
  grado?: number
  grupo?: number
  periodo?: number
  /** dry-run: solo lista destinatarios */
  dryRun?: boolean
  /** Límite de seguridad */
  limit?: number
}

export type DestinatarioBoleta = {
  alumno_id: number
  nombre: string
  emails: string[]
}

/**
 * Envío masivo autenticado (paridad Filtro + BoletaEmail legacy).
 * Destinos: familiar_email con familiar_recibir_email=1 (mamá/papá).
 */
export async function filtrarDestinatariosBoletas(
  filtro: FiltroEnvioBoletas
): Promise<DestinatarioBoleta[]> {
  const db = createBoletasDb()
  let q = db
    .from('alumno')
    .select('alumno_id, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo')
    .eq('alumno_nivel', BOLETAS_NIVEL_SECUNDARIA)
    .eq('alumno_ciclo_escolar', filtro.ciclo)
    .eq('alumno_status', 1)

  if (filtro.grado && filtro.grado > 0) q = q.eq('alumno_grado', filtro.grado)
  if (filtro.grupo && filtro.grupo > 0) q = q.eq('alumno_grupo', filtro.grupo)

  const { data: alumnos, error } = await q
  if (error) throw new Error(error.message)
  const ids = (alumnos ?? []).map((a) => Number(a.alumno_id))
  if (!ids.length) return []

  const { data: familiares } = await db
    .from('alumno_familiar')
    .select('alumno_id, familiar_email, familiar_recibir_email')
    .in('alumno_id', ids)

  const emailsPorAlumno = new Map<number, Set<string>>()
  for (const f of familiares ?? []) {
    if (Number(f.familiar_recibir_email) !== 1) continue
    const email = String(f.familiar_email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) continue
    const id = Number(f.alumno_id)
    if (!emailsPorAlumno.has(id)) emailsPorAlumno.set(id, new Set())
    emailsPorAlumno.get(id)!.add(email)
  }

  const out: DestinatarioBoleta[] = []
  for (const a of alumnos ?? []) {
    const id = Number(a.alumno_id)
    const emails = [...(emailsPorAlumno.get(id) ?? [])]
    if (!emails.length) continue
    out.push({
      alumno_id: id,
      nombre: [a.alumno_app, a.alumno_apm, a.alumno_nombre]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' '),
      emails,
    })
  }

  const lim = filtro.limit && filtro.limit > 0 ? filtro.limit : out.length
  return out.slice(0, lim)
}

export async function enviarBoletasMasivo(filtro: FiltroEnvioBoletas): Promise<{
  total: number
  enviados: number
  errores: { alumno_id: number; error: string }[]
  destinatarios: DestinatarioBoleta[]
}> {
  const destinatarios = await filtrarDestinatariosBoletas(filtro)
  if (filtro.dryRun) {
    return { total: destinatarios.length, enviados: 0, errores: [], destinatarios }
  }

  let enviados = 0
  const errores: { alumno_id: number; error: string }[] = []

  for (const dest of destinatarios) {
    try {
      const pdf = await generarBoletaPdfBuffer({
        alumnoId: dest.alumno_id,
        ciclo: filtro.ciclo,
        periodo: filtro.periodo,
      })
      const cicloLabel = etiquetaCicloBoletas(filtro.ciclo)
      const mensaje = `Estimada familia:\n\nAdjuntamos la boleta de calificaciones de ${dest.nombre} correspondiente al ciclo escolar ${cicloLabel}.`
      const result = await enviarCorreoMasivo({
        to: dest.emails,
        subject: `Boleta de calificaciones — ${dest.nombre} (${cicloLabel})`,
        html: htmlCuerpoCorreoMasivo(mensaje, BOLETAS_NIVEL_SECUNDARIA),
        nivel: BOLETAS_NIVEL_SECUNDARIA,
        attachments: [
          {
            filename: `boleta_${dest.alumno_id}_${filtro.ciclo}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      })
      if (!result.ok) {
        errores.push({ alumno_id: dest.alumno_id, error: result.error || 'Error de envío' })
      } else {
        enviados++
      }
    } catch (e) {
      errores.push({
        alumno_id: dest.alumno_id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { total: destinatarios.length, enviados, errores, destinatarios }
}

export function resumenFiltroTexto(filtro: FiltroEnvioBoletas): string {
  const g = filtro.grado ? etiquetaGradoSecundaria(filtro.grado) : 'todos'
  const gr = filtro.grupo ? letraDesdeGrupoNum(filtro.grupo) : 'todos'
  return `Ciclo ${etiquetaCicloBoletas(filtro.ciclo)} · Grado ${g} · Grupo ${gr}`
}
