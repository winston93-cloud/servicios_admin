import { createHash, randomBytes } from 'crypto'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { grupoCoincide, letraDesdeGrupoNum } from '@/lib/boletasCiclo'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import { RacAuthError, type RacSesion } from '@/lib/racAuth'
import { puedeCapturarTipo, puedeInforme } from '@/lib/racPermisos'
import {
  RAC_NIVEL_SECUNDARIA,
  RAC_TIPOS,
  etiquetaEscalon,
  etiquetaTipoCitatorio,
  etiquetaTipoReporte,
  motivoReporte,
} from '@/lib/racCatalogo'
import {
  asuntoReporte,
  enviarAvisoRac,
  escapeHtml,
  htmlCorreoRac,
  urlPublicaRac,
} from '@/lib/racCorreo'
import { filaPdfDesdeReporte, type FilaPdfReporte } from '@/lib/racPdf'

type AlumnoRow = {
  alumno_id: number
  alumno_ref: string | number | null
  alumno_app: string | null
  alumno_apm: string | null
  alumno_nombre: string | null
  alumno_nivel: number
  alumno_grado: number | string | null
  alumno_grupo: number | string | null
  alumno_status: number | null
  alumno_ciclo_escolar: number | string | null
}

function db() {
  return createDbAdmin()
}

function n(v: unknown, fallback = 0): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

function nombreAlumno(a: Pick<AlumnoRow, 'alumno_app' | 'alumno_apm' | 'alumno_nombre'>): string {
  return [a.alumno_app, a.alumno_apm, a.alumno_nombre].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
}

function mdv(prefix: string): string {
  return createHash('md5').update(`${prefix}${Date.now()}${randomBytes(8).toString('hex')}`).digest('hex')
}

export async function cicloRac(): Promise<number> {
  return resolverCicloEscolarSistemaValor()
}

export type AsignacionRac = {
  grupo_id: number
  materia_id: number
  materia_nombre: string
  materia_grado: number
  grupo_letra: string
}

/** ABC / BC / A → opciones de grupo concretas para el select del maestro. */
function expandGrupoLetrasMaestro(raw: string | null | undefined): string[] {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (!s || s === '*' || s === 'ABC') return ['A', 'B', 'C']
  if (s === 'ABCD') return ['A', 'B', 'C', 'D']
  if (/^[A-F]{2,}$/.test(s)) return [...s]
  return [s]
}

export async function listarAsignaciones(session: RacSesion): Promise<{
  asignaciones: AsignacionRac[]
  fisica: boolean
  ingles: boolean
}> {
  const client = db()
  if (session.role === 'maestro') {
    const { data: grupos, error } = await client
      .from('boleta_maestro_grupo')
      .select('grupo_id, maestro_id, materia_id, grupo_letra')
      .eq('maestro_id', session.id)
    if (error) throw new Error(error.message)
    const materiaIds = [...new Set((grupos ?? []).map((g) => n(g.materia_id)))]
    if (!materiaIds.length) return { asignaciones: [], fisica: false, ingles: false }
    const { data: materias } = await client
      .from('boleta_materia')
      .select('materia_id, materia_nombre, materia_grado')
      .in('materia_id', materiaIds)
    const map = new Map((materias ?? []).map((m) => [n(m.materia_id), m]))
    // Un renglón por materia+grupo (A/B/C), no un "ABC" que mezcla todo el grado.
    const asignaciones: AsignacionRac[] = []
    for (const g of grupos ?? []) {
      const m = map.get(n(g.materia_id))
      const base = {
        grupo_id: n(g.grupo_id),
        materia_id: n(g.materia_id),
        materia_nombre: String(m?.materia_nombre ?? ''),
        materia_grado: n(m?.materia_grado),
      }
      for (const letra of expandGrupoLetrasMaestro(String(g.grupo_letra ?? ''))) {
        asignaciones.push({ ...base, grupo_letra: letra })
      }
    }
    const blob = asignaciones.map((a) => a.materia_nombre.toUpperCase()).join(' ')
    return {
      asignaciones,
      fisica: /EDUCACION FISICA|EDUCACIÓN FÍSICA/.test(blob),
      ingles: /INGLES|INGLÉS/.test(blob),
    }
  }

  const { data: materias } = await client
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_grado, materia_orden')
    .eq('materia_nivel', RAC_NIVEL_SECUNDARIA)
    .order('materia_grado')
    .order('materia_orden')
  return {
    asignaciones: (materias ?? []).map((m) => ({
      grupo_id: 0,
      materia_id: n(m.materia_id),
      materia_nombre: String(m.materia_nombre ?? ''),
      materia_grado: n(m.materia_grado),
      grupo_letra: 'ABC',
    })),
    fisica: true,
    ingles: true,
  }
}

