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
  /** 2026-10-06 — alumno_nuevo_ingreso = 1 en su ciclo más reciente. */
  nuevoIngreso: boolean
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
  /** 2026-10-06 — Interesado (alumno nuevo) que AgendaW guarda al generar el comprobante. */
  interesadoNombre: string | null
  interesadoNivelGrado: string | null
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

/** 2026-10-06 — Datos del alumno recomendado para mostrar: inscripción, primera colegiatura y antigüedad. */
export interface InfoReferidoFamiliaWinston {
  inscripcion: { fecha: string | null; importe: number; referencia: string } | null
  primeraColegiatura: { mes: string; fecha: string | null; importe: number } | null
  /** Desde cuándo cuenta como estudiante (inicio de clases o su alta, lo más tarde). */
  estudiaDesde: string | null
  diasEstudiando: number | null
}

export interface RevisionFamiliaWinston {
  puedeAplicar: boolean
  checks: CheckFamiliaWinston[]
  comprobante: ComprobanteFamiliaWinston | null
  beneficiado: AlumnoFamiliaWinston | null
  referido: AlumnoFamiliaWinston | null
  infoReferido: InfoReferidoFamiliaWinston | null
  mesPropuesto: MesPropuesto | null
  /** 2026-10-05 — Colegiaturas pendientes que se pueden elegir para condonar. */
  mesesDisponibles: MesPropuesto[]
  destinatarios: DestinatarioFamiliaWinston[]
  diasClases: number | null
  fechaDisponible: string | null
  /** 2026-10-06 — Interesado que trae el comprobante (AgendaW); null en comprobantes viejos. */
  interesadoComprobante: string | null
  /** 2026-10-06 — Comprobante viejo: hay que escribir el nombre del interesado del PDF para confirmar. */
  requiereNombrePdf: boolean
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
  interesado_nombre?: string | null
  interesado_nivel_grado?: string | null
  appointment_id?: string | null
}

type FilaPago = {
  pago_referencia: string | null
  pago_cancelado: number | null
  pago_importe: number | string | null
  pago_fecha?: string | null
}

const CONCEPTO_INSCRIPCION = '13'

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
    interesadoNombre: f.interesado_nombre?.trim() || null,
    interesadoNivelGrado: f.interesado_nivel_grado?.trim() || null,
  }
}

/* 2026-10-06 — + interesado y cita de AgendaW (migración 20261006160000_wsp_interesado). */
const SELECT_WSP =
  'id, ctrl, qr, status, referido_alumno_ref, validado_en, validado_por, concepto_condonado, ciclo_condonado, pago_referencia, correo_enviado_en, correo_resultado, interesado_nombre, interesado_nivel_grado, appointment_id'

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
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_status, alumno_ciclo_escolar, alumno_alta, alumno_nuevo_ingreso, mes'
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
    nuevoIngreso: Number(a.alumno_nuevo_ingreso) === 1,
  }
}

/** Días máximos desde el alta para contar como alumno nuevo cuando no hay otra señal. */
const DIAS_ALTA_NUEVO = 400

/**
 * 2026-10-06 — ¿El recomendado entró nuevo? Sí si tiene la marca de nuevo ingreso, si su primera
 * inscripción (concepto 13) es de este ciclo o del anterior (los que entran a medio ciclo), o si se
 * dio de alta hace menos de DIAS_ALTA_NUEVO días. Evita recomendar a alumnos de años anteriores.
 */
function entroComoNuevo(
  alumno: AlumnoFamiliaWinston,
  pagos: FilaPago[]
): { nuevo: boolean; desde: string | null } {
  const inscripciones = pagos
    .filter((p) => pagoVigente(p))
    .map((p) => ({ p, ref: parsearReferenciaPago(p.pago_referencia) }))
    .filter((x) => !!x.ref && normalizarConceptoNo(x.ref.conceptoNo) === CONCEPTO_INSCRIPCION)
    .sort((a, b) => String(a.p.pago_fecha ?? '').localeCompare(String(b.p.pago_fecha ?? '')))
  const primera = inscripciones[0]
  const desde = alumno.alta ?? (primera?.p.pago_fecha ? String(primera.p.pago_fecha).slice(0, 10) : null)
  const nuevo =
    alumno.nuevoIngreso ||
    (!!primera?.ref && primera.ref.cicloEscolar >= alumno.ciclo - 1) ||
    (!!alumno.alta && diasEntre(alumno.alta, hoyMx()) <= DIAS_ALTA_NUEVO)
  return { nuevo, desde }
}

