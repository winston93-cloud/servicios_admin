import { createDbAdmin } from '@/lib/insforgeAdmin'
import { enviarCorreoMasivo, htmlCuerpoCorreoMasivo } from '@/lib/emailServicios'
import { correoDocumentosNiEfectivo } from '@/lib/portalDocumentosNiTipos'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { grupoALetra } from '@/lib/alumnoBusquedaServicios'
import {
  dashboardTramitePorNivel,
  etiquetaDashboardTramite,
  esConceptoTramiteControlEscolar,
  type DashboardTramiteCe,
  type EstadoTramiteCe,
  type FilaTramiteAdministrativo,
} from '@/lib/controlEscolarTramitesTipos'

const MS_24H = 24 * 60 * 60 * 1000
const URL_CONTROL_ESCOLAR = 'https://servicios-admin.vercel.app/control-escolar'

export {
  CONCEPTOS_TRAMITE_CONTROL_ESCOLAR,
  dashboardTramitePorNivel,
  etiquetaDashboardTramite,
  esConceptoTramiteControlEscolar,
} from '@/lib/controlEscolarTramitesTipos'
export type {
  DashboardTramiteCe,
  EstadoTramiteCe,
  FilaTramiteAdministrativo,
} from '@/lib/controlEscolarTramitesTipos'

function nombreAlumno(row: {
  alumno_nombre?: string | null
  alumno_app?: string | null
  alumno_apm?: string | null
}): string {
  return `${row.alumno_nombre ?? ''} ${row.alumno_app ?? ''} ${row.alumno_apm ?? ''}`
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchConceptoOtroPorPagoIds(
  db: ReturnType<typeof createDbAdmin>,
  pagoIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  const ids = [...new Set(pagoIds.filter((id) => Number.isFinite(id) && id > 0))]
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    if (!chunk.length) continue
    const { data: pagos } = await db
      .from('pago_interno')
      .select('pago_id, concepto_otro')
      .in('pago_id', chunk)
    for (const p of pagos ?? []) {
      const extra = String(p.concepto_otro ?? '').trim()
      if (extra) map.set(Number(p.pago_id), extra)
    }
  }
  return map
}

function filaDesdeRow(
  row: {
    id: number
    pago_id: number
    alumno_id: number
    alumno_ref: string
    concepto_id: number
    concepto_nombre: string
    pago_folio: number | null
    pago_ciclo_escolar: number | null
    alumno_nivel: number | null
    estado: string
    creado_at: string
    correo_aviso_at: string | null
    recordatorio_at: string | null
    liberado_at: string | null
    liberado_por: string | null
  },
  alumno?: {
    alumno_nombre?: string | null
    alumno_app?: string | null
    alumno_apm?: string | null
    alumno_grado?: string | number | null
    alumno_grupo?: string | number | null
  } | null,
  conceptoOtro?: string | null
): FilaTramiteAdministrativo {
  const nivel = row.alumno_nivel != null ? Number(row.alumno_nivel) : null
  return {
    id: Number(row.id),
    pagoId: Number(row.pago_id),
    alumnoId: Number(row.alumno_id),
    alumnoRef: String(row.alumno_ref ?? '').trim(),
    nombre: alumno ? nombreAlumno(alumno) || `Ref. ${row.alumno_ref}` : `Ref. ${row.alumno_ref}`,
    conceptoId: Number(row.concepto_id),
    conceptoNombre: String(row.concepto_nombre ?? ''),
    conceptoOtro: (conceptoOtro ?? '').trim() || null,
    pagoFolio: row.pago_folio == null ? null : Number(row.pago_folio),
    cicloValor:
      row.pago_ciclo_escolar == null ? null : Number(row.pago_ciclo_escolar),
    nivel,
    nivelEtiqueta: nivel != null ? etiquetaNivelEscolar(nivel) || `Nivel ${nivel}` : '—',
    gradoEtiqueta:
      nivel != null
        ? etiquetaGradoEscolar(nivel, alumno?.alumno_grado) || '—'
        : '—',
    grupoEtiqueta: grupoALetra(alumno?.alumno_grupo) ?? '—',
    dashboard: dashboardTramitePorNivel(nivel),
    estado: (row.estado as EstadoTramiteCe) || 'pendiente',
    creadoAt: row.creado_at,
    correoAvisoAt: row.correo_aviso_at,
    recordatorioAt: row.recordatorio_at,
    liberadoAt: row.liberado_at,
    liberadoPor: row.liberado_por,
  }
}

