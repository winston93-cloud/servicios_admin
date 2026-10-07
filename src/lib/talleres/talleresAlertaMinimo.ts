import { createDbAdmin } from '@/lib/insforgeAdmin'
import { modulosVisiblesDeUsuario } from '@/lib/dashboardAccesosEmpleados'
import { enviarCorreoMasivo, urlBaseCorreos } from '@/lib/emailServicios'
import { crearNotificacionEmpleado } from '@/lib/notificacionEmpleadoService'
import { MODULO_TALLERES } from '@/lib/talleres/talleresApi'
import { snapshotTalleres } from '@/lib/talleres/talleresService'
import {
  enMinimo,
  etiquetaNivel,
  nombreMaestroTaller,
  nombreTallerCompleto,
  resumenHorarios,
} from '@/lib/talleres/talleresTypes'

const DOMINIO_INSTITUCIONAL = '@winston93.edu.mx'

/**
 * Directoras y control escolar solo ven los grupos de su nivel (2 kinder · 3 primaria · 4 secundaria).
 * Quien no está aquí (dirección general, Laura, sistemas) ve todos.
 */
const NIVELES_ALERTA_POR_USUARIO: Record<number, number[]> = {
  7: [3], // coordprim — dirección primaria
  10: [3], // coording — dirección inglés primaria
  8: [2], // coordkin — dirección kinder
  54: [2], // kinder_ing — dirección inglés kinder
  39: [2], // fatima — control escolar kinder
  13: [4], // josefina — dirección secundaria
}

/** Grupos que le tocan al usuario según su nivel; un grupo mixto aparece en cada nivel que incluye. */
export function gruposDelUsuario(usuarioId: number, grupos: GrupoEnMinimo[]): GrupoEnMinimo[] {
  const niveles = NIVELES_ALERTA_POR_USUARIO[usuarioId]
  if (!niveles) return grupos
  return grupos.filter((g) => g.nivelesNum.some((n) => niveles.includes(n)))
}

export type GrupoEnMinimo = {
  id: number
  taller: string
  maestro: string
  niveles: string
  nivelesNum: number[]
  horario: string
  inscritos: number
  cupo_min: number
}

const db = () => createDbAdmin()

/** Grupos activos del ciclo actual con inscritos ≤ cupo mínimo. */
export async function gruposEnMinimo(): Promise<{ ciclo: number; grupos: GrupoEnMinimo[] }> {
  const snap = await snapshotTalleres()
  const tPorId = new Map(snap.talleres.map((t) => [t.id, t]))
  const mPorId = new Map(snap.maestros.map((m) => [m.id, m]))
  const grupos = snap.asignaciones
    .filter(enMinimo)
    .map((a) => {
      const t = tPorId.get(a.taller_id)
      const m = mPorId.get(a.maestro_id)
      return {
        id: a.id,
        taller: t ? nombreTallerCompleto(t) : 'Taller',
        maestro: m ? nombreMaestroTaller(m) : '',
        niveles: a.niveles.map(etiquetaNivel).join(' y '),
        nivelesNum: a.niveles,
        horario: resumenHorarios(a.horarios),
        inscritos: a.inscritos,
        cupo_min: a.cupo_min ?? 0,
      }
    })
    .sort((x, y) => x.inscritos - x.cupo_min - (y.inscritos - y.cupo_min) || x.taller.localeCompare(y.taller, 'es'))
  return { ciclo: snap.ciclo.valor, grupos }
}

