import { createDbAdmin } from '@/lib/insforgeAdmin'
import { enviarCorreoMasivo, urlBaseCorreos } from '@/lib/emailServicios'
import { crearNotificacionEmpleado } from '@/lib/notificacionEmpleadoService'
import { hoyMexico } from '@/lib/talleres/talleresAsistenciaService'
import { esDiaInhabil } from '@/lib/talleres/talleresAlertaMinimo'
import {
  alumnosSinPagoInscripcion,
  cicloActualAlertaInscripcion,
  type AlumnoSinPagoInscripcion,
} from '@/lib/inscripcionSinPagoAlerta'
import {
  DIAS_AVISO_CONTROL_ESCOLAR,
  DIAS_AVISO_DIRECCION,
  TODOS_NIVELES_ALERTA_INSCRIPCION,
  reglaAvisoInscripcion,
  usuariosAlertaInscripcion,
  type EtapaAvisoInscripcion,
} from '@/lib/inscripcionSinPagoNiveles'

const DOMINIO_INSTITUCIONAL = '@winston93.edu.mx'

/** Margen para que el cron diario (8:00) alcance avisos de ~24 h y no los brinque al día siguiente. */
const INTERVALO_RECORDATORIO_MS = 23.5 * 60 * 60 * 1000

const db = () => createDbAdmin()

/** Alumnos que acaban de cumplir la regla (`nuevos`) y los que siguen sin pagar tras 24 h (`recordatorio`). */
type Aviso = {
  ciclo: string
  /** Umbral del escalón: 15 control escolar, 45 directoras. */
  dias: number
  etapa: EtapaAvisoInscripcion
  nuevos: AlumnoSinPagoInscripcion[]
  recordatorio: AlumnoSinPagoInscripcion[]
}

function totalAviso(a: Aviso): number {
  return a.nuevos.length + a.recordatorio.length
}

function asuntoAviso(a: Aviso): string {
  const total = totalAviso(a)
  const ciclo = ` (ciclo ${a.ciclo})`
  if (!a.nuevos.length) {
    return total === 1
      ? `🔔 Recordatorio: ${a.recordatorio[0].nombre} sigue sin pagar inscripción${ciclo}`
      : `🔔 Recordatorio: ${total} alumnos siguen sin pagar inscripción${ciclo}`
  }
  const todos = [...a.nuevos, ...a.recordatorio]
  return total === 1
    ? `Inscripción sin pagar${ciclo}: ${todos[0].nombre}`
    : `${total} alumnos con más de ${a.dias} días sin pagar inscripción${ciclo}`
}

function lineaAlumno(a: AlumnoSinPagoInscripcion): string {
  const estado = a.pago_parcial ? 'pagó solo un diferido' : 'sin pagar'
  return `${a.nombre} (ref. ${a.alumno_ref}, ${[a.nivel, a.grado].filter(Boolean).join(' ')}): ${a.dias} días ${a.cuenta_por === 'referencia' ? 'desde su referencia' : 'desde el inicio de ciclo'}, ${estado}`
}