export async function registrarTramiteDesdePagoInterno(opts: {
  pagoId: number
  alumnoId: number
  conceptoId: number
  pagoFolio: number
  pagoCiclo: number
}): Promise<{ ok: boolean; tramiteId?: number; correoEnviado?: boolean; mensaje?: string }> {
  if (!esConceptoTramiteControlEscolar(opts.conceptoId)) {
    return { ok: true }
  }

  const db = createDbAdmin()
  const { data: alumno, error: alErr } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'
    )
    .eq('alumno_id', opts.alumnoId)
    .maybeSingle()

  if (alErr || !alumno) {
    return { ok: false, mensaje: alErr?.message ?? 'Alumno no encontrado para el trámite' }
  }

  const { data: concepto } = await db
    .from('concepto_interno')
    .select('concepto_clase')
    .eq('concepto_id', opts.conceptoId)
    .maybeSingle()

  const conceptoNombre =
    String(concepto?.concepto_clase ?? '').trim() || `Concepto ${opts.conceptoId}`
  const nivel = Number(alumno.alumno_nivel) || null
  const alumnoRef = String(alumno.alumno_ref ?? '').trim() || String(opts.alumnoId)

  const { data: existente } = await db
    .from('ce_tramite_administrativo')
    .select('id, estado')
    .eq('pago_id', opts.pagoId)
    .maybeSingle()

  if (existente?.id) {
    if (existente.estado === 'cancelado') {
      await db
        .from('ce_tramite_administrativo')
        .update({
          estado: 'pendiente',
          concepto_id: opts.conceptoId,
          concepto_nombre: conceptoNombre,
          pago_folio: opts.pagoFolio,
          pago_ciclo_escolar: opts.pagoCiclo,
          alumno_nivel: nivel,
          liberado_at: null,
          liberado_por: null,
        })
        .eq('id', existente.id)
    }
    return { ok: true, tramiteId: Number(existente.id) }
  }

  const { data: inserted, error: insErr } = await db
    .from('ce_tramite_administrativo')
    .insert([
      {
        pago_id: opts.pagoId,
        alumno_id: opts.alumnoId,
        alumno_ref: alumnoRef,
        concepto_id: opts.conceptoId,
        concepto_nombre: conceptoNombre,
        pago_folio: opts.pagoFolio,
        pago_ciclo_escolar: opts.pagoCiclo,
        alumno_nivel: nivel,
        estado: 'pendiente',
      },
    ])
    .select('id')
    .maybeSingle()

  if (insErr || !inserted) {
    console.error('ce_tramite_administrativo insert:', insErr)
    return { ok: false, mensaje: insErr?.message ?? 'No se pudo registrar el trámite' }
  }

  const tramiteId = Number(inserted.id)

  const { data: pagoRow } = await db
    .from('pago_interno')
    .select('concepto_otro')
    .eq('pago_id', opts.pagoId)
    .maybeSingle()
  const conceptoOtro = String(pagoRow?.concepto_otro ?? '').trim() || null

  const fila = filaDesdeRow(
    {
      id: tramiteId,
      pago_id: opts.pagoId,
      alumno_id: opts.alumnoId,
      alumno_ref: alumnoRef,
      concepto_id: opts.conceptoId,
      concepto_nombre: conceptoNombre,
      pago_folio: opts.pagoFolio,
      pago_ciclo_escolar: opts.pagoCiclo,
      alumno_nivel: nivel,
      estado: 'pendiente',
      creado_at: new Date().toISOString(),
      correo_aviso_at: null,
      recordatorio_at: null,
      liberado_at: null,
      liberado_por: null,
    },
    alumno,
    conceptoOtro
  )

  const correoEnviado = await enviarAvisoTramiteNuevo(fila)
  if (correoEnviado) {
    await db
      .from('ce_tramite_administrativo')
      .update({ correo_aviso_at: new Date().toISOString() })
      .eq('id', tramiteId)
  }

  return { ok: true, tramiteId, correoEnviado }
}

