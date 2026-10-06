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
  /** 'reloj' = calculada del Reloj Checador (no editable). */
  origen?: 'manual' | 'reloj'
}

export type TeRelojFicha = {
  departamento: string | null
  institucion: string | null
  /** Ej. «Lun–Vie 07:10–15:10». */
  horario: string | null
  primera_checada: string | null
  dias_laborables: number
  dias_asistidos: number
  puntuales: number
  /** Minutos promedio de la primera checada respecto a su hora de entrada (negativo = antes). */
  minutos_vs_entrada: number | null
}

export type TeRelojEstado = {
  vinculos: { maestro_id: number; empleado: string | null; nombre: string | null; ficha?: TeRelojFicha }[]
  error: string | null
  actualizado: string
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

export type TeClassroomPlanItem = {
  id: string
  curso: string
  tipo: 'tarea' | 'material' | 'aviso'
  titulo: string
  tema: string | null
  fecha: string | null
  borrador: boolean
  enlace: string | null
  adjuntos: { titulo: string; enlace: string }[]
  es_planeacion: boolean
}

export type TeClassroomPlanTeacher = {
  maestro_id: number
  error: string | null
  items: TeClassroomPlanItem[]
}

export type TeClassroomPlaneaciones = {
  semana: string
  teachers: TeClassroomPlanTeacher[]
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
  reloj: TeRelojEstado
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

/* ── Expediente personal ── */

export type TeCampo = {
  clave: string
  etiqueta: string
  tipo?: 'text' | 'date' | 'email' | 'tel' | 'number' | 'textarea' | 'select'
  opciones?: string[]
  max?: number
  requerido?: boolean
  mayusculas?: boolean
  patron?: RegExp
  placeholder?: string
  completo?: boolean
}

export const GRUPOS_GENERALES: { clave: string; etiqueta: string; emoji: string; campos: TeCampo[] }[] = [
  {
    clave: 'personal',
    etiqueta: 'Datos personales',
    emoji: '🪪',
    campos: [
      { clave: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'date' },
      { clave: 'lugar_nacimiento', etiqueta: 'Lugar de nacimiento', max: 120 },
      { clave: 'nacionalidad', etiqueta: 'Nacionalidad', max: 60, placeholder: 'Mexicana' },
      { clave: 'estado_civil', etiqueta: 'Estado civil', tipo: 'select', opciones: ['Soltera', 'Casada', 'Unión libre', 'Divorciada', 'Viuda', 'Otro'] },
      { clave: 'curp', etiqueta: 'CURP', max: 18, mayusculas: true, patron: /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{5}[A-Z\d]\d$/ },
      { clave: 'rfc', etiqueta: 'RFC', max: 13, mayusculas: true, patron: /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/ },
      { clave: 'nss', etiqueta: 'Número de Seguro Social', max: 11, patron: /^\d{11}$/ },
    ],
  },
  {
    clave: 'contacto',
    etiqueta: 'Contacto personal',
    emoji: '📱',
    campos: [
      { clave: 'correo_personal', etiqueta: 'Correo personal', tipo: 'email', max: 120 },
      { clave: 'celular_personal', etiqueta: 'Celular personal', tipo: 'tel', max: 20 },
      { clave: 'telefono_casa', etiqueta: 'Teléfono de casa', tipo: 'tel', max: 20 },
    ],
  },
  {
    clave: 'domicilio',
    etiqueta: 'Domicilio',
    emoji: '🏠',
    campos: [
      { clave: 'calle', etiqueta: 'Calle y número', max: 160, completo: true },
      { clave: 'colonia', etiqueta: 'Colonia', max: 120 },
      { clave: 'municipio', etiqueta: 'Municipio', max: 80 },
      { clave: 'estado', etiqueta: 'Estado', max: 60 },
      { clave: 'cp', etiqueta: 'Código postal', max: 5, patron: /^\d{5}$/ },
    ],
  },
  {
    clave: 'laboral',
    etiqueta: 'Datos laborales',
    emoji: '💼',
    campos: [
      { clave: 'tipo_contrato', etiqueta: 'Tipo de contrato', tipo: 'select', opciones: ['Indeterminado', 'Temporal', 'Por horas', 'Honorarios', 'Periodo de prueba'] },
      { clave: 'horas_semana', etiqueta: 'Horas por semana', tipo: 'number', max: 3 },
      { clave: 'anios_experiencia', etiqueta: 'Años de experiencia docente', tipo: 'number', max: 2 },
      { clave: 'materias', etiqueta: 'Materias / áreas que imparte', max: 300, completo: true },
    ],
  },
  {
    clave: 'salud',
    etiqueta: 'Salud',
    emoji: '🩺',
    campos: [
      { clave: 'tipo_sangre', etiqueta: 'Tipo de sangre', tipo: 'select', opciones: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
      { clave: 'alergias', etiqueta: 'Alergias', tipo: 'textarea', max: 1000 },
      { clave: 'condiciones', etiqueta: 'Condiciones médicas a considerar', tipo: 'textarea', max: 1000 },
    ],
  },
  {
    clave: 'individual',
    etiqueta: 'Perfil individual',
    emoji: '✨',
    campos: [
      { clave: 'otros_idiomas', etiqueta: 'Otros idiomas', max: 200 },
      { clave: 'habilidades', etiqueta: 'Habilidades y fortalezas', tipo: 'textarea', max: 2000, completo: true },
      { clave: 'areas_mejora', etiqueta: 'Áreas de oportunidad', tipo: 'textarea', max: 2000, completo: true },
      { clave: 'metas', etiqueta: 'Metas profesionales', tipo: 'textarea', max: 2000, completo: true },
      { clave: 'intereses', etiqueta: 'Intereses y pasatiempos', tipo: 'textarea', max: 1000, completo: true },
    ],
  },
]

export const CAMPOS_GENERALES: TeCampo[] = GRUPOS_GENERALES.flatMap((g) => g.campos)

export type TipoItemExpediente = 'formacion' | 'certificacion' | 'experiencia' | 'contacto' | 'documento'

export const TIPOS_ITEM: Record<TipoItemExpediente, { etiqueta: string; plural: string; emoji: string; archivo: boolean; campos: TeCampo[] }> = {
  formacion: {
    etiqueta: 'Formación académica',
    plural: 'Formación académica',
    emoji: '🎓',
    archivo: true,
    campos: [
      { clave: 'grado', etiqueta: 'Grado', tipo: 'select', opciones: ['Bachillerato', 'Técnico', 'Licenciatura', 'Especialidad', 'Maestría', 'Doctorado', 'Diplomado', 'Otro'], requerido: true },
      { clave: 'carrera', etiqueta: 'Carrera / programa', max: 200, requerido: true },
      { clave: 'institucion', etiqueta: 'Institución', max: 200 },
      { clave: 'anio', etiqueta: 'Año de término', tipo: 'number', max: 4 },
      { clave: 'estatus', etiqueta: 'Estatus', tipo: 'select', opciones: ['Titulada', 'Pasante', 'En curso', 'Trunca'] },
      { clave: 'cedula', etiqueta: 'Cédula profesional', max: 20 },
    ],
  },
  certificacion: {
    etiqueta: 'Certificación',
    plural: 'Certificaciones',
    emoji: '📜',
    archivo: true,
    campos: [
      { clave: 'nombre', etiqueta: 'Certificación', max: 200, requerido: true, placeholder: 'TKT, CELTA, TOEFL…' },
      { clave: 'emisor', etiqueta: 'Emitida por', max: 200, placeholder: 'Cambridge, ETS…' },
      { clave: 'resultado', etiqueta: 'Nivel / puntaje', max: 60, placeholder: 'C1 · 600' },
      { clave: 'fecha', etiqueta: 'Fecha de obtención', tipo: 'date' },
      { clave: 'vigencia', etiqueta: 'Vigente hasta', tipo: 'date' },
    ],
  },
  experiencia: {
    etiqueta: 'Experiencia laboral',
    plural: 'Experiencia laboral',
    emoji: '💼',
    archivo: false,
    campos: [
      { clave: 'institucion', etiqueta: 'Institución / empresa', max: 200, requerido: true },
      { clave: 'puesto', etiqueta: 'Puesto', max: 120 },
      { clave: 'desde', etiqueta: 'Desde', tipo: 'date' },
      { clave: 'hasta', etiqueta: 'Hasta', tipo: 'date' },
      { clave: 'descripcion', etiqueta: 'Funciones / logros', tipo: 'textarea', max: 2000, completo: true },
    ],
  },
  contacto: {
    etiqueta: 'Contacto de emergencia',
    plural: 'Contactos de emergencia',
    emoji: '🆘',
    archivo: false,
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', max: 160, requerido: true },
      { clave: 'parentesco', etiqueta: 'Parentesco', max: 60 },
      { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', max: 20, requerido: true },
      { clave: 'telefono2', etiqueta: 'Otro teléfono', tipo: 'tel', max: 20 },
    ],
  },
  documento: {
    etiqueta: 'Documento',
    plural: 'Documentos',
    emoji: '📁',
    archivo: true,
    campos: [
      {
        clave: 'nombre',
        etiqueta: 'Documento',
        tipo: 'select',
        requerido: true,
        opciones: ['INE', 'CURP', 'Acta de nacimiento', 'Comprobante de domicilio', 'Título', 'Cédula profesional', 'Constancia de situación fiscal', 'Certificado médico', 'Carta de antecedentes no penales', 'Contrato', 'Otro'],
      },
      { clave: 'notas', etiqueta: 'Notas', max: 300 },
      { clave: 'vence', etiqueta: 'Vence (si aplica)', tipo: 'date' },
    ],
  },
}

export type TeExpedienteItem = {
  id: number
  maestro_id: number
  tipo: TipoItemExpediente
  datos: Record<string, string>
  archivo_key: string | null
  archivo_nombre: string | null
  registrado_por: string | null
  updated_at: string
}

export type TeExpediente = {
  maestro_id: number
  general: Record<string, string>
  actualizado: string | null
  actualizado_por: string | null
  items: TeExpedienteItem[]
}

export type TeDirectorioFila = {
  maestro_id: number
  general: Record<string, string>
  items: Partial<Record<TipoItemExpediente, number>>
}

/** % de campos generales capturados + al menos un registro de formación, contacto de emergencia y documento. */
export function completitudExpediente(general: Record<string, string>, items: Partial<Record<TipoItemExpediente, number>>, conCv: boolean): number {
  const llenos = CAMPOS_GENERALES.filter((c) => String(general[c.clave] ?? '').trim()).length
  const extras = [conCv, (items.formacion ?? 0) > 0, (items.contacto ?? 0) > 0, (items.documento ?? 0) > 0].filter(Boolean).length
  return Math.round(((llenos + extras) / (CAMPOS_GENERALES.length + 4)) * 100)
}

export function tituloItem(it: Pick<TeExpedienteItem, 'tipo' | 'datos'>): { titulo: string; detalle: string } {
  const d = it.datos
  const j = (...xs: (string | undefined)[]) => xs.filter((x) => x && x.trim()).join(' · ')
  switch (it.tipo) {
    case 'formacion':
      return { titulo: j(d.grado, d.carrera), detalle: j(d.institucion, d.anio, d.estatus, d.cedula ? `Cédula ${d.cedula}` : '') }
    case 'certificacion':
      return { titulo: d.nombre ?? '', detalle: j(d.emisor, d.resultado, d.fecha ? `obtenida ${d.fecha}` : '', d.vigencia ? `vigente hasta ${d.vigencia}` : '') }
    case 'experiencia':
      return { titulo: j(d.puesto, d.institucion), detalle: j(d.desde && `${d.desde} – ${d.hasta || 'actual'}`, d.descripcion) }
    case 'contacto':
      return { titulo: j(d.nombre, d.parentesco), detalle: j(d.telefono, d.telefono2) }
    case 'documento':
      return { titulo: d.nombre ?? '', detalle: j(d.notas, d.vence ? `vence ${d.vence}` : '') }
  }
}
