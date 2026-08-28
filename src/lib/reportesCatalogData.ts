import type { ReporteAccent } from '@/app/reportes/reportesCatalog'

export type NivelId = 'maternal' | 'kinder' | 'primaria' | 'secundaria'

export const NIVELES: { id: NivelId; label: string }[] = [
  { id: 'maternal', label: 'Maternal' },
  { id: 'kinder', label: 'Kinder' },
  { id: 'primaria', label: 'Primaria' },
  { id: 'secundaria', label: 'Secundaria' },
]

export type ReporteMotor = 'api-next'

export type ReporteCatalogEntry = {
  id: string
  categoriaId: string
  titulo: string
  descripcion: string
  accent: ReporteAccent
  motor: ReporteMotor
  keywords: string[]
  requiereNivel?: boolean
  /** Subconjunto de niveles en el select (por defecto todos). */
  nivelesOpciones?: NivelId[]
  /** Nivel inicial del tile cuando requiereNivel. */
  nivelInicial?: NivelId
  /** Ciclo mostrado en UI / APIs nativas */
  usaCiclo?: 'escolar' | 'inscripcion' | 'libre'
  /**
   * Sin select de ciclo en el tile: usa el ciclo de temporada/sistema
   * (como el link PHP legacy sin query params).
   */
  cicloSistema?: boolean
  /** Selectores de mes y año calendario (legacy nuevoIngresoxmes). */
  requiereMes?: boolean
  /** Ruta API bajo /api/reportes/{slug} */
  apiSlug?: string
}

export type ReporteCategoria = {
  id: string
  titulo: string
  subtitulo?: string
  orden: number
}

export const REPORTE_CATEGORIAS: ReporteCategoria[] = [
  {
    id: 'mis-reportes',
    titulo: 'Mis reportes',
    subtitulo: 'Inscripciones admin · matriz RI / NI (sin filtro de nivel)',
    orden: 0,
  },
  {
    id: 'deudores',
    titulo: 'Deudores',
    subtitulo: '1 mes y suspendidos · Winston / Educativo',
    orden: 1,
  },
  {
    id: 'nuevo-ingreso',
    titulo: 'Nuevo ingreso',
    subtitulo: 'Reporte completo y pendientes de inscripción · elige el ciclo',
    orden: 2,
  },
  {
    id: 'reinscritos',
    titulo: 'Reinscritos',
    subtitulo: '1 pago y 2 pagos',
    orden: 3,
  },
  {
    id: 'cuota-inicio',
    titulo: 'Cuota de inicio de curso',
    subtitulo: 'Todos los niveles · pagados · recargo · deudores',
    orden: 4,
  },
  {
    id: 'nuevo-ingreso-mes',
    titulo: 'Nuevo ingreso por mes',
    subtitulo: 'Mes + año + nivel · fecha de agenda (cita de admisión)',
    orden: 5,
  },
  { id: 'becados', titulo: 'Becados Winston', orden: 6 },
  {
    id: 'reportes-especiales',
    titulo: 'Reportes especiales',
    subtitulo: 'Doble titulación y reportes de ciclo histórico',
    orden: 7,
  },
  {
    id: 'curp',
    titulo: 'CURP y datos personales',
    subtitulo: 'CURP · reporte de aseguradoras por nivel',
    orden: 8,
  },
  { id: 'listas', titulo: 'Listas de alumnos', orden: 9 },
  { id: 'bajas', titulo: 'Bajas por nivel', orden: 10 },
  { id: 'otros', titulo: 'Otros reportes', orden: 11 },
]

export function apiPathReporte(entry: ReporteCatalogEntry): string | null {
  if (entry.motor !== 'api-next') return null
  // insc-admin-dif2: desde Reportes va a la API (sesión de staff, sin clave).
  // La URL pública del jefe (/dif2) mantiene el modal de contraseña.
  const slug = entry.apiSlug ?? entry.id
  return `/api/reportes/${slug}`
}