async function alumnosDeGrupo(grado: number, grupoLetra: string, ciclo: number): Promise<AlumnoRow[]> {
  const { data, error } = await db()
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_nivel', RAC_NIVEL_SECUNDARIA)
    .eq('alumno_grado', grado)
    .neq('alumno_status', 0)
    .order('alumno_app')
  if (error) throw new Error(error.message)
  return ((data ?? []) as AlumnoRow[]).filter((a) => {
    if (n(a.alumno_status) === 2 && n(a.alumno_ciclo_escolar) !== ciclo) return false
    return grupoCoincide(grupoLetra, n(a.alumno_grupo))
  })
}

async function marcas(
  alumnoId: number,
  tipo: number,
  ciclo: number,
  materiaId: number | null
) {
  let q = db()
    .from('reporte_escolar')
    .select('reporte_no, reporte_registro, reporte_ciclo, reporte_status')
    .eq('alumno_id', alumnoId)
    .eq('reporte_tipo', tipo)
    .in('reporte_status', [1, 2])
    .eq('reporte_ciclo_escolar', ciclo)
  if (materiaId) q = q.eq('materia_id', materiaId)
  const { data } = await q
  const rows = data ?? []
  const maxC = rows.reduce((acc, r) => Math.max(acc, n(r.reporte_ciclo)), 0)
  const cur = rows.filter((r) => n(r.reporte_ciclo) === maxC)
  const fechas: Record<number, string> = {}
  for (const r of cur) {
    const dia = String(r.reporte_registro ?? '').slice(0, 10)
    const pend = n(r.reporte_status) === 2
    fechas[n(r.reporte_no)] = pend ? `${dia}·pend` : dia
  }
  return fechas
}

export async function listarGrupoCaptura(opts: {
  materiaId: number
  grupoLetra: string
  tipo: number
}) {
  const ciclo = await cicloRac()
  const { data: materia } = await db()
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_grado')
    .eq('materia_id', opts.materiaId)
    .maybeSingle()
  if (!materia) throw new Error('Materia no encontrada')
  const grado = n(materia.materia_grado)
  const alumnos = await alumnosDeGrupo(grado, opts.grupoLetra, ciclo)
  const matFiltro = opts.tipo === 1 ? opts.materiaId : null
  const filas = []
  for (const a of alumnos) {
    const f = await marcas(a.alumno_id, opts.tipo, ciclo, matFiltro)
    filas.push({
      alumno_id: a.alumno_id,
      alumno_ref: a.alumno_ref,
      nombre: nombreAlumno(a),
      grado: n(a.alumno_grado),
      grupo: letraDesdeGrupoNum(n(a.alumno_grupo)),
      aviso: f[0] ?? '',
      r1: f[1] ?? '',
      r2: f[2] ?? '',
      r3: f[3] ?? '',
    })
  }
  return {
    ciclo,
    materia: {
      materia_id: n(materia.materia_id),
      materia_nombre: String(materia.materia_nombre),
      materia_grado: grado,
    },
    filas,
  }
}

async function emailsFamilia(alumnoId: number): Promise<string[]> {
  const { data } = await db()
    .from('alumno_familiar')
    .select('familiar_email, familiar_recibir_email')
    .eq('alumno_id', alumnoId)
  const rows = data ?? []
  const pref = rows
    .filter((r) => n(r.familiar_recibir_email) === 1)
    .map((r) => String(r.familiar_email ?? '').trim().toLowerCase())
    .filter((e) => e.includes('@'))
  if (pref.length) return [...new Set(pref)]
  return [
    ...new Set(
      rows
        .map((r) => String(r.familiar_email ?? '').trim().toLowerCase())
        .filter((e) => e.includes('@'))
    ),
  ]
}

async function cargarAlumno(id: number): Promise<AlumnoRow> {
  const { data } = await db()
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_id', id)
    .maybeSingle()
  if (!data) throw new Error('Alumno no encontrado')
  return data as AlumnoRow
}