/** Usuarios activos que ven la tarjeta de Talleres (catálogo de usuarios o lista legada). */
async function destinatariosTalleres(): Promise<{ usuarioId: number; email: string }[]> {
  const { data, error } = await db()
    .from('usuario')
    .select('usuario_id, usuario_email, dashboard_modulos')
    .eq('usuario_status', 1)
  if (error) throw new Error(`Usuarios de Talleres: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[])
    .map((u) => ({
      usuarioId: Number(u.usuario_id) || 0,
      email: String(u.usuario_email ?? '').trim().toLowerCase(),
      modulos: Array.isArray(u.dashboard_modulos) ? u.dashboard_modulos.map(String) : null,
    }))
    .filter((u) => u.usuarioId > 0 && modulosVisiblesDeUsuario(u.usuarioId, u.modulos).includes(MODULO_TALLERES))
    .map(({ usuarioId, email }) => ({ usuarioId, email }))
}

function lineaGrupo(g: GrupoEnMinimo): string {
  const faltan = g.cupo_min - g.inscritos
  const estado = faltan > 0 ? `faltan ${faltan} para el mínimo` : 'en el mínimo'
  return `${g.taller}${g.maestro ? ` — ${g.maestro}` : ''} (${g.niveles}): ${g.inscritos} inscritos, mínimo ${g.cupo_min} · ${estado}`
}

/** Grupos que entraron al mínimo (`nuevos`) y los que siguen en él tras 24 h (`recordatorio`). */
type Aviso = { nuevos: GrupoEnMinimo[]; recordatorio: GrupoEnMinimo[] }

function totalAviso(a: Aviso): number {
  return a.nuevos.length + a.recordatorio.length
}

function asuntoAviso(a: Aviso): string {
  const total = totalAviso(a)
  if (!a.nuevos.length) {
    return total === 1
      ? `🔔 Recordatorio: ${a.recordatorio[0].taller} sigue en el mínimo`
      : `🔔 Recordatorio: ${total} talleres siguen en el mínimo de inscritos`
  }
  const todos = [...a.nuevos, ...a.recordatorio]
  return total === 1 ? `⚠ Taller en mínimo: ${todos[0].taller}` : `⚠ ${total} talleres en el mínimo de inscritos`
}

function mensajeAviso(a: Aviso): string {
  const lineas: string[] = []
  if (a.nuevos.length) {
    lineas.push(a.nuevos.length === 1 ? 'Este grupo llegó a su cupo mínimo:' : 'Estos grupos llegaron a su cupo mínimo:')
    lineas.push(...a.nuevos.map((g) => `• ${lineaGrupo(g)}`))
  }
  if (a.recordatorio.length) {
    lineas.push(a.recordatorio.length === 1 ? 'Sigue en su cupo mínimo:' : 'Siguen en su cupo mínimo:')
    lineas.push(...a.recordatorio.map((g) => `• ${lineaGrupo(g)}`))
  }
  lineas.push('Revíselos en Talleres y Clases Especiales.')
  return lineas.join('\n')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function htmlCorreoMinimo(a: Aviso): string {
  const grupos = [...a.nuevos, ...a.recordatorio]
  const soloRecordatorio = !a.nuevos.length
  const filas = grupos
    .map((g) => {
      const faltan = g.cupo_min - g.inscritos
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #fecaca;">
          <strong style="color:#7f1d1d;">${escapeHtml(g.taller)}</strong><br>
          <span style="color:#475569;font-size:0.85rem;">${escapeHtml([g.maestro, g.niveles, g.horario].filter(Boolean).join(' · '))}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #fecaca;text-align:center;white-space:nowrap;">
          <strong style="color:#dc2626;font-size:1.1rem;">${g.inscritos}</strong>
          <span style="color:#64748b;"> / mín. ${g.cupo_min}</span><br>
          <span style="color:#b91c1c;font-size:0.78rem;font-weight:700;">${faltan > 0 ? `Faltan ${faltan}` : 'En el mínimo'}</span>
        </td>
      </tr>`
    })
    .join('')
  const url = `${urlBaseCorreos()}/talleres`
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <tr><td style="background:linear-gradient(135deg,#991b1b 0%,#dc2626 100%);border-radius:16px 16px 0 0;padding:22px 20px;text-align:center;">
      <p style="margin:0;color:#fff;font-size:1.25rem;font-weight:800;">${soloRecordatorio ? '🔔 Recordatorio: talleres en el mínimo' : '⚠ Talleres en el mínimo de inscritos'}</p>
      <p style="margin:6px 0 0;color:#fee2e2;font-size:0.9rem;">${
        soloRecordatorio
          ? `${grupos.length} ${grupos.length === 1 ? 'grupo sigue' : 'grupos siguen'} en su cupo mínimo`
          : `${grupos.length} ${grupos.length === 1 ? 'grupo está' : 'grupos están'} en su cupo mínimo`
      }</p>
    </td></tr>
    <tr><td style="background:#fff;padding:20px 16px;border:1px solid #e2e8f0;border-top:none;">
      <p style="margin:0 0 14px;color:#334155;line-height:1.6;">Estos grupos tienen igual o menos alumnos inscritos que su mínimo para abrir. Revise si se mantienen, se fusionan o se cierran.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #fecaca;border-radius:12px;background:#fef2f2;">${filas}</table>
      <p style="margin:20px 0 0;text-align:center;">
        <a href="${url}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">Ver en Talleres</a>
      </p>
      <p style="margin:18px 0 0;color:#94a3b8;font-size:0.78rem;text-align:center;">Aviso automático de Servicios Administrativos. Se repite cada 24 horas mientras el grupo siga en su mínimo.</p>
    </td></tr>
  </table>