async function cargarPagos(db: AppDatabaseClient, alumnoId: number): Promise<FilaPago[]> {
  const { data, error } = await db
    .from('pago_detalle')
    .select('pago_referencia, pago_cancelado, pago_importe, pago_fecha')
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

/**
 * Colegiaturas del plan (01…10, 26 si 11 meses) sin pago vigente en el ciclo, en orden del plan.
 * 2026-10-05 — Antes solo devolvía la primera; ahora todas para poder elegir el mes a condonar.
 */
function colegiaturasPendientes(pagos: FilaPago[], ciclo: number, planMeses: 1 | 2): string[] {
  const cubiertos = new Set<string>()
  for (const p of pagos) {
    if (!pagoVigente(p)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (parsed && parsed.cicloEscolar === ciclo) cubiertos.add(normalizarConceptoNo(parsed.conceptoNo))
  }
  const out: string[] = []
  for (const slot of slotsColegiaturaPortal(planMeses)) {
    for (const raw of slot) {
      const c = normalizarConceptoNo(raw)
      if (!CONCEPTOS_COLEGIATURA.has(c) || cubiertos.has(c) || out.includes(c)) continue
      out.push(c)
    }
  }
  return out
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

/**
 * 2026-10-06 — Inscripción (concepto 13) y primera colegiatura pagada del ciclo del alumno
 * recomendado. La inscripción del ciclo manda; si no hay, la más reciente que tenga.
 */
function pagosClaveReferido(
  pagos: FilaPago[],
  ciclo: number
): Pick<InfoReferidoFamiliaWinston, 'inscripcion' | 'primeraColegiatura'> {
  const vigentes = pagos
    .filter((p) => pagoVigente(p) && Number(p.pago_importe) > 0)
    .map((p) => ({ p, ref: parsearReferenciaPago(p.pago_referencia) }))
    .filter((x): x is { p: FilaPago; ref: NonNullable<typeof x.ref> } => !!x.ref)
    .sort((a, b) => String(a.p.pago_fecha ?? '').localeCompare(String(b.p.pago_fecha ?? '')))
  const fecha = (p: FilaPago) => (p.pago_fecha ? String(p.pago_fecha).slice(0, 10) : null)

  const inscripciones = vigentes.filter((x) => normalizarConceptoNo(x.ref.conceptoNo) === CONCEPTO_INSCRIPCION)
  const insc = inscripciones.find((x) => x.ref.cicloEscolar === ciclo) ?? inscripciones[inscripciones.length - 1]
  const coleg = vigentes.find(
    (x) => x.ref.cicloEscolar === ciclo && CONCEPTOS_COLEGIATURA.has(normalizarConceptoNo(x.ref.conceptoNo))
  )
  return {
    inscripcion: insc
      ? { fecha: fecha(insc.p), importe: Number(insc.p.pago_importe), referencia: String(insc.p.pago_referencia) }
      : null,
    primeraColegiatura: coleg
      ? {
          mes: MES_POR_CONCEPTO[normalizarConceptoNo(coleg.ref.conceptoNo)],
          fecha: fecha(coleg.p),
          importe: Number(coleg.p.pago_importe),
        }
      : null,
  }
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
 * 2026-10-06 — Alumno recomendado que se llena solo al leer el QR.
 * fuente: «guardado» (ya se validó antes), «cita» (cita de AgendaW ligada al comprobante y ya
 * inscrito), «nombre» (nombre del interesado = un solo alumno), «apellido» (comprobante viejo
 * sin interesado: solo sugerencias de nuevo ingreso que comparten apellido, no se elige solo).
 */
export interface RecomendadoQrFamiliaWinston {
  alumno: AlumnoQrFamiliaWinston | null
  fuente: 'guardado' | 'cita' | 'nombre' | 'apellido' | null
  interesadoNombre: string | null
  candidatos: AlumnoQrFamiliaWinston[]
}

export interface ComprobanteQrFamiliaWinston {
  comprobante: ComprobanteFamiliaWinston
  alumno: AlumnoQrFamiliaWinston | null
  recomendado: RecomendadoQrFamiliaWinston
}

const SELECT_ALUMNO_QR =
  'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_ciclo_escolar, alumno_status, alumno_nuevo_ingreso'

const MAX_SUGERENCIAS_APELLIDO = 5

function mapAlumnoQr(r: Record<string, unknown>): AlumnoQrFamiliaWinston {
  return {
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
}

/** Mayúsculas sin acentos ni ñ y con espacios simples: «Santibañez » = «SANTIBANEZ». */
function normalizarNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clavePalabras(s: string): string {
  return normalizarNombre(s).split(' ').filter(Boolean).sort().join(' ')
}

/** Una fila por alumno_ref (la del ciclo más reciente; las filas vienen ordenadas desc). */
function unicosPorRef(filas: Record<string, unknown>[]): Record<string, unknown>[] {
  const vistos = new Set<string>()
  return filas.filter((r) => {
    const ref = String(r.alumno_ref)
    if (vistos.has(ref)) return false
    vistos.add(ref)
    return true
  })
}

async function cargarAlumnoQr(db: AppDatabaseClient, ref: number): Promise<AlumnoQrFamiliaWinston | null> {
  const { data } = await db
    .from('alumno')
    .select(SELECT_ALUMNO_QR)
    .eq('alumno_ref', ref)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? mapAlumnoQr(data as Record<string, unknown>) : null
}

/** Alumnos cuyo nombre completo es el del interesado (mismas palabras, sin importar acentos/orden). */
async function alumnosPorNombre(
  db: AppDatabaseClient,
  nombre: string,
  excluirRef: number
): Promise<AlumnoQrFamiliaWinston[]> {
  const palabras = normalizarNombre(nombre).split(' ').filter((p) => p.length >= 3)
  if (palabras.length < 2) return []
  const { data: ultimo } = await db
    .from('alumno')
    .select('alumno_ciclo_escolar')
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(1)
    .maybeSingle()
  const cicloMax = Number((ultimo as { alumno_ciclo_escolar?: number } | null)?.alumno_ciclo_escolar) || 0
  // La palabra más larga filtra en la base; vocales y N son comodín porque en la base
  // hay nombres con y sin acento/ñ («HERNÁNDEZ», «SANTIBANEZ»).
  const larga = [...palabras].sort((a, b) => b.length - a.length)[0]
  const patron = `%${larga.replace(/[AEIOUN]/g, '_')}%`
  const { data, error } = await db
    .from('alumno')
    .select(SELECT_ALUMNO_QR)
    .gte('alumno_ciclo_escolar', cicloMax - 1)
    .or(`alumno_nombre.ilike.${patron},alumno_app.ilike.${patron},alumno_apm.ilike.${patron}`)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(300)
  if (error) throw new Error(error.message)
  const clave = clavePalabras(nombre)
  return unicosPorRef((data ?? []) as Record<string, unknown>[])
    .filter((r) => Number(r.alumno_ref) !== excluirRef)
    .filter((r) => clavePalabras([r.alumno_nombre, r.alumno_app, r.alumno_apm].map((x) => String(x ?? '')).join(' ')) === clave)
    .map(mapAlumnoQr)
}

/** Comprobantes viejos: nuevo ingreso del mismo ciclo que comparten apellido con quien recomendó. */
async function sugerenciasPorApellido(
  db: AppDatabaseClient,
  beneficiado: AlumnoQrFamiliaWinston
): Promise<AlumnoQrFamiliaWinston[]> {
  const apellidos = [beneficiado.alumno_app, beneficiado.alumno_apm].map((s) => s.trim()).filter(Boolean)
  if (!apellidos.length || beneficiado.alumno_ciclo_escolar == null) return []
  const consulta = (campo: 'alumno_app' | 'alumno_apm') =>
    db
      .from('alumno')
      .select(SELECT_ALUMNO_QR)
      .eq('alumno_ciclo_escolar', beneficiado.alumno_ciclo_escolar as number)
      .eq('alumno_nuevo_ingreso', 1)
      .in(campo, apellidos)
      .limit(50)
  const [porApp, porApm] = await Promise.all([consulta('alumno_app'), consulta('alumno_apm')])
  const filas = unicosPorRef([
    ...((porApp.data ?? []) as Record<string, unknown>[]),
    ...((porApm.data ?? []) as Record<string, unknown>[]),
  ]).filter((r) => String(r.alumno_ref) !== beneficiado.alumno_ref)
  if (!filas.length || filas.length > MAX_SUGERENCIAS_APELLIDO) return []
  // Fuera los que ya generaron un beneficio con otro comprobante.
  const refs = filas.map((r) => Number(r.alumno_ref))
  const { data: usados } = await db
    .from('wsp')
    .select('referido_alumno_ref')
    .in('referido_alumno_ref', refs)
    .in('status', ['aplicando', 'autorizado'])
  const yaUsados = new Set(
    ((usados ?? []) as { referido_alumno_ref: number | null }[]).map((u) => Number(u.referido_alumno_ref))
  )
  return filas.filter((r) => !yaUsados.has(Number(r.alumno_ref))).map(mapAlumnoQr)
}

/** Distancia de edición (para tolerar una letra de diferencia al escribir el nombre). */
function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1))
      previo = tmp
    }
  }
  return fila[b.length]
}