export async function enviarCorreoReporte(reporteId: number) {
  const client = db()
  const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_id', reporteId).maybeSingle()
  if (!r) throw new Error('Reporte no encontrado')
  const alumno = await cargarAlumno(n(r.alumno_id))
  const to = await emailsFamilia(alumno.alumno_id)
  if (!to.length) return { ok: false, error: 'La familia no tiene correo registrado' }
  const tipo = n(r.reporte_tipo)
  const no = n(r.reporte_no)
  const alt = tipo === 5 ? 3 : tipo === 8 ? 4 : 1
  let materiaNombre = ''
  if (r.materia_id) {
    const { data: m } = await client
      .from('boleta_materia')
      .select('materia_nombre')
      .eq('materia_id', r.materia_id)
      .maybeSingle()
    materiaNombre = String(m?.materia_nombre ?? '')
  }
  const enlace = urlPublicaRac(String(r.reporte_mdv), alt)
  const subject = asuntoReporte(tipo, no)
  const html = htmlCorreoRac({
    titulo: subject,
    enlace,
    cuerpoHtml: `<p>Estimada familia:</p>
      <p>Se registró un <b>${escapeHtml(etiquetaEscalon(tipo, no))}</b> ${escapeHtml(etiquetaTipoReporte(tipo).toLowerCase())}
      para <b>${escapeHtml(nombreAlumno(alumno))}</b> (control ${escapeHtml(String(alumno.alumno_ref ?? ''))}).</p>
      <p>Motivo: <b>${escapeHtml(motivoReporte(tipo, n(r.reporte_motivo)))}</b>${
        materiaNombre ? ` · Asignatura: <b>${escapeHtml(materiaNombre)}</b>` : ''
      }</p>
      <p>${escapeHtml(String(r.reporte_mensaje ?? '')).replace(/\n/g, '<br>')}</p>`,
  })
  const envio = await enviarAvisoRac({ to, subject, html })
  if (envio.ok) await client.from('reporte_escolar').update({ reporte_enviado: 1 }).eq('reporte_id', reporteId)
  return envio
}

export async function enviarCorreoCita(citaId: number) {
  const client = db()
  const { data: c } = await client.from('reporte_cita').select('*').eq('cita_id', citaId).maybeSingle()
  if (!c) throw new Error('Cita no encontrada')
  const alumno = await cargarAlumno(n(c.alumno_id))
  const to = await emailsFamilia(alumno.alumno_id)
  if (!to.length) return { ok: false, error: 'La familia no tiene correo registrado' }
  const enlace = urlPublicaRac(String(c.cita_mdv), 2)
  const fecha = c.cita_fecha ? String(c.cita_fecha).replace('T', ' ').slice(0, 16) : 'por confirmar'
  const subject = `Citatorio ${etiquetaTipoCitatorio(n(c.cita_tipo))}`
  const html = htmlCorreoRac({
    titulo: subject,
    enlace,
    cuerpoHtml: `<p>Estimada familia:</p>
      <p>Citatorio <b>${escapeHtml(etiquetaTipoCitatorio(n(c.cita_tipo)))}</b> para
      <b>${escapeHtml(nombreAlumno(alumno))}</b>.</p>
      <p>Fecha y hora: <b>${escapeHtml(fecha)}</b></p>
      <p>${escapeHtml(String(c.cita_mensaje ?? ''))}</p>`,
  })
  const envio = await enviarAvisoRac({ to, subject, html })
  if (envio.ok) await client.from('reporte_cita').update({ cita_enviada: 1 }).eq('cita_id', citaId)
  return envio
}

export async function enviarCorreoSuspension(suspensionId: number) {
  const client = db()
  const { data: s } = await client
    .from('reporte_suspension')
    .select('*')
    .eq('suspension_id', suspensionId)
    .maybeSingle()
  if (!s) throw new Error('Suspensión no encontrada')
  const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_id', s.reporte_id).maybeSingle()
  const alumno = await cargarAlumno(n(s.alumno_id))
  const to = await emailsFamilia(alumno.alumno_id)
  if (!to.length) return { ok: false, error: 'La familia no tiene correo registrado' }
  const enlace = urlPublicaRac(String(r?.reporte_mdv ?? ''), 5)
  const subject = 'Aviso de suspensión'
  const html = htmlCorreoRac({
    titulo: subject,
    enlace,
    cuerpoHtml: `<p>Estimada familia:</p>
      <p>El alumno <b>${escapeHtml(nombreAlumno(alumno))}</b> queda suspendido el día
      <b>${escapeHtml(String(s.suspension_fecha ?? ''))}</b> por acumular tres reportes
      ${escapeHtml(etiquetaTipoCitatorio(n(r?.reporte_tipo ?? 2)).toLowerCase())}.</p>`,
  })
  const envio = await enviarAvisoRac({ to, subject, html })
  if (envio.ok) {
    await client.from('reporte_suspension').update({ suspension_enviada: 1 }).eq('suspension_id', suspensionId)
  }
  return envio
}