</body></html>`
}

/** Margen para que el cron diario (8:00) alcance avisos de ~24 h y no los brinque al día siguiente. */
const INTERVALO_RECORDATORIO_MS = 23.5 * 60 * 60 * 1000

/**
 * Compara los grupos en mínimo contra los ya avisados (taller_alerta_minimo):
 * los que salieron del mínimo se borran; los que entraron se registran y se avisa; los que siguen
 * en mínimo reciben recordatorio cada 24 h. Aviso = notificación del dashboard + correo institucional
 * a quienes ven Talleres (directoras y control escolar, solo su nivel).
 */
export async function revisarAlertasMinimo(): Promise<{ nuevos: number; recordatorios: number }> {
  const { ciclo, grupos } = await gruposEnMinimo()
  const actuales = new Set(grupos.map((g) => g.id))

  const { data: abiertas, error } = await db().from('taller_alerta_minimo').select('asignacion_id, alertado_at')
  if (error) throw new Error(`Alertas de mínimo: ${error.message}`)
  const avisadas = new Map(
    ((abiertas ?? []) as Record<string, unknown>[]).map((r) => [Number(r.asignacion_id), String(r.alertado_at ?? '')])
  )

  const salieron = [...avisadas.keys()].filter((id) => !actuales.has(id))
  if (salieron.length) {
    const { error: dErr } = await db().from('taller_alerta_minimo').delete().in('asignacion_id', salieron)
    if (dErr) console.error('Alertas de mínimo (limpiar):', dErr.message)
  }

  const limite = new Date(Date.now() - INTERVALO_RECORDATORIO_MS).toISOString()
  const nuevos: GrupoEnMinimo[] = []
  const recordatorio: GrupoEnMinimo[] = []
  for (const g of grupos) {
    const previo = avisadas.get(g.id)
    if (previo == null) {
      const { error: iErr } = await db()
        .from('taller_alerta_minimo')
        .insert([{ asignacion_id: g.id, ciclo_escolar: ciclo, inscritos: g.inscritos, cupo_min: g.cupo_min }])
      // Si otra petición ya lo registró (PK), ella manda el aviso.
      if (!iErr) nuevos.push(g)
    } else if (previo && new Date(previo).getTime() <= Date.parse(limite)) {
      // Solo la petición que logra mover alertado_at manda el recordatorio.
      const { data: tomado, error: uErr } = await db()
        .from('taller_alerta_minimo')
        .update({ alertado_at: new Date().toISOString(), inscritos: g.inscritos, cupo_min: g.cupo_min })
        .eq('asignacion_id', g.id)
        .lte('alertado_at', limite)
        .select('asignacion_id')
      if (!uErr && tomado?.length) recordatorio.push(g)
    }
  }
  if (!nuevos.length && !recordatorio.length) return { nuevos: 0, recordatorios: 0 }

  const destinatarios = await destinatariosTalleres()
  // Mismo aviso → un solo correo con todos esos destinatarios.
  const correosPorAviso = new Map<string, { aviso: Aviso; correos: Set<string> }>()

  await Promise.all(
    destinatarios.map(async (d) => {
      const aviso: Aviso = {
        nuevos: gruposDelUsuario(d.usuarioId, nuevos),
        recordatorio: gruposDelUsuario(d.usuarioId, recordatorio),
      }
      if (!totalAviso(aviso)) return
      const r = await crearNotificacionEmpleado({
        usuarioId: d.usuarioId,
        asunto: asuntoAviso(aviso),
        mensaje: mensajeAviso(aviso),
      })
      if (!r.ok) console.error('Alerta mínimo (notificación):', d.usuarioId, r.message)
      if (!d.email.endsWith(DOMINIO_INSTITUCIONAL)) return
      const clave = `${aviso.nuevos.map((g) => g.id).join(',')}|${aviso.recordatorio.map((g) => g.id).join(',')}`
      const entrada = correosPorAviso.get(clave) ?? { aviso, correos: new Set<string>() }
      entrada.correos.add(d.email)
      correosPorAviso.set(clave, entrada)
    })
  )

  for (const { aviso, correos } of correosPorAviso.values()) {
    const envio = await enviarCorreoMasivo({
      to: [...correos],
      subject: asuntoAviso(aviso),
      html: htmlCorreoMinimo(aviso),
      nivel: 3,
    })
    if (!envio.ok) console.error('Alerta mínimo (correo):', envio.error)
  }
  return { nuevos: nuevos.length, recordatorios: recordatorio.length }
}

/** Para `after()`: nunca lanza. */
export async function revisarAlertasMinimoSeguro(): Promise<void> {
  try {
    await revisarAlertasMinimo()
  } catch (e) {
    console.error('Alertas de mínimo de Talleres:', e)
  }
}
