/** Team English: tipos y cálculos compartidos (cliente + servidor). */

/** Solo inglés Primaria (nivel 3). */
export type TeNivel = 3

export const TE_NIVELES: { valor: TeNivel; etiqueta: string; emoji: string }[] = [
  { valor: 3, etiqueta: 'Primaria', emoji: '🎒' },
]

export function etiquetaNivelTe(n: number): string {
  return TE_NIVELES.find((x) => x.valor === n)?.etiqueta ?? `Nivel ${n}`
}

export function gradosNivel(): number[] {
  return [1, 2, 3, 4, 5, 6]
}

export function etiquetaGrado(_nivel: number, grado: number): string {
  return `${grado}°`
}

export const TE_EMOJIS = ['🌷', '🌸', '🌻', '🌈', '🦄', '🐰', '🐻', '🐼', '🐱', '🦊', '🐨', '🐥', '🍓', '🍒', '🧁', '⭐', '🌙', '☁️', '🎀', '💖'] as const

export type TeTeacher = {
  maestro_id: number
  nombre: string
  email: string | null
  celular: string | null
  usuario: string | null
  /** Grupos con asignación «Teacher», ej. ['1A','1B']. */
  grupos: string[]
  grados: number[]
  manual: boolean
  activo: boolean
  emoji: string
  puesto: string | null
  fecha_ingreso: string | null
  telefono: string | null
  formacion: string | null
  certificaciones: string | null
  nivel_ingles: string | null
  notas: string | null
  cv_key: string | null
  cv_nombre: string | null
  foto_key: string | null
  antecedentes: number
}

export const TIPOS_ANTECEDENTE = [
  { valor: 'reconocimiento', etiqueta: 'Reconocimiento', emoji: '🏆' },
  { valor: 'observacion', etiqueta: 'Observación de clase', emoji: '👀' },
  { valor: 'entrevista', etiqueta: 'Entrevista / reunión', emoji: '💬' },
  { valor: 'llamada_atencion', etiqueta: 'Llamada de atención', emoji: '⚠️' },
  { valor: 'acta', etiqueta: 'Acta administrativa', emoji: '📝' },
  { valor: 'incidente', etiqueta: 'Incidente', emoji: '🚨' },
  { valor: 'otro', etiqueta: 'Otro', emoji: '📌' },
] as const

export type TipoAntecedente = (typeof TIPOS_ANTECEDENTE)[number]['valor']

export type TeAntecedente = {
  id: number
  maestro_id: number
  fecha: string
  tipo: TipoAntecedente
  titulo: string
  descripcion: string
  archivo_key: string | null
  archivo_nombre: string | null
  registrado_por: string | null
  created_at: string
}

export type EstadoPlaneacion = 'pendiente' | 'aprobada' | 'cambios'

export const ESTADOS_PLANEACION: Record<EstadoPlaneacion, { etiqueta: string; emoji: string }> = {
  pendiente: { etiqueta: 'Por revisar', emoji: '⏳' },
  aprobada: { etiqueta: 'Aprobada', emoji: '✅' },
  cambios: { etiqueta: 'Con cambios', emoji: '✏️' },
}

export type TePlaneacion = {
  id: number
  maestro_id: number
  grado: number
  semana: string
  titulo: string
  notas: string
  archivo_key: string | null
  archivo_nombre: string | null
  estado: EstadoPlaneacion
  comentario: string
  version: number
  subido_por: string | null
  subido_rol: 'teacher' | 'directora'
  revisado_por: string | null
  revisado_at: string | null
  updated_at: string
}

export type TeCapacitacion = {
  id: number
  titulo: string
  tipo: 'interna' | 'externa'
  modalidad: 'presencial' | 'en_linea' | 'hibrida'
  proveedor: string | null
  fecha_inicio: string
  fecha_fin: string | null
  horas: number | null
  lugar: string | null
  descripcion: string
  estado: 'programada' | 'realizada' | 'cancelada'
  participantes: { maestro_id: number; asistio: boolean | null; constancia_key: string | null; constancia_nombre: string | null }[]
}