export async function capturarReporte(opts: {
  session: RacSesion
  alumnoId: number
  materiaId: number
  tipo: number
  motivo: number
  mensaje: string
}) {
  const { fisica } = await listarAsignaciones(opts.session)
  if (!puedeCapturarTipo(opts.session.role, opts.tipo, fisica)) {
    throw new RacAuthError('Este tipo de reporte no corresponde a tu cuenta', 403)
  }
  const ciclo = await cicloRac()
  const client = db()
  const materiaId = opts.tipo === RAC_TIPOS.academico || opts.tipo === RAC_TIPOS.informeAcademico ? opts.materiaId : opts.materiaId
  const token = mdv('rep')

  let q = client
    .from('reporte_escolar')
    .select('reporte_no, reporte_ciclo')
    .eq('alumno_id', opts.alumnoId)
    .eq('reporte_tipo', opts.tipo)
    .eq('reporte_status', 1)
    .eq('reporte_ciclo_escolar', ciclo)
  if (opts.tipo === 1 && materiaId) q = q.eq('materia_id', materiaId)
  const { data: prev } = await q
  let reporteCiclo = 0
  let reporteNo = opts.tipo > 2 ? 1 : 0
  if (prev?.length) {
    reporteCiclo = prev.reduce((acc, r) => Math.max(acc, n(r.reporte_ciclo)), 0)
    reporteNo =
      prev.filter((r) => n(r.reporte_ciclo) === reporteCiclo).reduce((acc, r) => Math.max(acc, n(r.reporte_no)), -1) + 1
  }
  if (reporteNo === 4) {
    reporteCiclo += 1
    reporteNo = opts.tipo > 2 ? 1 : 0
  }

  let status = 1
  if (opts.tipo === 2 && opts.session.perfil !== 4) status = 2

  const insert: Record<string, unknown> = {
    alumno_id: opts.alumnoId,
    perfil_id: opts.session.perfil,
    usuario_id: opts.session.id,
    reporte_tipo: opts.tipo,
    reporte_motivo: opts.motivo,
    reporte_no: reporteNo,
    reporte_mensaje: opts.mensaje,
    reporte_status: status,
    reporte_ciclo: reporteCiclo,
    reporte_ciclo_escolar: ciclo,
    reporte_mdv: token,
  }
  if (materiaId) insert.materia_id = materiaId

  const { data: created, error } = await client.from('reporte_escolar').insert(insert).select('reporte_id').maybeSingle()
  if (error || !created) throw new Error(error?.message || 'No se pudo guardar el reporte')
  const reporteId = n(created.reporte_id)

  if (status === 2) {
    return { reporteId, reporteNo, pendienteValidacion: true, envio: { ok: true } }
  }
  if (reporteNo === 2) {
    await client.from('reporte_cita').insert({
      alumno_id: opts.alumnoId,
      materia_id: materiaId || null,
      perfil_id: opts.session.perfil,
      usuario_id: opts.session.id,
      cita_tipo: opts.tipo,
      cita_mensaje: `Citatorio generado por ${etiquetaEscalon(opts.tipo, 2)}.`,
      cita_status: 2,
      cita_ciclo_escolar: ciclo,
      cita_mdv: token,
    })
  }
  if (reporteNo === 3) {
    await client.from('reporte_suspension').insert({
      alumno_id: opts.alumnoId,
      reporte_id: reporteId,
      suspension_ciclo_escolar: ciclo,
    })
  }
  const envio = await enviarCorreoReporte(reporteId)
  return { reporteId, reporteNo, pendienteValidacion: false, envio }
}

export async function capturarInforme(opts: {
  session: RacSesion
  alumnoId: number
  materiaId: number
  mensaje: string
}) {
  const ciclo = await cicloRac()
  if (!puedeInforme(opts.session.role)) {
    throw new RacAuthError('Tu cuenta no captura informes', 403)
  }
  const psico = opts.session.role === 'psicologia'
  const insert: Record<string, unknown> = {
    alumno_id: opts.alumnoId,
    perfil_id: opts.session.perfil,
    usuario_id: opts.session.id,
    reporte_tipo: psico ? RAC_TIPOS.avisoPsicologia : RAC_TIPOS.informeAcademico,
    reporte_motivo: 0,
    reporte_no: 0,
    reporte_mensaje: opts.mensaje,
    reporte_status: 1,
    reporte_ciclo: 0,
    reporte_ciclo_escolar: ciclo,
    reporte_mdv: mdv('inf'),
  }
  if (!psico && opts.materiaId) insert.materia_id = opts.materiaId
  const { data, error } = await db().from('reporte_escolar').insert(insert).select('reporte_id').maybeSingle()
  if (error || !data) throw new Error(error?.message || 'No se guardó el informe')
  return { reporteId: n(data.reporte_id), envio: await enviarCorreoReporte(n(data.reporte_id)) }
}

