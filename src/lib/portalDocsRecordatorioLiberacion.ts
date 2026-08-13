import { createDbAdmin } from '@/lib/insforgeAdmin'
import { enviarCorreoMasivo } from '@/lib/emailServicios'
import {
  CE_MODULO_LIBERAR_DESDE_ISO,
  ctrlDesdeAlumnoRef,
} from '@/lib/controlEscolarService'
import {
  correoControlEscolarPorNivel,
  correoDocumentosNiEfectivo,
} from '@/lib/portalDocumentosNiTipos'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'

const MS_24H = 24 * 60 * 60 * 1000
const URL_CONTROL_ESCOLAR = 'https://servicios-admin.vercel.app/control-escolar'

export type PendienteLiberacionDocs = {
  envioId: number
  alumnoId: number
  alumnoRef: number
  alumnoNombre: string
  nivel: number
  grado: number | null
  cicloValor: number
  correoDestino: string
  enviadoAt: string
  recordatorioLiberacionAt: string | null
  horasDesdeEnvio: number
}

export type ResultadoRecordatorioLiberacion = {
  ok: boolean
  pendientes: number
  correosEnviados: number
  porNivel: Array<{
    nivel: number
    correo: string
    alumnos: number
    enviado: boolean
    error?: string
  }>
  mensaje: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function haceAlMenos24h(iso: string | null | undefined, ahora: number): boolean {
  if (!iso) return true
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return true
  return ahora - t >= MS_24H
}

/**
 * Último envío de docs por alumno+ciclo que aún no está en a_inscritos
 * y ya lleva ≥24 h sin liberar (y ≥24 h desde el último recordatorio).
 *
 * Mismo alcance que el minipanel de Control Escolar: solo envíos desde
 * el lanzamiento del módulo de liberar (`CE_MODULO_LIBERAR_DESDE_ISO`).
 */
export async function listarPendientesLiberacionDocumentosNi(
  ahora = Date.now()
): Promise<PendienteLiberacionDocs[]> {
  const db = createDbAdmin()

  const { data: envios, error } = await db
    .from('portal_documentos_ni')
    .select(
      'id, alumno_id, alumno_ref, ciclo_valor, nivel, correo_destino, enviado_at, recordatorio_liberacion_at'
    )
    .gte('enviado_at', CE_MODULO_LIBERAR_DESDE_ISO)
    .order('enviado_at', { ascending: false })
    .limit(2000)

  if (error) {
    throw new Error(error.message)
  }

  const latest = new Map<string, (typeof envios)[number]>()
  for (const row of envios ?? []) {
    const key = `${row.alumno_id}:${row.ciclo_valor}`
    if (!latest.has(key)) latest.set(key, row)
  }

  const { data: inscritos, error: errIns } = await db
    .from('a_inscritos')
    .select('ctrl')
    .limit(5000)

  if (errIns) {
    throw new Error(errIns.message)
  }

  const ctrlsLiberados = new Set(
    (inscritos ?? [])
      .map((r) => String(r.ctrl ?? '').replace(/\D/g, '').slice(-5))
      .filter(Boolean)
  )

  const alumnoIds = [...new Set([...latest.values()].map((e) => Number(e.alumno_id)))]
  const nombrePorId = new Map<
    number,
    { nombre: string; grado: number | null }
  >()

  if (alumnoIds.length) {
    const { data: alumnos } = await db
      .from('alumno')
      .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_grado')
      .in('alumno_id', alumnoIds)

    for (const a of alumnos ?? []) {
      const nombre =
        `${a.alumno_nombre ?? ''} ${a.alumno_app ?? ''} ${a.alumno_apm ?? ''}`.trim() ||
        'Alumno'
      nombrePorId.set(Number(a.alumno_id), {
        nombre,
        grado:
          a.alumno_grado == null || a.alumno_grado === ''
            ? null
            : Number(a.alumno_grado),
      })
    }
  }

  const pendientes: PendienteLiberacionDocs[] = []

  for (const envio of latest.values()) {
    const ctrl = ctrlDesdeAlumnoRef(envio.alumno_ref)
    if (!ctrl || ctrlsLiberados.has(ctrl)) continue
    if (!haceAlMenos24h(envio.enviado_at, ahora)) continue
    if (!haceAlMenos24h(envio.recordatorio_liberacion_at, ahora)) continue

    const meta = nombrePorId.get(Number(envio.alumno_id))
    const nivel = Number(envio.nivel)
    pendientes.push({
      envioId: Number(envio.id),
      alumnoId: Number(envio.alumno_id),
      alumnoRef: Number(envio.alumno_ref),
      alumnoNombre: meta?.nombre ?? `Ref. ${envio.alumno_ref}`,
      nivel,
      grado: meta?.grado ?? null,
      cicloValor: Number(envio.ciclo_valor),
      correoDestino:
        correoDocumentosNiEfectivo(nivel) ||
        String(envio.correo_destino ?? '').trim() ||
        correoControlEscolarPorNivel(nivel) ||
        '',
      enviadoAt: String(envio.enviado_at),
      recordatorioLiberacionAt: envio.recordatorio_liberacion_at
        ? String(envio.recordatorio_liberacion_at)
        : null,
      horasDesdeEnvio: Math.floor(
        (ahora - Date.parse(String(envio.enviado_at))) / (60 * 60 * 1000)
      ),
    })
  }

  return pendientes.filter((p) => p.correoDestino)
}

function htmlRecordatorioLiberacion(
  nivel: number,
  pendientes: PendienteLiberacionDocs[]
): string {
  const nivelLbl = etiquetaNivelEscolar(nivel) || `Nivel ${nivel}`
  const filas = pendientes
    .map((p) => {
      const gradoLbl =
        p.grado != null ? etiquetaGradoEscolar(nivel, p.grado) || String(p.grado) : '—'
      const ref = String(p.alumnoRef).padStart(5, '0')
      const enviado = p.enviadoAt.slice(0, 16).replace('T', ' ')
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(p.alumnoNombre)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${escapeHtml(ref)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(gradoLbl)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${p.horasDesdeEnvio} h</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${escapeHtml(enviado)}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;padding:20px 12px;">
    <tr>
      <td style="background:#0f172a;color:#fff;border-radius:14px 14px 0 0;padding:18px 20px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">Recordatorio diario</p>
        <h1 style="margin:6px 0 0;font-size:20px;">Documentación pendiente de liberar · ${escapeHtml(nivelLbl)}</h1>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:18px 20px;border-radius:0 0 14px 14px;">
        <p style="margin:0 0 14px;line-height:1.55;color:#334155;">
          Hay <strong>${pendientes.length}</strong> alumno(s) de nuevo ingreso / cambio de nivel
          con documentos enviados desde el módulo de liberar (28 jul 2026) y
          <strong>sin autorización de documentación completa</strong>
          en Control Escolar. Conviene liberarlos para registrar el expediente
          y enviar el correo de bienvenida.
          Es la misma lista que el minipanel de Control Escolar (pendientes ≥24&nbsp;h).
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="padding:8px 10px;">Alumno</th>
              <th style="padding:8px 10px;text-align:center;">Ref.</th>
              <th style="padding:8px 10px;">Grado</th>
              <th style="padding:8px 10px;text-align:center;">Espera</th>
              <th style="padding:8px 10px;">Docs enviados</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
        <p style="margin:18px 0 0;text-align:center;">
          <a href="${URL_CONTROL_ESCOLAR}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;">
            Abrir Control Escolar
          </a>
        </p>
        <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;line-height:1.45;">
          Este aviso se reenvía cada 24 horas mientras existan pendientes.
          Cuando marques «Documentación completa» en el dashboard, el alumno sale de esta lista.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Envía un correo por nivel a control escolar con los NI pendientes de liberar.
 * Actualiza `recordatorio_liberacion_at` en los envíos recordados.
 */
export async function enviarRecordatoriosLiberacionDocumentosNi(): Promise<ResultadoRecordatorioLiberacion> {
  const pendientes = await listarPendientesLiberacionDocumentosNi()
  if (!pendientes.length) {
    return {
      ok: true,
      pendientes: 0,
      correosEnviados: 0,
      porNivel: [],
      mensaje: 'Sin pendientes de liberación (≥24 h).',
    }
  }

  const porNivel = new Map<number, PendienteLiberacionDocs[]>()
  for (const p of pendientes) {
    const list = porNivel.get(p.nivel) ?? []
    list.push(p)
    porNivel.set(p.nivel, list)
  }

  const db = createDbAdmin()
  const ahoraIso = new Date().toISOString()
  const detalle: ResultadoRecordatorioLiberacion['porNivel'] = []
  let correosEnviados = 0
  const idsOk: number[] = []

  for (const [nivel, lista] of porNivel) {
    const correo = lista[0]?.correoDestino || correoControlEscolarPorNivel(nivel)
    if (!correo) {
      detalle.push({
        nivel,
        correo: '',
        alumnos: lista.length,
        enviado: false,
        error: 'Sin correo de control escolar',
      })
      continue
    }

    const nivelLbl = etiquetaNivelEscolar(nivel) || `Nivel ${nivel}`
    const envio = await enviarCorreoMasivo({
      to: [correo],
      subject: `[Recordatorio] ${lista.length} documentación(es) pendiente(s) de liberar · ${nivelLbl}`,
      html: htmlRecordatorioLiberacion(nivel, lista),
      nivel,
    })

    if (!envio.ok) {
      detalle.push({
        nivel,
        correo,
        alumnos: lista.length,
        enviado: false,
        error: envio.error,
      })
      continue
    }

    correosEnviados += 1
    detalle.push({ nivel, correo, alumnos: lista.length, enviado: true })
    idsOk.push(...lista.map((p) => p.envioId))
  }

  if (idsOk.length) {
    const { error } = await db
      .from('portal_documentos_ni')
      .update({ recordatorio_liberacion_at: ahoraIso })
      .in('id', idsOk)
    if (error) {
      console.error('No se pudo marcar recordatorio_liberacion_at:', error)
    }
  }

  return {
    ok: correosEnviados > 0 || pendientes.length === 0,
    pendientes: pendientes.length,
    correosEnviados,
    porNivel: detalle,
    mensaje:
      correosEnviados > 0
        ? `Recordatorio enviado a ${correosEnviados} coordinación(es) · ${pendientes.length} alumno(s) pendiente(s).`
        : `Había ${pendientes.length} pendiente(s) pero no se pudo enviar correo.`,
  }
}