export const MODALIDADES: Record<TeCapacitacion['modalidad'], string> = {
  presencial: 'Presencial',
  en_linea: 'En línea',
  hibrida: 'Híbrida',
}

export const TIPOS_INCIDENCIA = [
  { valor: 'falta', etiqueta: 'Falta', emoji: '🚫', rubro: 'asistencia' },
  { valor: 'retardo', etiqueta: 'Retardo', emoji: '⏰', rubro: 'retardos' },
  { valor: 'permiso_llegada', etiqueta: 'Permiso de llegada', emoji: '🚪', rubro: 'permisos' },
  { valor: 'permiso_salida', etiqueta: 'Permiso de salida', emoji: '🏃‍♀️', rubro: 'permisos' },
  { valor: 'enfermedad', etiqueta: 'Enfermedad', emoji: '🤒', rubro: 'enfermedad' },
] as const

export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number]['valor']

export type TeIncidencia = {
  id: number
  maestro_id: number
  fecha: string
  tipo: TipoIncidencia
  minutos: number | null
  justificada: boolean
  notas: string
  registrado_por: string | null
}

export const RUBROS = [
  { clave: 'asistencia', etiqueta: 'Asistencia', emoji: '📅', ayuda: 'Días sin falta' },
  { clave: 'retardos', etiqueta: 'Puntualidad', emoji: '⏰', ayuda: 'Días sin retardo' },
  { clave: 'permisos', etiqueta: 'Permisos', emoji: '🚪', ayuda: 'Días sin permiso de llegada o salida' },
  { clave: 'enfermedad', etiqueta: 'Salud', emoji: '🤒', ayuda: 'Días sin incapacidad por enfermedad' },
] as const

export type Rubro = (typeof RUBROS)[number]['clave']
export type Ponderadores = Record<Rubro, number>

export const PONDERADORES_DEFAULT: Ponderadores = { asistencia: 40, retardos: 25, permisos: 20, enfermedad: 15 }

export type TeClassroom = {
  id: number
  maestro_id: number
  semana: string
  grupo: string
  actualizado: boolean
  actividades_calificadas: boolean
  trabajos_revisados: boolean
  notas: string
  revisado_por: string | null
}

/** Clase activa de Google Classroom (lectura vía delegación de dominio). */
export type TeClassroomCurso = {
  id: string
  nombre: string
  seccion: string | null
  enlace: string | null
  alumnos: number
  tareas: number
  tareas_30d: number
  avisos_30d: number
  ultima_actividad: string | null
}

export type TeClassroomResumen = {
  email: string
  cursos: TeClassroomCurso[]
}

export type TeClassroomTarea = {
  id: string
  titulo: string
  tipo: string
  publicada: string | null
  entrega: string | null
  puntos: number | null
  enlace: string | null
  asignados: number
  entregadas: number
  tarde: number
  calificadas: number
  devueltas: number
}

export type TeClassroomPublicacion = {
  id: string
  texto: string
  fecha: string | null
  enlace: string | null
}

export type TeCoMaestrasSync = {
  clases: number
  agregadas: number
  quitadas: number
  errores: string[]
}

export type TeClassroomDetalle = {
  curso_id: string
  alumnos: number
  tareas: TeClassroomTarea[]
  avisos: TeClassroomPublicacion[]
  materiales: TeClassroomPublicacion[]
}

export type TeSnapshot = {
  nivel: TeNivel
  niveles: TeNivel[]
  hoy: string
  inicio_ciclo: string
  teachers: TeTeacher[]
  planeaciones: TePlaneacion[]
  capacitaciones: TeCapacitacion[]
  incidencias: TeIncidencia[]
  classroom: TeClassroom[]
  ponderadores: Ponderadores
}

/* ── Fechas ── */

export function hoyMx(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
}