export async function capturarCita(opts: {
  session: RacSesion
  alumnoId: number
  materiaId: number
  tipo: number
  mensaje: string
  fecha: string
  hora: string
}) {
  const ciclo = await cicloRac()
  const { data, error } = await db()
    .from('reporte_cita')
    .insert({
      alumno_id: opts.alumnoId,
      materia_id: opts.materiaId || null,
      perfil_id: opts.session.perfil,
      usuario_id: opts.session.id,
      cita_tipo: opts.tipo,
      cita_mensaje: opts.mensaje,
      cita_status: 1,
      cita_ciclo_escolar: ciclo,
      cita_mdv: mdv('cit'),
      cita_fecha: `${opts.fecha}T${opts.hora}:00`,
    })
    .select('cita_id')
    .maybeSingle()
  if (error || !data) throw new Error(error?.message || 'No se guardó la cita')
  return { citaId: n(data.cita_id), envio: await enviarCorreoCita(n(data.cita_id)) }
}

async function hidratar(rows: Record<string, unknown>[]) {
  if (!rows.length) return []
  const client = db()
  const alumnoIds = [...new Set(rows.map((r) => n(r.alumno_id)))]
  const materiaIds = [...new Set(rows.map((r) => n(r.materia_id)).filter(Boolean))]
  const { data: alumnos } = await client
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar, alumno_nivel'
    )
    .in('alumno_id', alumnoIds)
  const aMap = new Map((alumnos ?? []).map((a) => [n(a.alumno_id), a as AlumnoRow]))
  let mMap = new Map<number, string>()
  if (materiaIds.length) {
    const { data: mats } = await client.from('boleta_materia').select('materia_id, materia_nombre').in('materia_id', materiaIds)
    mMap = new Map((mats ?? []).map((m) => [n(m.materia_id), String(m.materia_nombre)]))
  }
  return rows.map((r) => {
    const a = aMap.get(n(r.alumno_id))
    return {
      reporte_id: n(r.reporte_id),
      alumno_id: n(r.alumno_id),
      alumno_ref: a?.alumno_ref ?? null,
      nombre: a ? nombreAlumno(a) : '',
      grado: a ? n(a.alumno_grado) : 0,
      grupo: a ? letraDesdeGrupoNum(n(a.alumno_grupo)) : '',
      materia: mMap.get(n(r.materia_id)) ?? '',
      tipo: n(r.reporte_tipo),
      tipoEtiqueta: etiquetaTipoReporte(n(r.reporte_tipo)),
      escalon: etiquetaEscalon(n(r.reporte_tipo), n(r.reporte_no)),
      motivo: motivoReporte(n(r.reporte_tipo), n(r.reporte_motivo)),
      mensaje: String(r.reporte_mensaje ?? ''),
      no: n(r.reporte_no),
      fecha: String(r.reporte_registro ?? '').slice(0, 10),
      enviado: n(r.reporte_enviado) === 1,
      confirmado: n(r.reporte_confirmado) === 1,
      status: n(r.reporte_status),
      mdv: String(r.reporte_mdv ?? ''),
    }
  })
}

export async function inboxReportes(session: RacSesion, filtro: 'pendientes' | 'informes' | 'todos') {
  const ciclo = await cicloRac()
  let q = db().from('reporte_escolar').select('*').eq('reporte_ciclo_escolar', ciclo)
  if (session.role === 'psicologia' && filtro === 'pendientes') {
    q = q.eq('reporte_status', 2).eq('reporte_tipo', RAC_TIPOS.conducta)
  } else {
    q = q.eq('reporte_status', 1)
    if (filtro === 'pendientes') q = q.lte('reporte_tipo', 5).eq('reporte_confirmado', 0)
    if (filtro === 'informes') {
      q = q.eq('reporte_tipo', session.role === 'psicologia' ? RAC_TIPOS.avisoPsicologia : RAC_TIPOS.informeAcademico)
    }
  }
  if (session.role === 'maestro') {
    const { asignaciones } = await listarAsignaciones(session)
    const ids = asignaciones.map((a) => a.materia_id)
    if (!ids.length) return []
    q = q.in('materia_id', ids)
  }
  const { data, error } = await q.order('reporte_registro', { ascending: false }).limit(400)
  if (error) throw new Error(error.message)
  return hidratar((data ?? []) as Record<string, unknown>[])
}