/**
 * 2026-10-06 — ¿El nombre escrito/guardado es el de este alumno? Al menos dos palabras y
 * todas deben estar en su nombre (sin acentos; una letra de error en palabras de 5+ letras).
 */
function nombreCoincide(escrito: string, nombreAlumno: string): boolean {
  const pal = normalizarNombre(escrito).split(' ').filter((p) => p.length >= 2)
  const del = normalizarNombre(nombreAlumno).split(' ').filter(Boolean)
  if (pal.length < 2) return false
  return pal.every((p) => del.some((d) => d === p || (p.length >= 5 && d.length >= 5 && distancia(p, d) <= 1)))
}

/** Interesado según AgendaW: número de control (si ya se inscribió y la cita está ligada) y nombre. */
async function interesadoDelComprobante(
  db: AppDatabaseClient,
  f: FilaWsp
): Promise<{ ref: number | null; nombre: string | null }> {
  let nombre = f.interesado_nombre?.trim() || null
  let ref: number | null = null
  if (f.appointment_id) {
    const { data: cita } = await db
      .from('admission_appointments')
      .select('alumno_ref, student_name, student_last_name_p, student_last_name_m')
      .eq('id', f.appointment_id)
      .maybeSingle()
    const c = cita as Record<string, unknown> | null
    if (c) {
      nombre ??=
        [c.student_name, c.student_last_name_p, c.student_last_name_m]
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join(' ')
          .toUpperCase() || null
      const n = Number(c.alumno_ref)
      if (n > 0 && n !== Number(f.ctrl)) ref = n
    }
  }
  return { ref, nombre }
}

