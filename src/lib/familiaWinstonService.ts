/**
 * 2026-10-05 — Familia Winston: validación del comprobante (QR de AgendaW) y condonación
 * automática de la próxima colegiatura pendiente del alumno que recomendó.
 *
 * Reglas (acordadas con administración):
 * - El comprobante (wsp: ctrl + qr) existe y no se ha usado.
 * - El alumno recomendado está inscrito/activo, ya pagó su primera colegiatura del ciclo
 *   y lleva al menos 30 días de clases (desde el inicio de clases del ciclo o su alta, lo más tarde).
 * - Un alumno recomendado solo genera un beneficio.
 * - Beneficio: la próxima colegiatura pendiente del alumno ctrl queda en $0 (forma «Beca 100%»).
 * - Al aplicar se manda el correo «FAMILIA WINSTON» a mamá y papá (los que aceptan correos).
 */
import type { AppDatabaseClient } from './dbTypes'
import { createDbAdmin } from './insforgeAdmin'
import { brandingCorreoPorNivel, enviarCorreoMasivo, htmlCuerpoCorreoMasivo } from './emailServicios'
import {
  generarReferenciaPagoDesdePago,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from './pagoReferenciaColegiatura'
import { slotsColegiaturaPortal } from './portalPagosCandados'

export const DIAS_CLASES_REQUERIDOS = 30
export const NOMBRE_PAGO_FAMILIA_WINSTON = 'Condonación FAMILIA WINSTON (importe 0)'
const FORMA_PAGO_FAMILIA_WINSTON = 'Beca 100%'
const ASUNTO_CORREO = 'FAMILIA WINSTON'

const MES_POR_CONCEPTO: Record<string, string> = {
  '01': 'Septiembre',
  '02': 'Octubre',
  '03': 'Noviembre',
  '04': 'Diciembre',
  '05': 'Enero',
  '06': 'Febrero',
  '07': 'Marzo',
  '08': 'Abril',
  '09': 'Mayo',
  '10': 'Junio',
  '26': 'Julio',
}
const CONCEPTOS_COLEGIATURA = new Set(Object.keys(MES_POR_CONCEPTO))

export type NivelCheck = 'ok' | 'error' | 'aviso'
export interface CheckFamiliaWinston {
  id: string
  nivel: NivelCheck
  texto: string
}

export interface AlumnoFamiliaWinston {
  alumno_id: number
  alumno_ref: number
  nombre: string
  nivel: number
  grado: number | null
  status: number | null
  ciclo: number
  planMeses: 1 | 2
  alta: string | null
  sexo: 'H' | 'M' | null
}

export interface ComprobanteFamiliaWinston {
  id: number
  folio: string
  ctrl: number
  qr: number
  status: string
  referidoRef: number | null
  validadoEn: string | null
  validadoPor: string | null
  conceptoCondonado: string | null
  cicloCondonado: number | null
  pagoReferencia: string | null
  correoEnviadoEn: string | null
  correoResultado: string | null
}

export interface MesPropuesto {
  conceptoNo: string
  mes: string
  ciclo: number
  cicloEtiqueta: string
}

export interface DestinatarioFamiliaWinston {
  nombre: string
  email: string
  tutorId: number
}

export interface RevisionFamiliaWinston {
  puedeAplicar: boolean
  checks: CheckFamiliaWinston[]
  comprobante: ComprobanteFamiliaWinston | null
  beneficiado: AlumnoFamiliaWinston | null
  referido: AlumnoFamiliaWinston | null
  mesPropuesto: MesPropuesto | null
  destinatarios: DestinatarioFamiliaWinston[]
  diasClases: number | null
  fechaDisponible: string | null
}

type FilaWsp = {
  id: number
  ctrl: number
  qr: number
  status: string | null
  referido_alumno_ref: number | null
  validado_en: string | null
  validado_por: string | null
  concepto_condonado: string | null
  ciclo_condonado: number | null
  pago_referencia: string | null
  correo_enviado_en: string | null
  correo_resultado: string | null
}

type FilaPago = {
  pago_referencia: string | null
  pago_cancelado: number | null
  pago_importe: number | string | null
}

export function folioWsp(id: number): string {
  return `WSP-${String(id).padStart(5, '0')}`
}

function mapComprobante(f: FilaWsp): ComprobanteFamiliaWinston {
  return {
    id: Number(f.id),
    folio: folioWsp(Number(f.id)),
    ctrl: Number(f.ctrl),
    qr: Number(f.qr),
    status: String(f.status ?? 'pendiente'),
    referidoRef: f.referido_alumno_ref != null ? Number(f.referido_alumno_ref) : null,
    validadoEn: f.validado_en,
    validadoPor: f.validado_por,
    conceptoCondonado: f.concepto_condonado,
    cicloCondonado: f.ciclo_condonado != null ? Number(f.ciclo_condonado) : null,
    pagoReferencia: f.pago_referencia,
    correoEnviadoEn: f.correo_enviado_en,
    correoResultado: f.correo_resultado,
  }
}

const SELECT_WSP =
  'id, ctrl, qr, status, referido_alumno_ref, validado_en, validado_por, concepto_condonado, ciclo_condonado, pago_referencia, correo_enviado_en, correo_resultado'

/** Fecha de hoy en Cd. Madero (YYYY-MM-DD). */
function hoyMx(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function horaMx(): string {
  return new Date().toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function diasEntre(desdeIso: string, hastaIso: string): number {
  const a = Date.UTC(+desdeIso.slice(0, 4), +desdeIso.slice(5, 7) - 1, +desdeIso.slice(8, 10))
  const b = Date.UTC(+hastaIso.slice(0, 4), +hastaIso.slice(5, 7) - 1, +hastaIso.slice(8, 10))
  return Math.floor((b - a) / 86_400_000)
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)))
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function nombreTitulo(raw: string): string {
  const minusculas = new Set(['de', 'del', 'la', 'las', 'los', 'y'])
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

async function cargarAlumno(
  db: AppDatabaseClient,
  ref: number
): Promise<AlumnoFamiliaWinston | null> {
  const { data, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_status, alumno_ciclo_escolar, alumno_alta, mes'
    )
    .eq('alumno_ref', ref)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const a = data as Record<string, unknown>
  const alumnoId = Number(a.alumno_id)
  const { data: det } = await db
    .from('alumno_detalles')
    .select('alumno_sexo')
    .eq('alumno_id', alumnoId)
    .maybeSingle()
  const sexoRaw = String((det as { alumno_sexo?: string } | null)?.alumno_sexo ?? '')
    .trim()
    .toUpperCase()
  return {
    alumno_id: alumnoId,
    alumno_ref: Number(a.alumno_ref),
    nombre: [a.alumno_nombre, a.alumno_app, a.alumno_apm]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' '),
    nivel: Number(a.alumno_nivel) || 0,
    grado: a.alumno_grado != null ? Number(a.alumno_grado) : null,
    status: a.alumno_status != null ? Number(a.alumno_status) : null,
    ciclo: Number(a.alumno_ciclo_escolar) || 0,
    planMeses: Number(a.mes) === 2 ? 2 : 1,
    alta: a.alumno_alta ? String(a.alumno_alta).slice(0, 10) : null,
    sexo: sexoRaw === 'H' || sexoRaw === 'M' ? sexoRaw : null,
  }
}

async function cargarPagos(db: AppDatabaseClient, alumnoId: number): Promise<FilaPago[]> {
  const { data, error } = await db
    .from('pago_detalle')
    .select('pago_referencia, pago_cancelado, pago_importe')
    .eq('alumno_id', alumnoId)
  if (error) throw new Error(error.message)
  return (data ?? []) as FilaPago[]
}

function pagoVigente(p: FilaPago): boolean {
  const c = Number(p.pago_cancelado)
  return c !== 1 && c !== 2
}

async function cargarCiclo(
  db: AppDatabaseClient,
  valor: number
): Promise<{ nombre: string; inicioClases: string | null }> {
  const { data } = await db
    .from('ciclos_escolares')
    .select('nombre, inicio_clases')
    .eq('valor', valor)
    .maybeSingle()
  const row = data as { nombre?: string; inicio_clases?: string | null } | null
  return {
    nombre: row?.nombre?.trim() || `${valor + 2003}-${valor + 2004}`,
    inicioClases: row?.inicio_clases ? String(row.inicio_clases).slice(0, 10) : null,
  }
}

async function cargarDestinatarios(
  db: AppDatabaseClient,
  alumnoId: number
): Promise<DestinatarioFamiliaWinston[]> {
  const { data, error } = await db
    .from('alumno_familiar')
    .select('tutor_id, familiar_nombre, familiar_app, familiar_apm, familiar_email, familiar_recibir_email')
    .eq('alumno_id', alumnoId)
    .eq('familiar_recibir_email', 1)
    .order('tutor_id', { ascending: true })
  if (error) throw new Error(error.message)
  const vistos = new Set<string>()
  const out: DestinatarioFamiliaWinston[] = []
  for (const f of (data ?? []) as Record<string, unknown>[]) {
    const email = String(f.familiar_email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || vistos.has(email)) continue
    vistos.add(email)
    out.push({
      email,
      tutorId: Number(f.tutor_id) || 0,
      nombre: nombreTitulo(
        [f.familiar_nombre, f.familiar_app, f.familiar_apm].map((x) => String(x ?? '')).join(' ')
      ),
    })
  }
  return out
}

/** Primera colegiatura del plan (01…10, 26 si 11 meses) sin pago vigente en el ciclo. */
function proximaColegiaturaPendiente(
  pagos: FilaPago[],
  ciclo: number,
  planMeses: 1 | 2
): string | null {
  const cubiertos = new Set<string>()
  for (const p of pagos) {
    if (!pagoVigente(p)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (parsed && parsed.cicloEscolar === ciclo) cubiertos.add(normalizarConceptoNo(parsed.conceptoNo))
  }
  for (const slot of slotsColegiaturaPortal(planMeses)) {
    for (const raw of slot) {
      const c = normalizarConceptoNo(raw)
      if (!CONCEPTOS_COLEGIATURA.has(c)) continue
      if (!cubiertos.has(c)) return c
    }
  }
  return null
}

function primeraColegiaturaPagada(pagos: FilaPago[], ciclo: number): boolean {
  return pagos.some((p) => {
    if (!pagoVigente(p) || !(Number(p.pago_importe) > 0)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    return (
      !!parsed &&
      parsed.cicloEscolar === ciclo &&
      CONCEPTOS_COLEGIATURA.has(normalizarConceptoNo(parsed.conceptoNo))
    )
  })
}

export interface AlumnoQrFamiliaWinston {
  alumno_id: number
  alumno_ref: string
  alumno_nombre: string
  alumno_app: string
  alumno_apm: string
  alumno_nivel: number
  alumno_grado: string | null
  alumno_grupo: string | null
  alumno_ciclo_escolar: number | null
  alumno_status: number | null
}

/**
 * 2026-10-05 — Al escanear el QR: comprobantes con ese código y el alumno que recomendó,
 * para llenar en automático «quién recomendó» en el módulo.
 */
export async function buscarComprobantesPorQr(qr: number): Promise<
  { comprobante: ComprobanteFamiliaWinston; alumno: AlumnoQrFamiliaWinston | null }[]
> {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('wsp')
    .select(SELECT_WSP)
    .eq('qr', qr)
    .order('id', { ascending: true })
    .limit(5)
  if (error) throw new Error(error.message)
  const filas = (data ?? []) as FilaWsp[]
  const out: { comprobante: ComprobanteFamiliaWinston; alumno: AlumnoQrFamiliaWinston | null }[] = []
  for (const f of filas) {
    const { data: a } = await db
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_ciclo_escolar, alumno_status'
      )
      .eq('alumno_ref', Number(f.ctrl))
      .order('alumno_ciclo_escolar', { ascending: false })
      .limit(1)
      .maybeSingle()
    const r = a as Record<string, unknown> | null
    out.push({
      comprobante: mapComprobante(f),
      alumno: r
        ? {
            alumno_id: Number(r.alumno_id),
            alumno_ref: String(r.alumno_ref),
            alumno_nombre: String(r.alumno_nombre ?? '').trim(),
            alumno_app: String(r.alumno_app ?? '').trim(),
            alumno_apm: String(r.alumno_apm ?? '').trim(),
            alumno_nivel: Number(r.alumno_nivel) || 0,
            alumno_grado: r.alumno_grado != null ? String(r.alumno_grado) : null,
            alumno_grupo: r.alumno_grupo != null ? String(r.alumno_grupo) : null,
            alumno_ciclo_escolar: r.alumno_ciclo_escolar != null ? Number(r.alumno_ciclo_escolar) : null,
            alumno_status: r.alumno_status != null ? Number(r.alumno_status) : null,
          }
        : null,
    })
  }
  return out
}

export async function revisarFamiliaWinston(opts: {
  ctrl: number
  qr: number
  referidoRef: number | null
  db?: AppDatabaseClient
}): Promise<RevisionFamiliaWinston> {
  const db = opts.db ?? createDbAdmin()
  const checks: CheckFamiliaWinston[] = []
  const res: RevisionFamiliaWinston = {
    puedeAplicar: false,
    checks,
    comprobante: null,
    beneficiado: null,
    referido: null,
    mesPropuesto: null,
    destinatarios: [],
    diasClases: null,
    fechaDisponible: null,
  }

  const { data: wspRows, error: wspError } = await db
    .from('wsp')
    .select(SELECT_WSP)
    .eq('ctrl', opts.ctrl)
    .eq('qr', opts.qr)
    .order('id', { ascending: true })
    .limit(1)
  if (wspError) throw new Error(wspError.message)
  const fila = ((wspRows ?? []) as FilaWsp[])[0]
  if (!fila) {
    checks.push({
      id: 'comprobante',
      nivel: 'error',
      texto: 'No existe un comprobante con ese código y esa matrícula. Revisa que el QR sea de AgendaW y la matrícula del alumno que recomienda.',
    })
    return res
  }
  res.comprobante = mapComprobante(fila)
  if (res.comprobante.status === 'autorizado') {
    checks.push({
      id: 'comprobante',
      nivel: 'error',
      texto: `El comprobante ${res.comprobante.folio} ya se usó${
        res.comprobante.validadoEn ? ` el ${fechaCorta(res.comprobante.validadoEn)}` : ''
      }${res.comprobante.validadoPor ? ` (validó ${res.comprobante.validadoPor})` : ''}.`,
    })
    return res
  }
  if (res.comprobante.status === 'aplicando') {
    checks.push({
      id: 'comprobante',
      nivel: 'error',
      texto: 'Este comprobante se está aplicando en este momento. Espera unos segundos y vuelve a revisar.',
    })
    return res
  }
  checks.push({ id: 'comprobante', nivel: 'ok', texto: `Comprobante ${res.comprobante.folio} auténtico y sin usar.` })

  const beneficiado = await cargarAlumno(db, opts.ctrl)
  res.beneficiado = beneficiado
  if (!beneficiado) {
    checks.push({ id: 'beneficiado', nivel: 'error', texto: `No existe el alumno ${opts.ctrl}.` })
  } else if (beneficiado.status !== 1) {
    checks.push({
      id: 'beneficiado',
      nivel: 'error',
      texto: `${beneficiado.nombre} (${beneficiado.alumno_ref}) no está activo.`,
    })
  } else {
    checks.push({
      id: 'beneficiado',
      nivel: 'ok',
      texto: `Recibe el beneficio: ${beneficiado.nombre} (${beneficiado.alumno_ref}), activo.`,
    })
  }

  if (!opts.referidoRef) {
    checks.push({
      id: 'referido',
      nivel: 'error',
      texto: 'Falta la matrícula del alumno que se inscribió por la recomendación.',
    })
  } else if (opts.referidoRef === opts.ctrl) {
    checks.push({
      id: 'referido',
      nivel: 'error',
      texto: 'El alumno recomendado no puede ser el mismo que recibe el beneficio.',
    })
  } else {
    const referido = await cargarAlumno(db, opts.referidoRef)
    res.referido = referido
    if (!referido) {
      checks.push({ id: 'referido', nivel: 'error', texto: `No existe el alumno ${opts.referidoRef}.` })
    } else if (referido.status !== 1) {
      checks.push({
        id: 'referido',
        nivel: 'error',
        texto: `${referido.nombre} (${referido.alumno_ref}) no está inscrito/activo.`,
      })
    } else {
      checks.push({
        id: 'referido',
        nivel: 'ok',
        texto: `Alumno recomendado: ${referido.nombre} (${referido.alumno_ref}), inscrito.`,
      })

      const { data: usados, error: usadosError } = await db
        .from('wsp')
        .select('id')
        .eq('referido_alumno_ref', referido.alumno_ref)
        .in('status', ['aplicando', 'autorizado'])
        .neq('id', res.comprobante.id)
        .limit(1)
      if (usadosError) throw new Error(usadosError.message)
      const usado = ((usados ?? []) as { id: number }[])[0]
      if (usado) {
        checks.push({
          id: 'referido-unico',
          nivel: 'error',
          texto: `${referido.nombre} ya generó un beneficio con el comprobante ${folioWsp(Number(usado.id))}.`,
        })
      }

      const pagosReferido = await cargarPagos(db, referido.alumno_id)
      if (primeraColegiaturaPagada(pagosReferido, referido.ciclo)) {
        checks.push({ id: 'pago-referido', nivel: 'ok', texto: 'Ya pagó su primera colegiatura del ciclo.' })
      } else {
        checks.push({
          id: 'pago-referido',
          nivel: 'error',
          texto: 'Todavía no ha pagado ninguna colegiatura del ciclo.',
        })
      }

      const ciclo = await cargarCiclo(db, referido.ciclo)
      if (!ciclo.inicioClases) {
        checks.push({
          id: 'dias-clases',
          nivel: 'error',
          texto: `Falta capturar el inicio de clases del ciclo ${ciclo.nombre} (abajo, en «Inicio de clases»).`,
        })
      } else {
        const inicio =
          referido.alta && referido.alta > ciclo.inicioClases ? referido.alta : ciclo.inicioClases
        const dias = diasEntre(inicio, hoyMx())
        res.diasClases = Math.max(0, dias)
        res.fechaDisponible = sumarDias(inicio, DIAS_CLASES_REQUERIDOS)
        if (dias >= DIAS_CLASES_REQUERIDOS) {
          checks.push({
            id: 'dias-clases',
            nivel: 'ok',
            texto: `Lleva ${dias} días de clases (desde el ${fechaCorta(inicio)}).`,
          })
        } else {
          checks.push({
            id: 'dias-clases',
            nivel: 'error',
            texto: `Lleva ${Math.max(0, dias)} días de clases (desde el ${fechaCorta(inicio)}); necesita ${DIAS_CLASES_REQUERIDOS}. Se podrá validar a partir del ${fechaCorta(res.fechaDisponible)}.`,
          })
        }
      }
    }
  }

  if (beneficiado && beneficiado.status === 1) {
    const pagos = await cargarPagos(db, beneficiado.alumno_id)
    const concepto = proximaColegiaturaPendiente(pagos, beneficiado.ciclo, beneficiado.planMeses)
    if (!concepto) {
      checks.push({
        id: 'mes',
        nivel: 'error',
        texto: `${beneficiado.nombre} no tiene colegiaturas pendientes en su ciclo; el beneficio se tiene que aplicar a mano.`,
      })
    } else {
      const ciclo = await cargarCiclo(db, beneficiado.ciclo)
      res.mesPropuesto = {
        conceptoNo: concepto,
        mes: MES_POR_CONCEPTO[concepto],
        ciclo: beneficiado.ciclo,
        cicloEtiqueta: ciclo.nombre,
      }
      checks.push({
        id: 'mes',
        nivel: 'ok',
        texto: `Se condona la colegiatura de ${res.mesPropuesto.mes.toUpperCase()} ${ciclo.nombre} (próxima pendiente).`,
      })
    }

    const { data: condonaciones } = await db
      .from('pago_detalle')
      .select('pago_id')
      .eq('alumno_id', beneficiado.alumno_id)
      .eq('pago_nombre', NOMBRE_PAGO_FAMILIA_WINSTON)
      .in('pago_cancelado', [0, 3])
    const nPrevias = (condonaciones ?? []).length
    if (nPrevias > 0) {
      checks.push({
        id: 'previas',
        nivel: 'aviso',
        texto: `Ojo: ${beneficiado.nombre} ya tiene ${nPrevias} condonación(es) Familia Winston registrada(s). Si recomendó a otro alumno, está bien.`,
      })
    }

    res.destinatarios = await cargarDestinatarios(db, beneficiado.alumno_id)
    if (res.destinatarios.length === 0) {
      checks.push({
        id: 'correo',
        nivel: 'aviso',
        texto: 'No hay correo de mamá o papá autorizado: se aplica el beneficio pero no se manda aviso.',
      })
    }
  }

  res.puedeAplicar = !checks.some((c) => c.nivel === 'error')
  return res
}

/** Texto del correo, igual al comunicado oficial, con saludo personalizado. */
export function textoCorreoFamiliaWinston(opts: {
  beneficiado: AlumnoFamiliaWinston
  destinatarios: DestinatarioFamiliaWinston[]
  mes: MesPropuesto
}): string {
  const madre = opts.destinatarios.find((d) => d.tutorId === 1)
  const padre = opts.destinatarios.find((d) => d.tutorId === 2)
  const nombres = [
    madre ? `Sra. ${madre.nombre}` : null,
    padre ? `Sr. ${padre.nombre}` : null,
  ].filter(Boolean)
  if (nombres.length === 0) {
    for (const d of opts.destinatarios) nombres.push(d.nombre)
  }
  const saludo =
    nombres.length > 0
      ? `Estimados ${nombres.slice(0, -1).join(', ')}${nombres.length > 1 ? ' y ' : ''}${nombres[nombres.length - 1]}:`
      : 'Estimados padres de familia:'
  const articulo =
    opts.beneficiado.sexo === 'M'
      ? 'la alumna'
      : opts.beneficiado.sexo === 'H'
        ? 'el alumno'
        : 'el(la) alumno(a)'
  const institucion = brandingCorreoPorNivel(opts.beneficiado.nivel).nombreInstitucion
  return [
    saludo,
    '',
    'Buen día. Nos es grato informarles acerca de nuestra iniciativa "FAMILIA WINSTON", con la cual el Instituto busca reconocer y valorar la fidelidad e iniciativa de nuestras Familias Winston.',
    '',
    `Es por ello que, en reconocimiento por su participación, el ${institucion} les otorga como beneficio la condonación de un pago mensual para ${articulo} ${opts.beneficiado.nombre.toUpperCase()}, correspondiente al mes de ${opts.mes.mes.toUpperCase()} del ciclo escolar ${opts.mes.cicloEtiqueta}.`,
    '',
    'Agradecemos mucho su participación y les deseamos mucho éxito en su trayecto escolar en nuestra institución.',
  ].join('\n')
}

export type ResultadoAplicarFamiliaWinston =
  | {
      ok: true
      folio: string
      mes: MesPropuesto
      pagoReferencia: string
      correo: { enviado: boolean; destinatarios: string[]; detalle: string }
    }
  | { ok: false; mensaje: string; revision?: RevisionFamiliaWinston }

async function siguientePagoId(db: AppDatabaseClient): Promise<number> {
  const { data } = await db
    .from('pago_detalle')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (Number((data as { pago_id?: number } | null)?.pago_id) || 0) + 1
}

function esClaveDuplicada(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '23505' || (error.message ?? '').includes('duplicate key'))
}

export async function aplicarFamiliaWinston(opts: {
  ctrl: number
  qr: number
  referidoRef: number
  validadoPor: string
}): Promise<ResultadoAplicarFamiliaWinston> {
  const db = createDbAdmin()
  const revision = await revisarFamiliaWinston({ ...opts, db })
  if (!revision.puedeAplicar || !revision.comprobante || !revision.beneficiado || !revision.mesPropuesto) {
    return { ok: false, mensaje: 'El comprobante no cumple las reglas; revisa los puntos en rojo.', revision }
  }
  const { comprobante, beneficiado, mesPropuesto } = revision

  // Apartar el comprobante: solo uno gana si dos personas validan al mismo tiempo.
  const apartado = await db
    .from('wsp')
    .update({
      status: 'aplicando',
      referido_alumno_ref: opts.referidoRef,
      validado_por: opts.validadoPor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', comprobante.id)
    .eq('status', 'pendiente')
    .select('id')
  if (apartado.error) {
    if (esClaveDuplicada(apartado.error)) {
      return { ok: false, mensaje: 'Ese alumno recomendado ya generó un beneficio con otro comprobante.' }
    }
    return { ok: false, mensaje: apartado.error.message }
  }
  if (((apartado.data ?? []) as unknown[]).length === 0) {
    return { ok: false, mensaje: 'Otro usuario acaba de validar este comprobante. Vuelve a revisar.' }
  }

  const liberar = async () => {
    await db
      .from('wsp')
      .update({ status: 'pendiente', referido_alumno_ref: null, validado_por: null, updated_at: new Date().toISOString() })
      .eq('id', comprobante.id)
      .eq('status', 'aplicando')
  }

  const referencia = generarReferenciaPagoDesdePago(
    beneficiado.alumno_ref,
    mesPropuesto.conceptoNo,
    mesPropuesto.ciclo
  )
  const ahora = new Date().toISOString()
  const fila = {
    pago_id: await siguientePagoId(db),
    alumno_id: beneficiado.alumno_id,
    pago_nombre: NOMBRE_PAGO_FAMILIA_WINSTON,
    pago_referencia: referencia,
    pago_importe: 0,
    pago_recargo: 0,
    pago_forma: FORMA_PAGO_FAMILIA_WINSTON,
    pago_folio: null,
    pago_fecha: hoyMx(),
    pago_hora: horaMx(),
    pago_emisora: 'S/E',
    pago_cancelado: 3,
    pago_registro: ahora,
    pago_actualizacion: ahora,
    facturo: '',
    fact: '',
  }
  let insert = await db.from('pago_detalle').insert(fila).select('pago_id')
  if (esClaveDuplicada(insert.error)) {
    insert = await db
      .from('pago_detalle')
      .insert({ ...fila, pago_id: await siguientePagoId(db) })
      .select('pago_id')
  }
  if (insert.error) {
    await liberar()
    return { ok: false, mensaje: `No se pudo registrar la condonación: ${insert.error.message}` }
  }
  const pagoId = Number(((insert.data ?? []) as { pago_id: number }[])[0]?.pago_id) || fila.pago_id

  const fin = await db
    .from('wsp')
    .update({
      status: 'autorizado',
      estatus: 'APLICADO',
      validado_en: new Date().toISOString(),
      pago_id: pagoId,
      pago_referencia: referencia,
      concepto_condonado: mesPropuesto.conceptoNo,
      ciclo_condonado: mesPropuesto.ciclo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', comprobante.id)
  if (fin.error) console.error('familia-winston: no se pudo cerrar wsp', comprobante.id, fin.error.message)

  let correo = { enviado: false, destinatarios: [] as string[], detalle: 'Sin correo autorizado de mamá o papá.' }
  if (revision.destinatarios.length > 0) {
    const emails = revision.destinatarios.map((d) => d.email)
    try {
      const envio = await enviarCorreoMasivo({
        to: emails,
        subject: ASUNTO_CORREO,
        html: htmlCuerpoCorreoMasivo(
          textoCorreoFamiliaWinston({ beneficiado, destinatarios: revision.destinatarios, mes: mesPropuesto }),
          beneficiado.nivel
        ),
        nivel: beneficiado.nivel,
      })
      correo = {
        enviado: envio.ok,
        destinatarios: emails,
        detalle: envio.ok ? 'Enviado' : envio.error ?? 'No se pudo enviar',
      }
    } catch (e) {
      correo = { enviado: false, destinatarios: emails, detalle: e instanceof Error ? e.message : 'Error al enviar' }
    }
    await db
      .from('wsp')
      .update({
        correo_enviado_en: correo.enviado ? new Date().toISOString() : null,
        correo_resultado: `${correo.detalle} · ${emails.join(', ')}`.slice(0, 500),
      })
      .eq('id', comprobante.id)
  }

  return { ok: true, folio: comprobante.folio, mes: mesPropuesto, pagoReferencia: referencia, correo }
}

export interface FilaHistorialFamiliaWinston extends ComprobanteFamiliaWinston {
  beneficiadoNombre: string | null
  referidoNombre: string | null
  mes: string | null
}

export async function listarHistorialFamiliaWinston(limite = 50): Promise<{
  aplicados: FilaHistorialFamiliaWinston[]
  pendientes: number
}> {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('wsp')
    .select(SELECT_WSP)
    .eq('status', 'autorizado')
    .order('validado_en', { ascending: false, nullsFirst: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  const filas = ((data ?? []) as FilaWsp[]).map(mapComprobante)

  const refs = [
    ...new Set(filas.flatMap((f) => [f.ctrl, f.referidoRef]).filter((n): n is number => !!n)),
  ]
  const nombres = new Map<number, string>()
  if (refs.length > 0) {
    const { data: alumnos } = await db
      .from('alumno')
      .select('alumno_ref, alumno_nombre, alumno_app, alumno_apm')
      .in('alumno_ref', refs)
    for (const a of (alumnos ?? []) as Record<string, unknown>[]) {
      nombres.set(
        Number(a.alumno_ref),
        [a.alumno_nombre, a.alumno_app, a.alumno_apm].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
      )
    }
  }

  const { count } = await db
    .from('wsp')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendiente')

  return {
    aplicados: filas.map((f) => ({
      ...f,
      beneficiadoNombre: nombres.get(f.ctrl) ?? null,
      referidoNombre: f.referidoRef ? nombres.get(f.referidoRef) ?? null : null,
      mes: f.conceptoCondonado ? MES_POR_CONCEPTO[f.conceptoCondonado] ?? null : null,
    })),
    pendientes: count ?? 0,
  }
}

export async function listarCiclosInicioClases(): Promise<
  { valor: number; nombre: string; inicioClases: string | null; esActual: boolean }[]
> {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('ciclos_escolares')
    .select('valor, nombre, inicio_clases, es_actual')
    .order('valor', { ascending: false })
    .limit(4)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    valor: Number(c.valor),
    nombre: String(c.nombre ?? ''),
    inicioClases: c.inicio_clases ? String(c.inicio_clases).slice(0, 10) : null,
    esActual: Boolean(c.es_actual),
  }))
}

export async function guardarInicioClases(valor: number, fecha: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida.')
  const db = createDbAdmin()
  const { error } = await db.from('ciclos_escolares').update({ inicio_clases: fecha }).eq('valor', valor)
  if (error) throw new Error(error.message)
}