export async function inboxCitas(session: RacSesion) {
  const ciclo = await cicloRac()
  let q = db().from('reporte_cita').select('*').eq('cita_ciclo_escolar', ciclo).gt('cita_status', 0)
  if (session.role === 'psicologia') {
    q = q
      .eq('perfil_id', 4)
      .eq('usuario_id', session.id)
      .in('cita_tipo', [RAC_TIPOS.conducta, RAC_TIPOS.seguimiento])
  } else if (session.role === 'maestro') {
    const { asignaciones } = await listarAsignaciones(session)
    const ids = asignaciones.map((a) => a.materia_id)
    if (ids.length) q = q.in('materia_id', ids)
  }
  const { data, error } = await q.order('cita_registro', { ascending: false }).limit(300)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const ids = [...new Set(rows.map((r) => n(r.alumno_id)))]
  const { data: alumnos } = await db()
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo')
    .in('alumno_id', ids.length ? ids : [0])
  const aMap = new Map((alumnos ?? []).map((a) => [n(a.alumno_id), a]))
  return rows.map((c) => {
    const a = aMap.get(n(c.alumno_id))
    return {
      cita_id: n(c.cita_id),
      alumno_ref: a?.alumno_ref ?? null,
      nombre: a ? nombreAlumno(a as AlumnoRow) : '',
      grado: n(a?.alumno_grado),
      grupo: letraDesdeGrupoNum(n(a?.alumno_grupo)),
      tipo: n(c.cita_tipo),
      tipoEtiqueta: etiquetaTipoCitatorio(n(c.cita_tipo)),
      mensaje: String(c.cita_mensaje ?? ''),
      fecha: c.cita_fecha ? String(c.cita_fecha).replace('T', ' ').slice(0, 16) : '',
      enviada: n(c.cita_enviada) === 1,
      confirmada: n(c.cita_confirmada) === 1,
      status: n(c.cita_status),
      mdv: String(c.cita_mdv ?? ''),
    }
  })
}