export async function cancelarTramitesPorPagoIds(pagoIds: number[]): Promise<void> {
  const ids = [...new Set(pagoIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (!ids.length) return
  const db = createDbAdmin()
  const { error } = await db
    .from('ce_tramite_administrativo')
    .update({ estado: 'cancelado' })
    .in('pago_id', ids)
    .eq('estado', 'pendiente')
  if (error) {
    console.error('cancelarTramitesPorPagoIds:', error)
  }
}

export async function listarTramitesAdministrativos(): Promise<{
  pendientes: FilaTramiteAdministrativo[]
  liberados: FilaTramiteAdministrativo[]
  resumen: {
    pendientes: number
    liberados: number
    porDashboard: Array<{
      dashboard: DashboardTramiteCe
      etiqueta: string
      pendientes: number
      liberados: number
    }>
  }
}> {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('ce_tramite_administrativo')
    .select(
      'id, pago_id, alumno_id, alumno_ref, concepto_id, concepto_nombre, pago_folio, pago_ciclo_escolar, alumno_nivel, estado, creado_at, correo_aviso_at, recordatorio_at, liberado_at, liberado_por'
    )
    .in('estado', ['pendiente', 'liberado'])
    .order('creado_at', { ascending: false })
    .limit(800)

  if (error) throw new Error(error.message)

  const alumnoIds = [...new Set((data ?? []).map((r) => Number(r.alumno_id)))]
  const alumnos = new Map<
    number,
    {
      alumno_nombre?: string | null
      alumno_app?: string | null
      alumno_apm?: string | null
      alumno_grado?: string | number | null
      alumno_grupo?: string | number | null
    }
  >()
  for (let i = 0; i < alumnoIds.length; i += 200) {
    const chunk = alumnoIds.slice(i, i + 200)
    if (!chunk.length) continue
    const { data: rows } = await db
      .from('alumno')
      .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_grado, alumno_grupo')
      .in('alumno_id', chunk)
    for (const a of rows ?? []) {
      alumnos.set(Number(a.alumno_id), a)
    }
  }

  const pagoIds = [...new Set((data ?? []).map((r) => Number(r.pago_id)))]
  const conceptoOtroPorPago = await fetchConceptoOtroPorPagoIds(db, pagoIds)

  const pendientes: FilaTramiteAdministrativo[] = []
  const liberados: FilaTramiteAdministrativo[] = []
  for (const row of data ?? []) {
    const fila = filaDesdeRow(
      row as never,
      alumnos.get(Number(row.alumno_id)),
      conceptoOtroPorPago.get(Number(row.pago_id)) ?? null
    )
    if (fila.estado === 'pendiente') pendientes.push(fila)
    else if (fila.estado === 'liberado') liberados.push(fila)
  }

  pendientes.sort((a, b) => Date.parse(b.creadoAt) - Date.parse(a.creadoAt))

  const dashboards: DashboardTramiteCe[] = ['kinder', 'primaria', 'secundaria']
  const porDashboard = dashboards.map((d) => ({
    dashboard: d,
    etiqueta: etiquetaDashboardTramite(d),
    pendientes: pendientes.filter((f) => f.dashboard === d).length,
    liberados: liberados.filter((f) => f.dashboard === d).length,
  }))

  return {
    pendientes,
    liberados,
    resumen: {
      pendientes: pendientes.length,
      liberados: liberados.length,
      porDashboard,
    },
  }
}

export async function liberarTramiteAdministrativo(opts: {
  tramiteId: number
  liberadoPor: string
}): Promise<{ ok: boolean; mensaje: string }> {
  const id = Number(opts.tramiteId)
  const quien = opts.liberadoPor.trim()
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, mensaje: 'Trámite inválido' }
  }
  if (!quien) {
    return { ok: false, mensaje: 'Falta el usuario de sesión' }
  }

  const db = createDbAdmin()
  const { data, error } = await db
    .from('ce_tramite_administrativo')
    .update({
      estado: 'liberado',
      liberado_at: new Date().toISOString(),
      liberado_por: quien,
    })
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, mensaje: error.message }
  if (!data) return { ok: false, mensaje: 'El trámite ya no está pendiente' }
  return { ok: true, mensaje: 'Trámite liberado. Ya quedó marcado como elaborado.' }
}

async function enviarAvisoTramiteNuevo(fila: FilaTramiteAdministrativo): Promise<boolean> {
  const nivel = fila.nivel ?? 3
  const to = correoDocumentosNiEfectivo(nivel)
  if (!to) return false

  const dash = fila.dashboard ? etiquetaDashboardTramite(fila.dashboard) : fila.nivelEtiqueta
  const conceptoLinea = fila.conceptoOtro
    ? `${fila.conceptoNombre} — ${fila.conceptoOtro}`
    : fila.conceptoNombre
  const texto = [
    `Se pagó en Administrativo un documento que corresponde a Control Escolar (${dash}).`,
    '',
    `Alumno: ${fila.nombre}`,
    `No. control: ${fila.alumnoRef}`,
    `Nivel: ${fila.nivelEtiqueta} · ${fila.gradoEtiqueta} · Grupo ${fila.grupoEtiqueta}`,
    `Concepto: ${conceptoLinea}`,
    `Folio de pago: ${fila.pagoFolio ?? '—'}`,
    '',
    'Queda en estatus Pendiente hasta que lo elaboren y lo liberen en:',
    URL_CONTROL_ESCOLAR,
    '',
    'Si no se libera en 24 horas se enviará un recordatorio.',
  ].join('\n')

  const envio = await enviarCorreoMasivo({
    to: [to],
    subject: `Nuevo trámite pagado · ${fila.conceptoNombre} · ${fila.nombre}`,
    html: htmlCuerpoCorreoMasivo(texto, nivel),
    nivel,
  })
  if (!envio.ok) {
    console.error('aviso trámite CE:', envio.error)
  }
  return envio.ok
}