function mensajeAviso(a: Aviso): string {
  const lineas: string[] = [`Ciclo escolar ${a.ciclo}.`]
  if (a.nuevos.length) {
    lineas.push(
      a.nuevos.length === 1
        ? `Este alumno ya lleva más de ${a.dias} días sin pagar inscripción:`
        : `Estos alumnos ya llevan más de ${a.dias} días sin pagar inscripción:`
    )
    lineas.push(...a.nuevos.map((x) => `• ${lineaAlumno(x)}`))
  }
  if (a.recordatorio.length) {
    lineas.push(a.recordatorio.length === 1 ? 'Sigue sin pagar inscripción:' : 'Siguen sin pagar inscripción:')
    lineas.push(...a.recordatorio.map((x) => `• ${lineaAlumno(x)}`))
  }
  if (a.etapa === 'direccion') lineas.push(`Control escolar tiene el aviso desde los ${DIAS_AVISO_CONTROL_ESCOLAR} días.`)
  return lineas.join('\n')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function htmlCorreo(a: Aviso): string {
  const alumnos = [...a.nuevos, ...a.recordatorio]
  const soloRecordatorio = !a.nuevos.length
  const filas = alumnos
    .map(
      (x) => `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #bfdbfe;">
          <strong style="color:#1e3a8a;">${escapeHtml(x.nombre)}</strong><br>
          <span style="color:#475569;font-size:0.85rem;">${escapeHtml(
            [`Ref. ${x.alumno_ref}`, x.nivel, x.grado].filter(Boolean).join(' · ')
          )}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #bfdbfe;text-align:center;white-space:nowrap;">
          <strong style="color:#1d4ed8;font-size:1.1rem;">${x.dias}</strong>
          <span style="color:#64748b;"> días</span><br>
          <span style="color:#1e40af;font-size:0.78rem;font-weight:700;">${x.pago_parcial ? 'Solo un diferido' : 'Sin pagar'}</span>
        </td>
      </tr>`
    )
    .join('')
  const url = `${urlBaseCorreos()}/dashboard`
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);border-radius:16px 16px 0 0;padding:22px 20px;text-align:center;">
      <p style="margin:0;color:#fff;font-size:1.25rem;font-weight:800;">${
        soloRecordatorio ? '🔔 Recordatorio: inscripciones sin pagar' : 'Inscripciones sin pagar'
      }</p>
      <p style="margin:8px 0 0;"><span style="display:inline-block;padding:3px 12px;border-radius:999px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;font-size:0.85rem;font-weight:800;">Ciclo escolar ${escapeHtml(a.ciclo)}</span></p>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:0.9rem;">${alumnos.length} ${
        alumnos.length === 1 ? 'alumno lleva' : 'alumnos llevan'
      } más de ${a.dias} días sin pagar inscripción</p>
    </td></tr>
    <tr><td style="background:#fff;padding:20px 16px;border:1px solid #e2e8f0;border-top:none;">
      <p style="margin:0 0 14px;color:#334155;line-height:1.6;">Son alumnos activos del ciclo actual que llevan más de ${a.dias} días sin pagar su inscripción, contados desde el inicio del ciclo o, si su referencia se dio después, desde esa fecha.${
        a.etapa === 'direccion' ? ` Control escolar tiene el aviso desde los ${DIAS_AVISO_CONTROL_ESCOLAR} días.` : ''
      }</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;">${filas}</table>
      <p style="margin:20px 0 0;text-align:center;">
        <a href="${url}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">Abrir Servicios Administrativos</a>
      </p>
      <p style="margin:18px 0 0;color:#94a3b8;font-size:0.78rem;text-align:center;">Aviso automático de Servicios Administrativos. Se repite cada día hábil mientras el alumno siga sin pagar.</p>
    </td></tr>
  </table>