async function resolverRecomendado(
  db: AppDatabaseClient,
  f: FilaWsp,
  beneficiado: AlumnoQrFamiliaWinston | null
): Promise<RecomendadoQrFamiliaWinston> {
  const ctrl = Number(f.ctrl)
  const interesado = await interesadoDelComprobante(db, f)
  const interesadoNombre = interesado.nombre
  const res = (
    alumno: AlumnoQrFamiliaWinston | null,
    fuente: RecomendadoQrFamiliaWinston['fuente'],
    candidatos: AlumnoQrFamiliaWinston[] = []
  ): RecomendadoQrFamiliaWinston => ({ alumno, fuente, interesadoNombre, candidatos })

  if (f.referido_alumno_ref != null) {
    const a = await cargarAlumnoQr(db, Number(f.referido_alumno_ref))
    if (a) return res(a, 'guardado')
  }

  if (interesado.ref != null) {
    const a = await cargarAlumnoQr(db, interesado.ref)
    if (a) return res(a, 'cita')
  }

  if (interesadoNombre) {
    const porNombre = await alumnosPorNombre(db, interesadoNombre, ctrl)
    if (porNombre.length === 1) return res(porNombre[0], 'nombre')
    return res(null, null, porNombre.slice(0, MAX_SUGERENCIAS_APELLIDO))
  }

  if (beneficiado) {
    const sugeridos = await sugerenciasPorApellido(db, beneficiado)
    if (sugeridos.length) return res(null, 'apellido', sugeridos)
  }
  return res(null, null)
}