function haceAlMenos24h(iso: string | null | undefined, ahora: number): boolean {
  if (!iso) return true
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return true
  return ahora - t >= MS_24H
}

export async function enviarRecordatoriosTramitesAdministrativos(
  ahora = Date.now()
): Promise<{
  ok: boolean
  pendientes: number
  correosEnviados: number
  mensaje: string
}> {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('ce_tramite_administrativo')
    .select(
      'id, pago_id, alumno_id, alumno_ref, concepto_id, concepto_nombre, pago_folio, pago_ciclo_escolar, alumno_nivel, estado, creado_at, correo_aviso_at, recordatorio_at, liberado_at, liberado_por'
    )
    .eq('estado', 'pendiente')
    .limit(500)

  if (error) {
    return { ok: false, pendientes: 0, correosEnviados: 0, mensaje: error.message }
  }

  const vencidos = (data ?? []).filter(
    (r) =>
      haceAlMenos24h(r.creado_at, ahora) && haceAlMenos24h(r.recordatorio_at, ahora)
  )
  if (!vencidos.length) {
    return {
      ok: true,
      pendientes: 0,
      correosEnviados: 0,
      mensaje: 'Sin trámites administrativos pendientes ≥24 h.',
    }
  }

  const alumnoIds = [...new Set(vencidos.map((r) => Number(r.alumno_id)))]
  const { data: alumnos } = await db
    .from('alumno')
    .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_grado, alumno_grupo')
    .in('alumno_id', alumnoIds)
  const mapa = new Map((alumnos ?? []).map((a) => [Number(a.alumno_id), a]))
  const conceptoOtroPorPago = await fetchConceptoOtroPorPagoIds(
    db,
    vencidos.map((r) => Number(r.pago_id))
  )

  const porNivel = new Map<number, FilaTramiteAdministrativo[]>()
  for (const row of vencidos) {
    const fila = filaDesdeRow(
      row as never,
      mapa.get(Number(row.alumno_id)),
      conceptoOtroPorPago.get(Number(row.pago_id)) ?? null
    )
    const nivel = fila.nivel ?? 0
    const list = porNivel.get(nivel) ?? []
    list.push(fila)
    porNivel.set(nivel, list)
  }

  let correosEnviados = 0
  const idsOk: number[] = []

  for (const [nivel, lista] of porNivel) {
    const to = correoDocumentosNiEfectivo(nivel) ?? correoDocumentosNiEfectivo(3)
    if (!to) continue
    const dash = lista[0]?.dashboard
      ? etiquetaDashboardTramite(lista[0].dashboard)
      : etiquetaNivelEscolar(nivel)
    const lineas = lista.map((f) => {
      const concepto = f.conceptoOtro
        ? `${f.conceptoNombre} — ${f.conceptoOtro}`
        : f.conceptoNombre
      return `· ${f.nombre} (${f.alumnoRef}) — ${concepto} — folio ${f.pagoFolio ?? '—'}`
    })
    const texto = [
      `Hay ${lista.length} trámite(s) pagado(s) en Administrativo aún pendientes de elaborar (${dash}).`,
      'Llevan 24 horas o más sin liberarse.',
      '',
      ...lineas,
      '',
      `Panel: ${URL_CONTROL_ESCOLAR}`,
    ].join('\n')

    const envio = await enviarCorreoMasivo({
      to: [to],
      subject: `[Recordatorio] ${lista.length} trámite(s) administrativo(s) pendiente(s) · ${dash}`,
      html: htmlCuerpoCorreoMasivo(texto, nivel || 3),
      nivel: nivel || 3,
    })
    if (envio.ok) {
      correosEnviados += 1
      idsOk.push(...lista.map((f) => f.id))
    }
  }

  if (idsOk.length) {
    const { error: upErr } = await db
      .from('ce_tramite_administrativo')
      .update({ recordatorio_at: new Date(ahora).toISOString() })
      .in('id', idsOk)
    if (upErr) console.error('recordatorio_at trámites:', upErr)
  }

  return {
    ok: true,
    pendientes: vencidos.length,
    correosEnviados,
    mensaje: `Recordatorio trámites: ${vencidos.length} pendiente(s), ${correosEnviados} correo(s).`,
  }
}
