import { createAdminClient } from '@insforge/sdk'
import type { TeIncidencia, TeRelojEstado, TeTeacher } from './teTypes'

/**
 * Faltas, retardos y permisos de las teachers a partir del Reloj Checador (proyecto InsForge aparte, solo lectura).
 * Reglas observadas en el Reloj: tolerancia de 5 min; de 6 a 20 min es retardo; desde 21 min el Reloj aplica
 * un permiso de llegada automático contra el crédito del periodo.
 */

const TZ = 'America/Monterrey'
const TOLERANCIA_DEFAULT = 5
const AUTO_PERMISO_DEFAULT = 21
const CACHE_MS = 5 * 60_000
const PAGINA = 1000

type Fila = Record<string, unknown>
type Db = ReturnType<typeof createAdminClient>['database']

let cliente: Db | null = null
function db(): Db | null {
  const baseUrl = process.env.RELOJ_INSFORGE_URL
  const apiKey = process.env.RELOJ_INSFORGE_API_KEY
  if (!baseUrl || !apiKey) return null
  cliente ??= createAdminClient({ baseUrl, apiKey }).database
  return cliente
}

function normalizar(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Exige las dos últimas palabras (apellidos) y elige el empleado con más palabras en común; si empatan, ninguno. */
function empatar(nombre: string, empleados: { numero: string; nombre: string }[]): { numero: string; nombre: string } | null {
  const t = normalizar(nombre)
  if (t.length < 2) return null
  const apellidos = t.slice(-2)
  let mejor: { numero: string; nombre: string } | null = null
  let puntos = 0
  let empate = false
  for (const e of empleados) {
    const n = new Set(normalizar(e.nombre))
    if (!apellidos.every((x) => n.has(x))) continue
    const p = t.filter((x) => n.has(x)).length
    if (p > puntos) {
      mejor = e
      puntos = p
      empate = false
    } else if (p === puntos) empate = true
  }
  return empate ? null : mejor
}

const fmtLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function local(iso: string): { fecha: string; seg: number } {
  const p = Object.fromEntries(fmtLocal.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return { fecha: `${p.year}-${p.month}-${p.day}`, seg: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) }
}

function segundos(hhmm: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(hhmm ?? ''))
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0) : null
}