export async function inboxSuspensiones() {
  const ciclo = await cicloRac()
  const { data, error } = await db()
    .from('reporte_suspension')
    .select('*')
    .eq('suspension_ciclo_escolar', ciclo)
    .order('suspension_id', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const alumnoIds = [...new Set(rows.map((r) => n(r.alumno_id)))]
  const reporteIds = [...new Set(rows.map((r) => n(r.reporte_id)))]
  const { data: alumnos } = await db()
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo')
    .in('alumno_id', alumnoIds.length ? alumnoIds : [0])
  const { data: reps } = await db()
    .from('reporte_escolar')
    .select('reporte_id, reporte_tipo')
    .in('reporte_id', reporteIds.length ? reporteIds : [0])
  const aMap = new Map((alumnos ?? []).map((a) => [n(a.alumno_id), a]))
  const rMap = new Map((reps ?? []).map((r) => [n(r.reporte_id), r]))
  return rows.map((s) => {
    const a = aMap.get(n(s.alumno_id))
    const r = rMap.get(n(s.reporte_id))
    return {
      suspension_id: n(s.suspension_id),
      alumno_ref: a?.alumno_ref ?? null,
      nombre: a ? nombreAlumno(a as AlumnoRow) : '',
      grado: n(a?.alumno_grado),
      grupo: letraDesdeGrupoNum(n(a?.alumno_grupo)),
      tipoEtiqueta: etiquetaTipoCitatorio(n(r?.reporte_tipo ?? 0)),
      fecha: s.suspension_fecha ? String(s.suspension_fecha).slice(0, 10) : '',
      enviada: n(s.suspension_enviada) === 1,
    }
  })
}

export async function accionReporte(
  id: number,
  accion: 'reenviar' | 'detener' | 'confirmar' | 'denegar' | 'validar'
) {
  const client = db()
  if (accion === 'reenviar') return enviarCorreoReporte(id)
  if (accion === 'confirmar') {
    const { error } = await client.from('reporte_escolar').update({ reporte_confirmado: 1 }).eq('reporte_id', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  }
  if (accion === 'denegar') {
    const { error } = await client.from('reporte_escolar').update({ reporte_status: 0 }).eq('reporte_id', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  }
  if (accion === 'detener') {
    const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_id', id).maybeSingle()
    if (!r) throw new Error('Reporte no encontrado')
    await client.from('reporte_escolar').update({ reporte_status: 3 }).eq('reporte_id', id)
    const { data: later } = await client
      .from('reporte_escolar')
      .select('reporte_id, reporte_no')
      .eq('alumno_id', r.alumno_id)
      .eq('reporte_tipo', r.reporte_tipo)
      .eq('reporte_ciclo', r.reporte_ciclo)
      .gt('reporte_no', r.reporte_no)
    for (const row of later ?? []) {
      await client.from('reporte_escolar').update({ reporte_no: n(row.reporte_no) - 1 }).eq('reporte_id', row.reporte_id)
    }
    return { ok: true }
  }
  const ciclo = await cicloRac()
  const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_id', id).maybeSingle()
  if (!r) throw new Error('Reporte no encontrado')
  const { data: prev } = await client
    .from('reporte_escolar')
    .select('reporte_no, reporte_ciclo')
    .eq('alumno_id', r.alumno_id)
    .eq('reporte_tipo', 2)
    .eq('reporte_status', 1)
    .eq('reporte_ciclo_escolar', ciclo)
  let reporteCiclo = 0
  let reporteNo = 0
  let pivot = 0
  if (prev?.length) {
    pivot = 1
    reporteCiclo = prev.reduce((acc, x) => Math.max(acc, n(x.reporte_ciclo)), 0)
    reporteNo = prev
      .filter((x) => n(x.reporte_ciclo) === reporteCiclo)
      .reduce((acc, x) => Math.max(acc, n(x.reporte_no)), 0)
  }
  if (reporteNo === 3) {
    await client
      .from('reporte_escolar')
      .update({ reporte_status: 1, reporte_no: 0, reporte_ciclo: reporteCiclo + 1 })
      .eq('reporte_id', id)
  } else {
    await client
      .from('reporte_escolar')
      .update({ reporte_status: 1, reporte_no: reporteNo + pivot, reporte_ciclo: reporteCiclo })
      .eq('reporte_id', id)
  }
  return enviarCorreoReporte(id)
}

export async function accionCita(
  id: number,
  accion: 'reenviar' | 'confirmar' | 'detener' | 'validar',
  opts?: { fecha?: string; hora?: string; mensaje?: string }
) {
  const client = db()
  if (accion === 'reenviar') return enviarCorreoCita(id)
  if (accion === 'confirmar') {
    const { error } = await client.from('reporte_cita').update({ cita_confirmada: 1 }).eq('cita_id', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  }
  if (accion === 'detener') {
    const { error } = await client.from('reporte_cita').update({ cita_status: 0 }).eq('cita_id', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  }
  const update: Record<string, unknown> = { cita_status: 1 }
  if (opts?.fecha && opts?.hora) update.cita_fecha = `${opts.fecha}T${opts.hora}:00`
  if (opts?.mensaje !== undefined) update.cita_mensaje = opts.mensaje
  const { error } = await client.from('reporte_cita').update(update).eq('cita_id', id)
  if (error) throw new Error(error.message)
  return enviarCorreoCita(id)
}

export async function aplicarSuspension(id: number, fecha: string) {
  const { error } = await db().from('reporte_suspension').update({ suspension_fecha: fecha }).eq('suspension_id', id)
  if (error) throw new Error(error.message)
  return enviarCorreoSuspension(id)
}

export async function historialAlumno(query: string) {
  const ciclo = await cicloRac()
  const q = query.trim()
  if (q.length < 2) return { alumnos: [], reportes: [] }
  const safe = q.replace(/[%_,]/g, '')
  const { data: alumnos } = await db()
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel')
    .eq('alumno_nivel', RAC_NIVEL_SECUNDARIA)
    .or(`alumno_ref.ilike.%${safe}%,alumno_app.ilike.%${safe}%,alumno_apm.ilike.%${safe}%,alumno_nombre.ilike.%${safe}%`)
    .limit(20)
  const ids = (alumnos ?? []).map((a) => n(a.alumno_id))
  if (!ids.length) return { alumnos: alumnos ?? [], reportes: [] }
  const { data: reps } = await db()
    .from('reporte_escolar')
    .select('*')
    .in('alumno_id', ids)
    .eq('reporte_ciclo_escolar', ciclo)
    .order('reporte_registro', { ascending: false })
    .limit(200)
  return { alumnos: alumnos ?? [], reportes: await hidratar((reps ?? []) as Record<string, unknown>[]) }
}

const PERFIL_ETIQUETA: Record<number, string> = {
  1: 'MAESTRO',
  2: 'COORDINACIÓN',
  4: 'PSICOLOGÍA',
  5: 'PREFECTURA',
  6: 'DIRECCIÓN',
}

async function filasPdfDesdeQuery(rows: Record<string, unknown>[]): Promise<FilaPdfReporte[]> {
  if (!rows.length) return []
  const hidratados = await hidratar(rows)
  return hidratados.map((r, i) => {
    const raw = rows[i]
    return filaPdfDesdeReporte({
      reporte_id: r.reporte_id,
      nombre: r.nombre,
      materia: r.materia,
      departamento: PERFIL_ETIQUETA[n(raw?.perfil_id)] ?? '',
      tipo: r.tipo,
      no: r.no,
      motivo: r.motivo,
      fecha: r.fecha,
      enviado: r.enviado,
      confirmado: r.confirmado,
      vuelta: n(raw?.reporte_ciclo),
    })
  })
}

export async function datosPdfPendientes() {
  const ciclo = await cicloRac()
  const client = db()
  const base = client
    .from('reporte_escolar')
    .select('*')
    .eq('reporte_ciclo_escolar', ciclo)
    .eq('reporte_confirmado', 0)
    .eq('reporte_status', 1)
  const { data: reportes } = await base
    .neq('reporte_tipo', RAC_TIPOS.informeAcademico)
    .lt('reporte_tipo', RAC_TIPOS.seguimiento)
    .order('reporte_registro', { ascending: true })
  const { data: informes } = await client
    .from('reporte_escolar')
    .select('*')
    .eq('reporte_ciclo_escolar', ciclo)
    .eq('reporte_confirmado', 0)
    .eq('reporte_status', 1)
    .eq('reporte_tipo', RAC_TIPOS.informeAcademico)
    .order('reporte_registro', { ascending: true })
  return {
    ciclo,
    reportes: await filasPdfDesdeQuery((reportes ?? []) as Record<string, unknown>[]),
    informes: await filasPdfDesdeQuery((informes ?? []) as Record<string, unknown>[]),
  }
}

export async function datosPdfHistorial(alumnoId: number, reporteTipo: number, materiaId?: number) {
  const ciclo = await cicloRac()
  const alumno = await cargarAlumno(alumnoId)
  let q = db()
    .from('reporte_escolar')
    .select('*')
    .eq('alumno_id', alumnoId)
    .eq('reporte_tipo', reporteTipo)
    .eq('reporte_ciclo_escolar', ciclo)
    .eq('reporte_status', 1)
  if (reporteTipo === RAC_TIPOS.academico && materiaId) q = q.eq('materia_id', materiaId)
  const { data, error } = await q.order('reporte_ciclo').order('reporte_no')
  if (error) throw new Error(error.message)
  return {
    ciclo,
    alumnoNombre: nombreAlumno(alumno),
    filas: await filasPdfDesdeQuery((data ?? []) as Record<string, unknown>[]),
  }
}

export async function detallePublico(token: string, alt: number) {
  const client = db()
  if (alt === 2) {
    const { data: c } = await client.from('reporte_cita').select('*').eq('cita_mdv', token).maybeSingle()
    if (!c) return null
    const alumno = await cargarAlumno(n(c.alumno_id))
    return {
      kind: 'cita' as const,
      id: n(c.cita_id),
      titulo: `Citatorio ${etiquetaTipoCitatorio(n(c.cita_tipo))}`,
      alumno: nombreAlumno(alumno),
      ref: alumno.alumno_ref,
      mensaje: String(c.cita_mensaje ?? ''),
      fecha: c.cita_fecha ? String(c.cita_fecha).replace('T', ' ').slice(0, 16) : '',
      confirmado: n(c.cita_confirmada) === 1,
    }
  }
  const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_mdv', token).maybeSingle()
  if (!r) return null
  const alumno = await cargarAlumno(n(r.alumno_id))
  const tipo = n(r.reporte_tipo)
  return {
    kind: alt === 5 ? ('suspension' as const) : ('reporte' as const),
    id: n(r.reporte_id),
    titulo: asuntoReporte(tipo, n(r.reporte_no)),
    alumno: nombreAlumno(alumno),
    ref: alumno.alumno_ref,
    grado: n(alumno.alumno_grado),
    grupo: letraDesdeGrupoNum(n(alumno.alumno_grupo)),
    motivo: motivoReporte(tipo, n(r.reporte_motivo)),
    mensaje: String(r.reporte_mensaje ?? ''),
    fecha: String(r.reporte_registro ?? '').slice(0, 10),
    confirmado: n(r.reporte_confirmado) === 1,
    status: n(r.reporte_status),
  }
}

export async function confirmarPublico(token: string, alt: number) {
  if (alt === 2) {
    const { error } = await db().from('reporte_cita').update({ cita_confirmada: 1 }).eq('cita_mdv', token)
    if (error) throw new Error(error.message)
    return { ok: true }
  }
  const { error } = await db().from('reporte_escolar').update({ reporte_confirmado: 1 }).eq('reporte_mdv', token)
  if (error) throw new Error(error.message)
  return { ok: true }
}