function aUtc(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

function aIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function sumarDias(iso: string, n: number): string {
  const d = aUtc(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return aIso(d)
}

/** Lunes de la semana de la fecha. */
export function lunesDe(iso: string): string {
  const dia = aUtc(iso).getUTCDay()
  return sumarDias(iso, dia === 0 ? -6 : 1 - dia)
}

/** Inicio del ciclo escolar en curso (1 de agosto). */
export function inicioCicloEscolar(hoy: string): string {
  const [y, m] = hoy.split('-').map(Number)
  return `${m >= 8 ? y : y - 1}-08-01`
}

export function fechaCorta(iso: string): string {
  return aUtc(iso).toLocaleDateString('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short' })
}

export function fechaLarga(iso: string): string {
  return aUtc(iso).toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function textoSemana(lunes: string): string {
  return `${fechaCorta(lunes)} – ${fechaCorta(sumarDias(lunes, 4))}`
}

export function diasHabiles(desde: string, hasta: string): number {
  if (desde > hasta) return 0
  let n = 0
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    const w = aUtc(d).getUTCDay()
    if (w >= 1 && w <= 5) n++
  }
  return n
}

/* ── Desempeño ── */

export type DesempenoTeacher = {
  maestro_id: number
  dias: number
  conteos: Record<TipoIncidencia, number>
  rubros: Record<Rubro, number>
  total: number
}

const RUBRO_DE: Record<TipoIncidencia, Rubro> = {
  falta: 'asistencia',
  retardo: 'retardos',
  permiso_llegada: 'permisos',
  permiso_salida: 'permisos',
  enfermedad: 'enfermedad',
}

/**
 * Cada rubro = % de días hábiles del periodo sin ese tipo de incidencia.
 * Una incidencia justificada pesa la mitad. El total pondera los rubros.
 */
export function calcularDesempeno(
  maestroId: number,
  incidencias: TeIncidencia[],
  desde: string,
  hasta: string,
  pesos: Ponderadores
): DesempenoTeacher {
  const dias = diasHabiles(desde, hasta)
  const conteos = { falta: 0, retardo: 0, permiso_llegada: 0, permiso_salida: 0, enfermedad: 0 } as Record<TipoIncidencia, number>
  const carga: Record<Rubro, number> = { asistencia: 0, retardos: 0, permisos: 0, enfermedad: 0 }
  for (const i of incidencias) {
    if (i.maestro_id !== maestroId || i.fecha < desde || i.fecha > hasta) continue
    conteos[i.tipo]++
    carga[RUBRO_DE[i.tipo]] += i.justificada ? 0.5 : 1
  }
  const rubros = {} as Record<Rubro, number>
  for (const r of RUBROS) {
    rubros[r.clave] = dias ? Math.max(0, 100 * (1 - carga[r.clave] / dias)) : 100
  }
  const sumaPesos = RUBROS.reduce((s, r) => s + (pesos[r.clave] || 0), 0) || 1
  const total = RUBROS.reduce((s, r) => s + rubros[r.clave] * (pesos[r.clave] || 0), 0) / sumaPesos
  return { maestro_id: maestroId, dias, conteos, rubros, total }
}

export function nivelDesempeno(pct: number): { etiqueta: string; emoji: string; tono: 'top' | 'ok' | 'warn' | 'bad' } {
  if (pct >= 95) return { etiqueta: 'Excelente', emoji: '🌟', tono: 'top' }
  if (pct >= 88) return { etiqueta: 'Muy bien', emoji: '😊', tono: 'ok' }
  if (pct >= 78) return { etiqueta: 'Atención', emoji: '😐', tono: 'warn' }
  return { etiqueta: 'Crítico', emoji: '🥺', tono: 'bad' }
}

export function normalizarPonderadores(raw: unknown): Ponderadores {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...PONDERADORES_DEFAULT }
  for (const r of RUBROS) {
    const n = Number(o[r.clave])
    if (Number.isFinite(n) && n >= 0 && n <= 100) out[r.clave] = Math.round(n)
  }
  return out
}

export const TE_MAX_ARCHIVO_MB = 15