function diaSemana(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

function fechas(desde: string, hasta: string): string[] {
  const out: string[] = []
  const d = new Date(`${desde}T12:00:00Z`)
  const fin = new Date(`${hasta}T12:00:00Z`)
  while (d <= fin && out.length < 400) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

function num(v: unknown): number | null {
  return v == null || v === '' ? null : Number(v)
}

async function todas(consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>, ctx: string): Promise<Fila[]> {
  const out: Fila[] = []
  for (let desde = 0; desde < 50_000; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1)
    if (error) throw new Error(`Reloj ${ctx}: ${error.message ?? 'error'}`)
    const filas = (data ?? []) as Fila[]
    out.push(...filas)
    if (filas.length < PAGINA) break
  }
  return out
}

type Resultado = { incidencias: TeIncidencia[]; estado: TeRelojEstado }
const cache = new Map<string, { en: number; r: Resultado }>()

export async function incidenciasReloj(teachers: TeTeacher[], desde: string, hoy: string): Promise<Resultado> {
  const vacio = (error: string | null): Resultado => ({
    incidencias: [],
    estado: { vinculos: teachers.map((t) => ({ maestro_id: t.maestro_id, empleado: null, nombre: null })), error, actualizado: new Date().toISOString() },
  })
  const r = db()
  if (!r) return vacio('Falta configurar el acceso al Reloj Checador.')
  const clave = `${desde}|${hoy}|${teachers.map((t) => t.maestro_id).join(',')}`
  const previo = cache.get(clave)
  if (previo && Date.now() - previo.en < CACHE_MS) return previo.r
  try {
    const res = await calcular(r, teachers, desde, hoy)
    cache.set(clave, { en: Date.now(), r: res })
    return res
  } catch (e) {
    console.error('Team English · Reloj:', e)
    return previo?.r ?? vacio('No se pudo leer el Reloj Checador.')
  }
}

async function calcular(r: Db, teachers: TeTeacher[], desde: string, hoy: string): Promise<Resultado> {
  const empRes = await r.from('rn_employees').select('employee_number, full_name').eq('is_active', true)
  if (empRes.error) throw new Error(`Reloj empleados: ${empRes.error.message}`)
  const empleados = ((empRes.data ?? []) as Fila[])
    .map((e) => ({ numero: String(e.employee_number), nombre: String(e.full_name ?? '') }))
    .filter((e) => !e.numero.startsWith('__'))

  const vinculos = teachers.map((t) => {
    const e = empatar(t.nombre, empleados)
    return { maestro_id: t.maestro_id, empleado: e?.numero ?? null, nombre: e?.nombre ?? null }
  })
  const numeros = [...new Set(vinculos.map((v) => v.empleado).filter((n): n is string => !!n))]
  const estado: TeRelojEstado = { vinculos, error: null, actualizado: new Date().toISOString() }
  if (!numeros.length) return { incidencias: [], estado }

  const desdeUtc = new Date(`${desde}T00:00:00-06:00`).toISOString()
  const [schedRes, tiposRes, polRes, ajustesRes, incRes, excRes, usosRes, checadas] = await Promise.all([
    r.from('rn_employee_schedules').select('employee_number, template_id, valid_from, valid_to, late_tolerance_minutes, auto_after_late_minutes').in('employee_number', numeros),
    r.from('rn_incident_types').select('code, incident_kind'),
    r.from('rn_employee_period_policy').select('employee_number, late_tolerance_minutes, auto_after_late_minutes').in('employee_number', numeros),
    r.from('rn_app_settings').select('key, value'),
    r.from('rn_incidents').select('employee_number, work_date, incident_type_code, notes').in('employee_number', numeros).gte('work_date', desde),
    r.from('rn_schedule_exceptions').select('employee_number, exception_date, start_time, end_time').in('employee_number', numeros).gte('exception_date', desde),
    r.from('rn_period_permission_uses').select('employee_number, work_date, minutes, reason, status').in('employee_number', numeros).gte('work_date', desde).in('status', ['active', 'kept']),
    todas(
      (a, b) =>
        r.from('rn_attendance_logs_raw').select('employee_number, punched_at').in('employee_number', numeros).is('voided_at', null).gte('punched_at', desdeUtc).order('punched_at').range(a, b),
      'checadas',
    ),
  ])
  for (const [x, ctx] of [[schedRes, 'horarios'], [tiposRes, 'tipos'], [polRes, 'políticas'], [ajustesRes, 'ajustes'], [incRes, 'incidencias'], [excRes, 'excepciones'], [usosRes, 'permisos']] as const) {
    if (x.error) throw new Error(`Reloj ${ctx}: ${x.error.message}`)
  }

  const horarios = (schedRes.data ?? []) as Fila[]
  const plantillas = [...new Set(horarios.map((h) => String(h.template_id)))]
  const [tplRes, blqRes] = await Promise.all([
    r.from('rn_schedule_templates').select('id, late_tolerance_minutes, auto_after_late_minutes').in('id', plantillas),
    r.from('rn_schedule_blocks').select('template_id, day_of_week, start_time, end_time').in('template_id', plantillas),
  ])
  if (tplRes.error) throw new Error(`Reloj plantillas: ${tplRes.error.message}`)
  if (blqRes.error) throw new Error(`Reloj bloques: ${blqRes.error.message}`)

  const ajustes = new Map(((ajustesRes.data ?? []) as Fila[]).map((a) => [String(a.key), a.value]))
  const autoGlobal = num(ajustes.get('period_auto_after_late_minutes')) ?? AUTO_PERMISO_DEFAULT
  const tpl = new Map(((tplRes.data ?? []) as Fila[]).map((t) => [String(t.id), t]))
  const bloques = new Map<string, { ini: number; fin: number }>()
  for (const b of (blqRes.data ?? []) as Fila[]) {
    const k = `${b.template_id}|${b.day_of_week}`
    const ini = segundos(b.start_time)
    const fin = segundos(b.end_time)
    if (ini == null || fin == null) continue
    const prev = bloques.get(k)
    bloques.set(k, { ini: Math.min(prev?.ini ?? ini, ini), fin: Math.max(prev?.fin ?? fin, fin) })
  }
  const politica = new Map(((polRes.data ?? []) as Fila[]).map((p) => [String(p.employee_number), p]))
  const tipoInc = new Map(((tiposRes.data ?? []) as Fila[]).map((t) => [String(t.code), String(t.incident_kind ?? '')]))

  const porDia = <T,>(filas: Fila[], campoFecha: string, map: (f: Fila) => T) => {
    const m = new Map<string, T[]>()
    for (const f of filas) {
      const k = `${f.employee_number}|${String(f[campoFecha]).slice(0, 10)}`
      m.set(k, [...(m.get(k) ?? []), map(f)])
    }
    return m
  }
  const incidentes = porDia((incRes.data ?? []) as Fila[], 'work_date', (f) => String(f.incident_type_code))
  const excepciones = porDia((excRes.data ?? []) as Fila[], 'exception_date', (f) => ({ ini: segundos(f.start_time), fin: segundos(f.end_time) }))
  const usos = porDia((usosRes.data ?? []) as Fila[], 'work_date', (f) => ({ minutos: Number(f.minutes ?? 0), motivo: String(f.reason) }))

  const entradas = new Map<string, number>()
  const diasConChecada = new Set<string>()
  for (const c of checadas) {
    const l = local(String(c.punched_at))
    const k = `${c.employee_number}|${l.fecha}`
    diasConChecada.add(l.fecha)
    if (!entradas.has(k) || l.seg < entradas.get(k)!) entradas.set(k, l.seg)
  }

  const primeras = await Promise.all(
    vinculos
      .filter((v) => v.empleado)
      .map(async (v) => {
        const { data, error } = await r
          .from('rn_attendance_logs_raw')
          .select('punched_at')
          .eq('employee_number', v.empleado)
          .is('voided_at', null)
          .order('punched_at')
          .limit(1)
        if (error) throw new Error(`Reloj primera checada: ${error.message}`)
        const p = (data as Fila[] | null)?.[0]?.punched_at
        return [v.empleado as string, p ? local(String(p)).fecha : null] as const
      }),
  )
  const primeraChecada = new Map(primeras)

  const ahora = local(new Date().toISOString())
  const incidencias: TeIncidencia[] = []
  let id = -1
  const agregar = (maestroId: number, fecha: string, tipo: TeIncidencia['tipo'], minutos: number | null, justificada: boolean, notas: string) => {
    incidencias.push({ id: id--, maestro_id: maestroId, fecha, tipo, minutos, justificada, notas, registrado_por: 'Reloj Checador', origen: 'reloj' })
  }

  for (const v of vinculos) {
    if (!v.empleado) continue
    const pol = politica.get(v.empleado)
    const alta = primeraChecada.get(v.empleado)
    if (!alta) continue
    for (const fecha of fechas(desde, hoy)) {
      if (fecha < alta) continue
      const h = horarios.find(
        (x) => String(x.employee_number) === v.empleado && String(x.valid_from).slice(0, 10) <= fecha && (!x.valid_to || String(x.valid_to).slice(0, 10) >= fecha),
      )
      if (!h) continue
      const k = `${v.empleado}|${fecha}`
      const exc = excepciones.get(k)?.[0]
      const blq = bloques.get(`${h.template_id}|${diaSemana(fecha)}`)
      const ini = exc?.ini ?? blq?.ini
      const fin = exc?.fin ?? blq?.fin
      if (ini == null || fin == null) continue

      const codigos = incidentes.get(k) ?? []
      const clases = codigos.map((c) => tipoInc.get(c) ?? (c === 'MED' ? 'MEDICO' : ''))
      const medico = codigos.some((c) => c === 'MED' || c.startsWith('MEDICAL'))
      if (medico) {
        agregar(v.maestro_id, fecha, 'enfermedad', null, true, 'Permiso médico en el Reloj')
        continue
      }
      if (clases.some((c) => c === 'JUSTIFICA_DIA' || c === 'VACACIONES') || codigos.includes('PRIOR TO HIRING')) continue
      if (clases.includes('FALTA')) {
        agregar(v.maestro_id, fecha, 'falta', null, false, `Falta en el Reloj (${codigos.join(', ')})`)
        continue
      }

      const entrada = entradas.get(k)
      if (entrada == null) {
        const terminoDia = fecha < ahora.fecha || (fecha === ahora.fecha && ahora.seg > fin)
        if (terminoDia && diasConChecada.has(fecha)) agregar(v.maestro_id, fecha, 'falta', null, false, 'Sin checadas')
        continue
      }

      const tpln = tpl.get(String(h.template_id))
      const tolerancia = num(pol?.late_tolerance_minutes) ?? num(h.late_tolerance_minutes) ?? num(tpln?.late_tolerance_minutes) ?? TOLERANCIA_DEFAULT
      const autoPermiso = num(pol?.auto_after_late_minutes) ?? num(h.auto_after_late_minutes) ?? num(tpln?.auto_after_late_minutes) ?? autoGlobal
      const tarde = Math.floor((entrada - ini) / 60)
      const sinEntrada = entrada > (ini + fin) / 2
      if (tarde > tolerancia && !sinEntrada) {
        const justificada = clases.includes('JUSTIFICA_ENTRADA')
        const hora = `${String(Math.floor(entrada / 3600)).padStart(2, '0')}:${String(Math.floor((entrada % 3600) / 60)).padStart(2, '0')}`
        if (justificada) agregar(v.maestro_id, fecha, 'retardo', tarde, true, `Entrada ${hora} · justificada (${codigos.join(', ')})`)
        else if (tarde >= autoPermiso) agregar(v.maestro_id, fecha, 'permiso_llegada', tarde, false, `Entrada ${hora}`)
        else agregar(v.maestro_id, fecha, 'retardo', tarde, false, `Entrada ${hora}`)
      }
      const salida = (usos.get(k) ?? []).find((u) => u.motivo === 'EARLY_EXIT')
      if (salida) agregar(v.maestro_id, fecha, 'permiso_salida', salida.minutos, false, 'Salida anticipada en el Reloj')
    }
  }
  return { incidencias, estado }
}
