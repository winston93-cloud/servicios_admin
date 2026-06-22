import type { ReporteAccent } from '@/app/reportes/reportesCatalog'

export type NivelId = 'maternal' | 'kinder' | 'primaria' | 'secundaria'

export const NIVELES: { id: NivelId; label: string }[] = [
  { id: 'maternal', label: 'Maternal' },
  { id: 'kinder', label: 'Kinder' },
  { id: 'primaria', label: 'Primaria' },
  { id: 'secundaria', label: 'Secundaria' },
]

export type ReporteMotor = 'api-next' | 'pendiente'

export type ReporteCatalogEntry = {
  id: string
  categoriaId: string
  titulo: string
  descripcion: string
  accent: ReporteAccent
  motor: ReporteMotor
  keywords: string[]
  requiereNivel?: boolean
  /** Ciclo mostrado en UI / APIs nativas */
  usaCiclo?: 'escolar' | 'inscripcion' | 'libre'
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
  { id: 'curp', titulo: 'CURP', orden: 1 },
  { id: 'listas', titulo: 'Listas de alumnos', orden: 2 },
  {
    id: 'nuevo-ingreso-actual',
    titulo: 'Nuevo ingreso — ciclo en curso',
    subtitulo: 'Reporte completo y pendientes de inscripción',
    orden: 3,
  },
  {
    id: 'nuevo-ingreso-siguiente',
    titulo: 'Nuevo ingreso — próximo ciclo',
    subtitulo: 'Reporte completo y no han pagado inscripción',
    orden: 4,
  },
  { id: 'reinscritos', titulo: 'Reinscritos', subtitulo: '1 pago y 2 pagos', orden: 5 },
  { id: 'becados', titulo: 'Becados Winston', orden: 6 },
  { id: 'bajas', titulo: 'Bajas por nivel', orden: 7 },
  { id: 'otros', titulo: 'Otros reportes', orden: 8 },
]

export function apiPathReporte(entry: ReporteCatalogEntry): string | null {
  if (entry.motor !== 'api-next') return null
  const slug = entry.apiSlug ?? entry.id
  return `/api/reportes/${slug}`
}

