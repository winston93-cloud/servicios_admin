import { createDbAdmin } from '@/lib/insforgeAdmin'
import { equipoDeTeacher } from './teService'
import { etiquetaGrado, hoyMx, lunesDe, sumarDias, textoSemana } from './teTypes'

export type TeNotificacion = {
  id: number
  tipo: 'plan_manana' | 'plan_hoy'
  urgencia: 'aviso' | 'urgente'
  asunto: string
  mensaje: string
  semana: string
  grado: number
  prueba: boolean
  created_at: string
}

/** Entregada = ya la mandó a la directora (o ya está aprobada); borrador y «con cambios» siguen pendientes. */
const ENTREGADA = ['pendiente', 'aprobada']

const db = () => createDbAdmin()

function diaSemana(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay()
}

/** Textos del recordatorio de planeación (también los usa el ejemplo de prueba). */
export function textoRecordatorioPlan(tipo: TeNotificacion['tipo'], grado: number, semana: string) {
  const g = etiquetaGrado(3, grado)
  const sem = textoSemana(semana)
  return tipo === 'plan_manana'
    ? {
        urgencia: 'aviso' as const,
        asunto: `Mañana entregas tu planeación de ${g}`,
        mensaje: `Recuerda: mañana jueves mandas a tu directora la planeación de ${g} (semana del ${sem}). Ella la revisa el jueves y se libera el viernes.`,
      }
    : {
        urgencia: 'urgente' as const,
        asunto: `Hoy es la entrega de tu planeación de ${g}`,
        mensaje: `Hoy jueves vence la planeación de ${g} (semana del ${sem}): mándala hoy para que tu directora la revise y se libere el viernes.`,
      }
}

/**
 * Miércoles y jueves crea el recordatorio por cada grado de la teacher cuya planeación de la semana
 * siguiente aún no está entregada, y cierra solos los que ya entregó. Idempotente: se llama al abrir la campanita.
 */
async function sincronizarRecordatorios(maestroId: number): Promise<void> {
  const r = await equipoDeTeacher(maestroId)
  if (!r) return
  const hoy = hoyMx()
  const dia = diaSemana(hoy)
  const semana = sumarDias(lunesDe(hoy), 7)

  const { data: planes, error } = await db()
    .from('te_planeacion')
    .select('grado, semana, estado')
    .eq('maestro_id', maestroId)
    .gte('semana', sumarDias(lunesDe(hoy), -21))
  if (error) throw new Error(`Planeaciones: ${error.message}`)
  const entregadas = new Set(
    ((planes ?? []) as { grado: number; semana: string; estado: string }[])
      .filter((p) => ENTREGADA.includes(p.estado))
      .map((p) => `${p.grado}|${String(p.semana).slice(0, 10)}`)
  )

  if (dia === 3 || dia === 4) {
    const tipo = dia === 3 ? 'plan_manana' : 'plan_hoy'
    const nuevas = r.teacher.grados
      .filter((g) => !entregadas.has(`${g}|${semana}`))
      .map((grado) => ({ maestro_id: maestroId, tipo, semana, grado, ...textoRecordatorioPlan(tipo, grado, semana) }))
    if (nuevas.length) {
      const { error: e } = await db()
        .from('te_notificacion')
        .upsert(nuevas, { onConflict: 'maestro_id,tipo,semana,grado', ignoreDuplicates: true })
      if (e) throw new Error(`Recordatorios: ${e.message}`)
    }
  }

  const { data: abiertas, error: e2 } = await db()
    .from('te_notificacion')
    .select('id, grado, semana, prueba')
    .eq('maestro_id', maestroId)
    .eq('leida', false)
  if (e2) throw new Error(`Recordatorios: ${e2.message}`)
  const cerrar = ((abiertas ?? []) as { id: number; grado: number; semana: string; prueba: boolean }[])
    .filter((n) => !n.prueba && entregadas.has(`${n.grado}|${String(n.semana).slice(0, 10)}`))
    .map((n) => n.id)
  if (cerrar.length) {
    const { error: e3 } = await db()
      .from('te_notificacion')
      .update({ leida: true, leida_at: new Date().toISOString(), cierre: 'entregada' })
      .in('id', cerrar)
    if (e3) throw new Error(`Recordatorios: ${e3.message}`)
  }
}

export async function notificacionesTeacher(maestroId: number): Promise<TeNotificacion[]> {
  try {
    await sincronizarRecordatorios(maestroId)
  } catch (e) {
    console.warn('[te-notif] sincronizar:', e instanceof Error ? e.message : e)
  }
  const { data, error } = await db()
    .from('te_notificacion')
    .select('id, tipo, urgencia, asunto, mensaje, semana, grado, prueba, created_at')
    .eq('maestro_id', maestroId)
    .eq('leida', false)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(`Notificaciones: ${error.message}`)
  return ((data ?? []) as TeNotificacion[]).map((n) => ({ ...n, semana: String(n.semana).slice(0, 10) }))
}

export async function marcarNotificacionTeacher(maestroId: number, ids: number[]): Promise<void> {
  if (!ids.length) return
  const { error } = await db()
    .from('te_notificacion')
    .update({ leida: true, leida_at: new Date().toISOString(), cierre: 'entendido' })
    .eq('maestro_id', maestroId)
    .in('id', ids)
  if (error) throw new Error(`Notificaciones: ${error.message}`)
}