/**
 * 2026-10-05 — Al escanear el QR: comprobantes con ese código y el alumno que recomendó,
 * para llenar en automático «quién recomendó» en el módulo.
 * 2026-10-06 — También el alumno recomendado (ver RecomendadoQrFamiliaWinston).
 */
export async function buscarComprobantesPorQr(qr: number): Promise<ComprobanteQrFamiliaWinston[]> {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('wsp')
    .select(SELECT_WSP)
    .eq('qr', qr)
    .order('id', { ascending: true })
    .limit(5)
  if (error) throw new Error(error.message)
  const filas = (data ?? []) as FilaWsp[]
  const out: ComprobanteQrFamiliaWinston[] = []
  for (const f of filas) {
    const alumno = await cargarAlumnoQr(db, Number(f.ctrl))
    out.push({
      comprobante: mapComprobante(f),
      alumno,
      recomendado: await resolverRecomendado(db, f, alumno),
    })
  }
  return out
}

export async function revisarFamiliaWinston(opts: {
  ctrl: number
  qr: number
  referidoRef: number | null
  /** Mes elegido (concepto 01…10/26); sin él se propone la próxima colegiatura pendiente. */
  conceptoNo?: string | null
  /** 2026-10-06 — Nombre del interesado escrito tal como viene en el PDF (comprobantes viejos). */
  interesadoPdf?: string | null
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
    infoReferido: null,
    mesPropuesto: null,
    mesesDisponibles: [],
    destinatarios: [],
    diasClases: null,
    fechaDisponible: null,
    interesadoComprobante: null,
    requiereNombrePdf: false,
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
      // 2026-10-06: el número del comprobante es el de quien recomienda; se confundía con el del alumno nuevo
      texto: `Un alumno no se puede recomendar a sí mismo: ${opts.ctrl} es quien recomendó. En «¿A quién recomendó?» va el alumno nuevo (el «interesado» que aparece en el comprobante).`,
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

      // 2026-10-06 — Candado: el recomendado tiene que ser el interesado del comprobante.
      // Con datos de AgendaW se compara contra la cita/nombre; en comprobantes viejos contra
      // el nombre que se escribe del PDF. Sin esto cualquier alumno nuevo «procedía».
      const interesado = await interesadoDelComprobante(db, fila)
      res.interesadoComprobante = interesado.nombre
      if (interesado.ref != null) {
        checks.push(
          interesado.ref === referido.alumno_ref
            ? { id: 'interesado', nivel: 'ok', texto: `Es el interesado de la cita con la que se generó el comprobante.` }
            : {
                id: 'interesado',
                nivel: 'error',
                texto: `El comprobante es para ${interesado.nombre ?? 'otro alumno'} (${interesado.ref}), no para ${referido.nombre}.`,
              }
        )
      } else if (interesado.nombre) {
        checks.push(
          nombreCoincide(interesado.nombre, referido.nombre)
            ? { id: 'interesado', nivel: 'ok', texto: `Coincide con el interesado del comprobante: ${interesado.nombre}.` }
            : {
                id: 'interesado',
                nivel: 'error',
                texto: `El comprobante es para ${interesado.nombre}, no para ${referido.nombre}.`,
              }
        )
      } else {
        res.requiereNombrePdf = true
        const escrito = (opts.interesadoPdf ?? '').trim()
        if (!escrito) {
          checks.push({
            id: 'interesado',
            nivel: 'error',
            texto: 'Comprobante anterior sin interesado guardado: escribe el nombre del interesado tal como viene en el PDF para confirmar que es el alumno correcto.',
          })
        } else if (normalizarNombre(escrito).split(' ').filter((p) => p.length >= 2).length < 2) {
          checks.push({
            id: 'interesado',
            nivel: 'error',
            texto: 'Escribe el nombre completo del interesado (nombre y apellidos) como viene en el PDF.',
          })
        } else if (!nombreCoincide(escrito, referido.nombre)) {
          checks.push({
            id: 'interesado',
            nivel: 'error',
            texto: `En el PDF dice «${escrito}», pero elegiste a ${referido.nombre}. Elige al alumno del PDF.`,
          })
        } else {
          checks.push({ id: 'interesado', nivel: 'ok', texto: `Coincide con el interesado del PDF: ${escrito.toUpperCase()}.` })
        }
      }

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
      res.infoReferido = {
        ...pagosClaveReferido(pagosReferido, referido.ciclo),
        estudiaDesde: null,
        diasEstudiando: null,
      }

      // 2026-10-06 — Solo cuenta un alumno que entró nuevo (no uno inscrito de años anteriores).
      const ingreso = entroComoNuevo(referido, pagosReferido)
      if (!ingreso.nuevo) {
        checks.push({
          id: 'nuevo-ingreso',
          nivel: 'error',
          texto: `${referido.nombre} no es alumno de nuevo ingreso: está en la escuela desde ${
            ingreso.desde ? `el ${fechaCorta(ingreso.desde)}` : 'ciclos anteriores'
          }. Familia Winston es solo por alumnos que entran nuevos.`,
        })
      }
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
        res.infoReferido.estudiaDesde = inicio
        res.infoReferido.diasEstudiando = Math.max(0, dias)
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
    const pendientes = colegiaturasPendientes(pagos, beneficiado.ciclo, beneficiado.planMeses)
    if (pendientes.length === 0) {
      checks.push({
        id: 'mes',
        nivel: 'error',
        texto: `${beneficiado.nombre} no tiene colegiaturas pendientes en su ciclo; el beneficio se tiene que aplicar a mano.`,
      })
    } else {
      const ciclo = await cargarCiclo(db, beneficiado.ciclo)
      res.mesesDisponibles = pendientes.map((c) => ({
        conceptoNo: c,
        mes: MES_POR_CONCEPTO[c],
        ciclo: beneficiado.ciclo,
        cicloEtiqueta: ciclo.nombre,
      }))
      const pedido = opts.conceptoNo ? normalizarConceptoNo(opts.conceptoNo) : null
      const elegido = pedido ? res.mesesDisponibles.find((m) => m.conceptoNo === pedido) : undefined
      if (pedido && !elegido) {
        checks.push({
          id: 'mes',
          nivel: 'error',
          texto: `La colegiatura de ${(MES_POR_CONCEPTO[pedido] ?? pedido).toUpperCase()} ya no está pendiente; elige otro mes.`,
        })
      } else {
        res.mesPropuesto = elegido ?? res.mesesDisponibles[0]
        checks.push({
          id: 'mes',
          nivel: 'ok',
          texto: `Se condona la colegiatura de ${res.mesPropuesto.mes.toUpperCase()} ${ciclo.nombre}${
            res.mesPropuesto === res.mesesDisponibles[0] ? ' (próxima pendiente)' : ' (mes elegido)'
          }.`,
        })
      }
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
  conceptoNo?: string | null
  interesadoPdf?: string | null
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
      // 2026-10-06: en comprobantes viejos queda guardado el interesado confirmado del PDF
      ...(revision.requiereNombrePdf && opts.interesadoPdf?.trim()
        ? { interesado_nombre: opts.interesadoPdf.trim().toUpperCase().slice(0, 200) }
        : {}),
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