export const REPORTE_ENTRADAS: ReporteCatalogEntry[] = [
  // CURP
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
  // Nuevo ingreso actual
  {
    id: 'ni-completo-actual',
    categoriaId: 'nuevo-ingreso-actual',
    titulo: 'Nuevo ingreso — reporte completo',
    descripcion: 'Nuevo ingreso del ciclo escolar en curso.',
    accent: 'violet',
    motor: 'pendiente',
    requiereNivel: true,
    usaCiclo: 'escolar',
    keywords: ['nuevo', 'ingreso', 'completo'],
  },
  {
    id: 'ni-deben-actual',
    categoriaId: 'nuevo-ingreso-actual',
    titulo: 'Nuevo ingreso — deben inscripción',
    descripcion: 'Nuevo ingreso del ciclo en curso sin inscripción pagada.',
    accent: 'violet',
    motor: 'pendiente',
    requiereNivel: true,
    usaCiclo: 'escolar',
    keywords: ['nuevo', 'ingreso', 'deben', 'pendiente'],
  },
  // Nuevo ingreso siguiente ciclo
  {
    id: 'ni-completo-sig',
    categoriaId: 'nuevo-ingreso-siguiente',
    titulo: 'Nuevo ingreso — reporte completo',
    descripcion: 'Nuevo ingreso hacia el próximo ciclo escolar.',
    accent: 'indigo',
    motor: 'pendiente',
    requiereNivel: true,
    usaCiclo: 'inscripcion',
    keywords: ['nuevo', 'ingreso', 'siguiente'],
  },
  {
    id: 'ni-deben-sig',
    categoriaId: 'nuevo-ingreso-siguiente',
    titulo: 'No han pagado inscripción',
    descripcion: 'Nuevo ingreso del próximo ciclo sin pago de inscripción.',
    accent: 'indigo',
    motor: 'pendiente',
    requiereNivel: true,
    usaCiclo: 'inscripcion',
    keywords: ['nuevo', 'ingreso', 'deben', 'inscripcion'],
  },
  // Reinscritos
  {
    id: 'reinscritos-1',
    categoriaId: 'reinscritos',
    titulo: 'Reinscritos — 1 pago',
    descripcion: 'Primer diferido / primer pago de reinscripción.',
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
    descripcion: 'Segundo diferido; incluye 1er dif, 2do dif y plan de meses.',
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
    titulo: 'Alumnos becados',
    descripcion: 'Becas activas por ciclo — HTML/PDF nativo (InsForge).',
    accent: 'rose',
    motor: 'api-next',
    usaCiclo: 'libre',
    keywords: ['becados', 'beca', 'insforge'],
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
    motor: 'pendiente',
    keywords: ['cambridge'],
  },
  {
    id: 'talleres',
    categoriaId: 'otros',
    titulo: 'Talleres',
    descripcion: 'Inscripciones a talleres.',
    accent: 'sky',
    motor: 'pendiente',
    keywords: ['talleres'],
  },
  {
    id: 'suspendidos-iwc',
    categoriaId: 'otros',
    titulo: 'Suspendidos IWC',
    descripcion: 'Deudores / suspendidos IWC.',
    accent: 'sky',
    motor: 'pendiente',
    keywords: ['suspendidos', 'iwc', 'deudores'],
  },
  {
    id: 'suspendidos-iew',
    categoriaId: 'otros',
    titulo: 'Suspendidos IEW',
    descripcion: 'Deudores / suspendidos IEW.',
    accent: 'sky',
    motor: 'pendiente',
    keywords: ['suspendidos', 'iew'],
  },
  {
    id: 'inscripciones',
    categoriaId: 'otros',
    titulo: 'Inscripciones',
    descripcion: 'Reporte general de inscripciones.',
    accent: 'sky',
    motor: 'pendiente',
    keywords: ['inscripciones'],
  },
  {
    id: 'cuota-fecha',
    categoriaId: 'otros',
    titulo: 'Cuota de padres por fecha',
    descripcion: 'Cálculo de cuota de padres por fecha.',
    accent: 'sky',
    motor: 'pendiente',
    keywords: ['cuota', 'padres', 'fecha'],
  },
  {
    id: 'deudores-iew-1mes',
    categoriaId: 'otros',
    titulo: 'Deudores 1 mes IEW',
    descripcion: 'Deudores de un mes IEW.',
    accent: 'sky',
    motor: 'pendiente',
    keywords: ['deudores', 'iew'],
  },
  {
    id: 'deudores-iwch-1mes',
    categoriaId: 'otros',
    titulo: 'Deudores 1 mes IWCH',
    descripcion: 'Deudores de un mes IWCH.',
    accent: 'sky',
    motor: 'pendiente',
    keywords: ['deudores', 'iwch'],
  },
  {
    id: 'reinscritos-kinder-pend',
    categoriaId: 'otros',
    titulo: 'Reinscritos sin pago (Kinder)',
    descripcion: 'Reinscritos Kinder que no han pagado.',
    accent: 'amber',
    motor: 'pendiente',
    keywords: ['reinscritos', 'kinder', 'pendiente'],
  },
  {
    id: 'cuota-padres-general',
    categoriaId: 'otros',
    titulo: 'Cuota de padres general',
    descripcion: 'Cuota de padres — Primaria.',
    accent: 'amber',
    motor: 'pendiente',
    keywords: ['cuota', 'padres'],
  },
  {
    id: 'insc-admin-dif1',
    categoriaId: 'otros',
    titulo: 'Inscripciones admin (1er. diferido)',
    descripcion: 'Inscripciones reales — primer diferido.',
    accent: 'amber',
    motor: 'pendiente',
    keywords: ['inscripciones', 'diferido 1', 'admin'],
  },
  {
    id: 'insc-admin-dif2',
    categoriaId: 'otros',
    titulo: 'Inscripciones admin (2do. diferido)',
    descripcion: 'Inscripciones reales — segundo diferido.',
    accent: 'amber',
    motor: 'pendiente',
    keywords: ['inscripciones', 'diferido 2', 'admin'],
  },
  {
    id: 'ems',
    categoriaId: 'otros',
    titulo: 'Herramientas, material y seguro',
    descripcion: 'Reporte EMS / material escolar.',
    accent: 'emerald',
    motor: 'pendiente',
    keywords: ['ems', 'material', 'seguro'],
  },
  {
    id: 'doble-titulacion',
    categoriaId: 'otros',
    titulo: 'Doble titulación',
    descripcion: 'Alumnos en doble titulación.',
    accent: 'emerald',
    motor: 'pendiente',
    keywords: ['doble', 'titulacion'],
  },
  {
    id: 'nuevo-ingreso-mes',
    categoriaId: 'otros',
    titulo: 'Nuevo ingreso por mes',
    descripcion: 'Reporte por mes (nuevo ingreso).',
    accent: 'violet',
    motor: 'pendiente',
    keywords: ['nuevo ingreso', 'mes'],
  },
  {
    id: 'familias-winston',
    categoriaId: 'otros',
    titulo: 'Familias Winston',
    descripcion: 'Alumnos por niveles — familias Winston.',
    accent: 'indigo',
    motor: 'pendiente',
    keywords: ['familias', 'winston'],
  },
]