export const REPORTE_ENTRADAS: ReporteCatalogEntry[] = [
  // Mis reportes (inicio)
  {
    id: 'insc-admin-dif1',
    categoriaId: 'mis-reportes',
    titulo: 'Inscripciones admin (1er. diferido)',
    descripcion:
      'Matriz legada inscripcionesreales.php — RI y NI por grado (todo el colegio). Pagos 11/13.',
    accent: 'amber',
    motor: 'api-next',
    usaCiclo: 'inscripcion',
    cicloSistema: true,
    keywords: ['inscripciones', 'diferido 1', 'admin', 'reales', 'inicio'],
  },
  {
    id: 'insc-admin-dif2',
    categoriaId: 'mis-reportes',
    titulo: 'Inscripciones admin (2do. diferido)',
    descripcion:
      'Matriz legada inscripcionesreales2.php — RI y NI por grado (todo el colegio). Pagos 12/13.',
    accent: 'amber',
    motor: 'api-next',
    usaCiclo: 'inscripcion',
    cicloSistema: true,
    keywords: ['inscripciones', 'diferido 2', 'admin', 'reales', 'inicio'],
  },
  // CURP y datos personales
  {
    id: 'curp',
    categoriaId: 'curp',
    titulo: 'CURP',
    descripcion: 'Listado de CURP por nivel (InsForge).',
    accent: 'sky',
    motor: 'api-next',
    requiereNivel: true,
    usaCiclo: 'escolar',
    keywords: ['curp', 'clave'],
  },
  {
    id: 'nacimiento-sexo',
    categoriaId: 'curp',
    titulo: 'Reporte de aseguradoras',
    descripcion:
      'Alumnos activos por nivel, agrupados por grado: nombre, fecha de nacimiento, sexo y CURP.',
    accent: 'indigo',
    motor: 'api-next',
    requiereNivel: true,
    usaCiclo: 'escolar',
    keywords: ['nacimiento', 'sexo', 'fecha', 'grado', 'datos', 'curp'],
  },
  // Listas
  {
    id: 'alumnos-lista',
    categoriaId: 'listas',
    titulo: 'Lista de alumnos',
    descripcion: 'Alumnos activos del ciclo por nivel.',
    accent: 'emerald',
    motor: 'api-next',
    requiereNivel: true,
    usaCiclo: 'escolar',
    keywords: ['lista', 'alumnos', 'activos'],
  },
  // Nuevo ingreso (ciclo en el select)
  {
    id: 'ni-completo',
    categoriaId: 'nuevo-ingreso',
    titulo: 'Nuevo ingreso — reporte completo',
    descripcion:
      'Alumnos de nuevo ingreso del ciclo (contactos mamá/papá y resumen por grado). Destaca sin pago de inscripción.',
    accent: 'violet',
    motor: 'api-next',
    requiereNivel: true,
    usaCiclo: 'escolar',
    keywords: ['nuevo', 'ingreso', 'completo'],
  },
  {
    id: 'ni-deben',
    categoriaId: 'nuevo-ingreso',
    titulo: 'Nuevo ingreso — deben inscripción',
    descripcion: 'Nuevo ingreso del ciclo seleccionado sin pago de inscripción (13).',
    accent: 'violet',
    motor: 'api-next',
    requiereNivel: true,
    usaCiclo: 'escolar',
    keywords: ['nuevo', 'ingreso', 'deben', 'pendiente', 'inscripcion'],
  },
  // Reinscritos
  {
    id: 'reinscritos-1',
    categoriaId: 'reinscritos',
    titulo: 'Reinscritos — 1 pago',
    descripcion:
      'Primer diferido / pago único de reinscripción. Incluye pendientes (SIN PAGO) y totales por grado.',
    accent: 'amber',
    motor: 'api-next',
    requiereNivel: true,
    usaCiclo: 'inscripcion',
    keywords: ['reinscritos', '1 pago', 'diferido 1'],
  },
  {
    id: 'reinscritos-2',
    categoriaId: 'reinscritos',
    titulo: 'Reinscritos — 2 pagos',
    descripcion:
      'Segundo diferido; muestra 1er/2do dif, plan de meses, pendientes y totales por grado.',
    accent: 'amber',
    motor: 'api-next',
    requiereNivel: true,
    usaCiclo: 'inscripcion',
    keywords: ['reinscritos', '2 pagos', 'diferido 2'],
  },
  // Becados
  {
    id: 'becados',
    categoriaId: 'becados',
    titulo: 'Becados Promedio > 9',
    descripcion:
      'Kinder, Primaria y Secundaria. Winston + SEP. Promedio ≥ 9 del ciclo de datos (= grado anterior a la ficha: 1°←K3, 7mo←6°, …). Grado mostrado: ficha actual.',
    accent: 'rose',
    motor: 'api-next',
    requiereNivel: true,
    nivelesOpciones: ['kinder', 'primaria', 'secundaria'],
    nivelInicial: 'kinder',
    usaCiclo: 'libre',
    keywords: ['becados', 'beca', 'promedio', 'winston', 'sep', 'kinder'],
  },
  // Bajas
  {
    id: 'bajas',
    categoriaId: 'bajas',
    titulo: 'Bajas por nivel',
    descripcion: 'Alumnos de baja con fecha y correo de contacto.',
    accent: 'rose',
    motor: 'api-next',
    requiereNivel: true,
    usaCiclo: 'escolar',
    apiSlug: 'bajas',
    keywords: ['bajas', 'maternal', 'kinder', 'primaria', 'secundaria'],
  },
  // Otros (sin nivel)
  {
    id: 'cambridge',
    categoriaId: 'otros',
    titulo: 'Cambridge',
    descripcion: 'Reporte Cambridge.',
    accent: 'sky',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['cambridge'],
  },
  {
    id: 'talleres',
    categoriaId: 'otros',
    titulo: 'Talleres',
    descripcion: 'Inscripciones a talleres.',
    accent: 'sky',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['talleres'],
  },
  {
    id: 'deudores-iwch-1mes',
    categoriaId: 'deudores',
    titulo: 'Deudores 1 mes — Winston',
    descripcion:
      'Desde 1 colegiatura pendiente (IWC). Respeta plan 10 meses (hasta jun) u 11 (hasta jul).',
    accent: 'amber',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['deudores', 'iwch', 'winston', '1 mes', 'modalidad'],
  },
  {
    id: 'deudores-iew-1mes',
    categoriaId: 'deudores',
    titulo: 'Deudores 1 mes — Educativo',
    descripcion:
      'Desde 1 colegiatura pendiente (IEW). Respeta plan 10 meses (hasta jun) u 11 (hasta jul).',
    accent: 'amber',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['deudores', 'iew', 'educativo', '1 mes', 'modalidad'],
  },
  {
    id: 'suspendidos-iwc',
    categoriaId: 'deudores',
    titulo: 'Suspendidos — Winston',
    descripcion:
      '2 o más adeudos (IWC). Incluye modalidad 10/11 meses y colores por plan.',
    accent: 'rose',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['suspendidos', 'iwc', 'winston', 'deudores', 'modalidad'],
  },
  {
    id: 'suspendidos-iew',
    categoriaId: 'deudores',
    titulo: 'Suspendidos — Educativo',
    descripcion:
      '2 o más adeudos (IEW). Incluye modalidad 10/11 meses y colores por plan.',
    accent: 'rose',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['suspendidos', 'iew', 'educativo', 'deudores', 'modalidad'],
  },
  {
    id: 'inscripciones',
    categoriaId: 'otros',
    titulo: 'Inscripciones',
    descripcion: 'Reporte general de inscripciones.',
    accent: 'sky',
    motor: 'api-next',
    usaCiclo: 'inscripcion',
    keywords: ['inscripciones'],
  },
  {
    id: 'cuota-fecha',
    categoriaId: 'otros',
    titulo: 'Cuota de padres por fecha',
    descripcion: 'Cálculo de cuota de padres por fecha.',
    accent: 'sky',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['cuota', 'padres', 'fecha'],
  },
  {
    id: 'reinscritos-kinder-pend',
    categoriaId: 'otros',
    titulo: 'Reinscritos sin pago (Kinder)',
    descripcion: 'Reinscritos Kinder que no han pagado.',
    accent: 'amber',
    motor: 'api-next',
    usaCiclo: 'inscripcion',
    keywords: ['reinscritos', 'kinder', 'pendiente'],
  },
  {
    id: 'cuota-padres-general',
    categoriaId: 'otros',
    titulo: 'Cuota de padres general',
    descripcion: 'Cuota de padres — Primaria.',
    accent: 'amber',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['cuota', 'padres'],
  },
  {
    id: 'ems',
    categoriaId: 'otros',
    titulo: 'Herramientas, material y seguro',
    descripcion: 'Reporte EMS / material escolar.',
    accent: 'emerald',
    motor: 'api-next',
    usaCiclo: 'inscripcion',
    keywords: ['ems', 'material', 'seguro'],
  },
  {
    id: 'doble-titulacion',
    categoriaId: 'reportes-especiales',
    titulo: 'Doble titulación',
    descripcion: 'Alumnos con pagos 23/24/25 del ciclo seleccionado (Winston USA).',
    accent: 'emerald',
    motor: 'api-next',
    usaCiclo: 'libre',
    keywords: ['doble', 'titulacion', 'especiales', 'usa'],
  },
  {
    id: 'cuota-inicio-curso',
    categoriaId: 'cuota-inicio',
    titulo: 'Adeudo cuota de inicio',
    descripcion:
      'Un solo reporte con Maternal, Kinder, Primaria y Secundaria: quiénes pagaron la cuota 00 (monto y recargo aparte) y quiénes deben.',
    accent: 'sky',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: [
      'cuota',
      'inicio',
      'curso',
      '00',
      'adeudo',
      'recargo',
      'pagaron',
      'deben',
      'niveles',
    ],
  },
  {
    id: 'nuevo-ingreso-mes',
    categoriaId: 'nuevo-ingreso-mes',
    titulo: 'Nuevo ingreso por mes',
    descripcion:
      'Nuevos ingresos del mes: reserva AgendaW (created_at) o, sin cita en portal, mes de alta en Winston.',
    accent: 'violet',
    motor: 'api-next',
    usaCiclo: 'escolar',
    requiereNivel: true,
    requiereMes: true,
    nivelInicial: 'primaria',
    keywords: ['nuevo ingreso', 'mes', 'agenda', 'cita', 'admision', 'mensual'],
  },
  {
    id: 'familias-winston',
    categoriaId: 'otros',
    titulo: 'Familias Winston',
    descripcion: 'Alumnos por niveles — familias Winston.',
    accent: 'indigo',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['familias', 'winston'],
  },
  {
    id: 'becados-sexto',
    categoriaId: 'otros',
    titulo: 'Becados de sexto año',
    descripcion: 'Primaria 6° con beca Winston (legacy becadosSextoPrimaria).',
    accent: 'rose',
    motor: 'api-next',
    usaCiclo: 'escolar',
    keywords: ['becados', 'sexto', 'sexto año', '6', 'primaria'],
  },
]