</body></html>`
}

/**
 * Dos escalones sobre la misma lista (inscripcion_alerta_sin_pago):
 * - control escolar (y sistemas): alumnos con más de 15 días, marca `alertado_at`;
 * - directoras de cada nivel: los que pasan de 45 días, marca `direccion_alertado_at`.
 * Los que pagaron o salieron de la regla se borran; los nuevos de cada escalón reciben aviso y los que siguen,
 * recordatorio cada 24 h. Aviso = notificación del dashboard + correo institucional, cada quien su nivel.
 * Solo en días hábiles: en inhábiles no se toca nada y el siguiente día hábil sale el aviso pendiente.
 */
export async function revisarAvisosInscripcionSinPago(): Promise<{ nuevos: number; recordatorios: number }> {
  if (await esDiaInhabil(hoyMexico())) return { nuevos: 0, recordatorios: 0 }
  const cicloActual = await cicloActualAlertaInscripcion()
  const ciclo = cicloActual.valor
  const alumnos = await alumnosSinPagoInscripcion(TODOS_NIVELES_ALERTA_INSCRIPCION, cicloActual, DIAS_AVISO_CONTROL_ESCOLAR)
  const actuales = new Set(alumnos.map((a) => a.alumno_id))

  const { data: abiertas, error } = await db()
    .from('inscripcion_alerta_sin_pago')
    .select('alumno_id, alertado_at, direccion_alertado_at')
  if (error) throw new Error(`Avisos de inscripción: ${error.message}`)
  const avisadas = new Map(
    ((abiertas ?? []) as Record<string, unknown>[]).map((r) => [
      Number(r.alumno_id),
      { escolar: String(r.alertado_at ?? ''), direccion: r.direccion_alertado_at ? String(r.direccion_alertado_at) : null },
    ])
  )

  const salieron = [...avisadas.keys()].filter((id) => !actuales.has(id))
  if (salieron.length) {
    const { error: dErr } = await db().from('inscripcion_alerta_sin_pago').delete().in('alumno_id', salieron)
    if (dErr) console.error('Avisos de inscripción (limpiar):', dErr.message)
  }

  const limite = new Date(Date.now() - INTERVALO_RECORDATORIO_MS).toISOString()
  const escolar = { nuevos: [] as AlumnoSinPagoInscripcion[], recordatorio: [] as AlumnoSinPagoInscripcion[] }
  const direccion = { nuevos: [] as AlumnoSinPagoInscripcion[], recordatorio: [] as AlumnoSinPagoInscripcion[] }
  for (const a of alumnos) {
    const previo = avisadas.get(a.alumno_id)
    if (previo == null) {
      const { error: iErr } = await db()
        .from('inscripcion_alerta_sin_pago')
        .insert([{ alumno_id: a.alumno_id, ciclo_escolar: ciclo, alumno_nivel: a.nivel_num }])
      // Si otra petición ya lo registró (PK), ella manda el aviso.
      if (!iErr) escolar.nuevos.push(a)
    } else if (previo.escolar && new Date(previo.escolar).getTime() <= Date.parse(limite)) {
      // Solo la petición que logra mover alertado_at manda el recordatorio.
      const { data: tomado, error: uErr } = await db()
        .from('inscripcion_alerta_sin_pago')
        .update({ alertado_at: new Date().toISOString() })
        .eq('alumno_id', a.alumno_id)
        .lte('alertado_at', limite)
        .select('alumno_id')
      if (!uErr && tomado?.length) escolar.recordatorio.push(a)
    }

    if (a.dias <= DIAS_AVISO_DIRECCION) continue
    const previoDireccion = previo?.direccion ?? null
    if (previoDireccion == null) {
      const { data: tomado, error: uErr } = await db()
        .from('inscripcion_alerta_sin_pago')
        .update({ direccion_alertado_at: new Date().toISOString() })
        .eq('alumno_id', a.alumno_id)
        .is('direccion_alertado_at', null)
        .select('alumno_id')
      if (!uErr && tomado?.length) direccion.nuevos.push(a)
    } else if (new Date(previoDireccion).getTime() <= Date.parse(limite)) {
      const { data: tomado, error: uErr } = await db()
        .from('inscripcion_alerta_sin_pago')
        .update({ direccion_alertado_at: new Date().toISOString() })
        .eq('alumno_id', a.alumno_id)
        .lte('direccion_alertado_at', limite)
        .select('alumno_id')
      if (!uErr && tomado?.length) direccion.recordatorio.push(a)
    }
  }
  const porEtapa = { 'control-escolar': escolar, direccion } as const
  const nuevos = escolar.nuevos.length + direccion.nuevos.length
  const recordatorios = escolar.recordatorio.length + direccion.recordatorio.length
  if (!nuevos && !recordatorios) return { nuevos: 0, recordatorios: 0 }

  const { data: usuarios, error: uErr } = await db()
    .from('usuario')
    .select('usuario_id, usuario_email')
    .in('usuario_id', usuariosAlertaInscripcion())
    .eq('usuario_status', 1)
  if (uErr) throw new Error(`Usuarios del aviso de inscripción: ${uErr.message}`)

  await Promise.all(
    ((usuarios ?? []) as Record<string, unknown>[]).map(async (u) => {
      const usuarioId = Number(u.usuario_id) || 0
      const regla = reglaAvisoInscripcion(usuarioId)
      if (!regla) return
      const lista = porEtapa[regla.etapa]
      const aviso: Aviso = {
        ciclo: cicloActual.nombre,
        dias: regla.dias,
        etapa: regla.etapa,
        nuevos: lista.nuevos.filter((a) => regla.niveles.includes(a.nivel_num)),
        recordatorio: lista.recordatorio.filter((a) => regla.niveles.includes(a.nivel_num)),
      }
      if (!totalAviso(aviso)) return
      const r = await crearNotificacionEmpleado({ usuarioId, asunto: asuntoAviso(aviso), mensaje: mensajeAviso(aviso) })
      if (!r.ok) console.error('Aviso inscripción (notificación):', usuarioId, r.message)
      const email = String(u.usuario_email ?? '').trim().toLowerCase()
      if (!email.endsWith(DOMINIO_INSTITUCIONAL)) return
      const envio = await enviarCorreoMasivo({ to: [email], subject: asuntoAviso(aviso), html: htmlCorreo(aviso), nivel: 3 })
      if (!envio.ok) console.error('Aviso inscripción (correo):', usuarioId, envio.error)
    })
  )
  return { nuevos, recordatorios }
}

/** Para `after()`: nunca lanza. */
export async function revisarAvisosInscripcionSinPagoSeguro(): Promise<void> {
  try {
    await revisarAvisosInscripcionSinPago()
  } catch (e) {
    console.error('Avisos de inscripción sin pagar:', e)
  }
}
