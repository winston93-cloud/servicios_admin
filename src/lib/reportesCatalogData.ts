import type { ReporteAccent } from '@/app/reportes/reportesCatalog'

export type NivelId = 'maternal' | 'kinder' | 'primaria' | 'secundaria'

export const NIVELES: { id: NivelId; label: string }[] = [
  { id: 'maternal', label: 'Maternal' },
  { id: 'kinder', label: 'Kinder' },
  { id: 'primaria', label: 'Primaria' },
  { id: 'secundaria', label: 'Secundaria' },
]

const NIVEL_SUFFIX: Record<NivelId, string> = {
  maternal: 'Maternal',
  kinder: 'Kinder',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

export type ReporteMotor = 'legacy-php' | 'api-next' | 'static-pdf'

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
  legacyFile?: string | ((nivel: NivelId) => string)
  apiPath?: string
  staticPath?: string
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
  { id: 'nativos', titulo: 'Reportes nativos (InsForge)', subtitulo: 'Generados en Servicios Admin', orden: 9 },
]

function porNivel(base: string): (nivel: NivelId) => string {
  return (nivel) => `${base}${NIVEL_SUFFIX[nivel]}.php`
}

export const REPORTE_ENTRADAS: ReporteCatalogEntry[] = [
  // CURP
  {
    id: 'curp',
    categoriaId: 'curp',
    titulo: 'CURP',
    descripcion: 'Listado de CURP por nivel.',
    accent: 'sky',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'escolar',
    legacyFile: porNivel('curp'),
    keywords: ['curp', 'clave'],
  },
  // Listas
  {
    id: 'alumnos-lista',
    categoriaId: 'listas',
    titulo: 'Lista de alumnos',
    descripcion: 'Alumnos activos del ciclo en curso por nivel.',
    accent: 'emerald',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'escolar',
    legacyFile: porNivel('alumnos'),
    keywords: ['lista', 'alumnos', 'activos'],
  },
  // Nuevo ingreso actual
  {
    id: 'ni-completo-actual',
    categoriaId: 'nuevo-ingreso-actual',
    titulo: 'Nuevo ingreso — reporte completo',
    descripcion: 'Nuevo ingreso del ciclo escolar en curso.',
    accent: 'violet',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'escolar',
    legacyFile: (nivel) => `nuevoIngreso${NIVEL_SUFFIX[nivel]}actual.php`,
    keywords: ['nuevo', 'ingreso', 'completo'],
  },
  {
    id: 'ni-deben-actual',
    categoriaId: 'nuevo-ingreso-actual',
    titulo: 'Nuevo ingreso — deben inscripción',
    descripcion: 'Nuevo ingreso del ciclo en curso sin inscripción pagada.',
    accent: 'violet',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'escolar',
    legacyFile: (nivel) => `nuevoIngresoDebenInsc${NIVEL_SUFFIX[nivel]}actual.php`,
    keywords: ['nuevo', 'ingreso', 'deben', 'pendiente'],
  },
  // Nuevo ingreso siguiente ciclo
  {
    id: 'ni-completo-sig',
    categoriaId: 'nuevo-ingreso-siguiente',
    titulo: 'Nuevo ingreso — reporte completo',
    descripcion: 'Nuevo ingreso hacia el próximo ciclo escolar.',
    accent: 'indigo',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'inscripcion',
    legacyFile: porNivel('nuevoIngreso'),
    keywords: ['nuevo', 'ingreso', 'siguiente'],
  },
  {
    id: 'ni-deben-sig',
    categoriaId: 'nuevo-ingreso-siguiente',
    titulo: 'No han pagado inscripción',
    descripcion: 'Nuevo ingreso del próximo ciclo sin pago de inscripción.',
    accent: 'indigo',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'inscripcion',
    legacyFile: porNivel('nuevoIngresoDebenInsc'),
    keywords: ['nuevo', 'ingreso', 'deben', 'inscripcion'],
  },
  // Reinscritos
  {
    id: 'reinscritos-1',
    categoriaId: 'reinscritos',
    titulo: 'Reinscritos — 1 pago',
    descripcion: 'Primer diferido / primer pago de reinscripción.',
    accent: 'amber',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'inscripcion',
    legacyFile: porNivel('reinscritos1pago'),
    keywords: ['reinscritos', '1 pago', 'diferido 1'],
  },
  {
    id: 'reinscritos-2',
    categoriaId: 'reinscritos',
    titulo: 'Reinscritos — 2 pagos',
    descripcion: 'Segundo diferido; incluye 1er dif, 2do dif y plan de meses.',
    accent: 'amber',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'inscripcion',
    legacyFile: porNivel('reinscritos2pagos'),
    keywords: ['reinscritos', '2 pagos', 'diferido 2'],
  },
  // Becados legacy por nivel
  {
    id: 'becados-legacy',
    categoriaId: 'becados',
    titulo: 'Becados (PDF legacy)',
    descripcion: 'Reporte PDF del portal PHP por nivel.',
    accent: 'rose',
    motor: 'legacy-php',
    requiereNivel: true,
    usaCiclo: 'escolar',
    legacyFile: porNivel('becados'),
    keywords: ['becados', 'beca', 'legacy'],
  },
  // Bajas
  {
    id: 'bajas-maternal',
    categoriaId: 'bajas',
    titulo: 'Bajas Maternal',
    descripcion: 'Alumnos de baja en Maternal.',
    accent: 'rose',
    motor: 'legacy-php',
    usaCiclo: 'escolar',
    legacyFile: 'bajas_maternal.php',
    keywords: ['bajas', 'maternal'],
  },
  {
    id: 'bajas-kinder',
    categoriaId: 'bajas',
    titulo: 'Bajas Kinder',
    descripcion: 'Alumnos de baja en Kinder.',
    accent: 'rose',
    motor: 'legacy-php',
    usaCiclo: 'escolar',
    legacyFile: 'bajas_kinder.php',
    keywords: ['bajas', 'kinder'],
  },
  {
    id: 'bajas-primaria',
    categoriaId: 'bajas',
    titulo: 'Bajas Primaria',
    descripcion: 'Alumnos de baja en Primaria.',
    accent: 'rose',
    motor: 'legacy-php',
    usaCiclo: 'escolar',
    legacyFile: 'bajas_primaria.php',
    keywords: ['bajas', 'primaria'],
  },
  {
    id: 'bajas-secundaria',
    categoriaId: 'bajas',
    titulo: 'Bajas Secundaria',
    descripcion: 'Alumnos de baja en Secundaria.',
    accent: 'rose',
    motor: 'legacy-php',
    usaCiclo: 'escolar',
    legacyFile: 'bajas_secundaria.php',
    keywords: ['bajas', 'secundaria'],
  },
  // Otros (sin nivel)
  {
    id: 'cambridge',
    categoriaId: 'otros',
    titulo: 'Cambridge',
    descripcion: 'Reporte Cambridge.',
    accent: 'sky',
    motor: 'legacy-php',
    legacyFile: 'Cambridge.php',
    keywords: ['cambridge'],
  },
  {
    id: 'talleres',
    categoriaId: 'otros',
    titulo: 'Talleres',
    descripcion: 'Inscripciones a talleres.',
    accent: 'sky',
    motor: 'legacy-php',
    legacyFile: 'talleres.php',
    keywords: ['talleres'],
  },
  {
    id: 'suspendidos-iwc',
    categoriaId: 'otros',
    titulo: 'Suspendidos IWC',
    descripcion: 'Deudores / suspendidos IWC.',
    accent: 'sky',
    motor: 'legacy-php',
    legacyFile: 'deudores2pagosIWC.php',
    keywords: ['suspendidos', 'iwc', 'deudores'],
  },
  {
    id: 'suspendidos-iew',
    categoriaId: 'otros',
    titulo: 'Suspendidos IEW',
    descripcion: 'Deudores / suspendidos IEW.',
    accent: 'sky',
    motor: 'legacy-php',
    legacyFile: 'deudores2pagosIEW.php',
    keywords: ['suspendidos', 'iew'],
  },
  {
    id: 'inscripciones',
    categoriaId: 'otros',
    titulo: 'Inscripciones',
    descripcion: 'Reporte general de inscripciones.',
    accent: 'sky',
    motor: 'legacy-php',
    legacyFile: 'inscritos.php',
    keywords: ['inscripciones'],
  },
  {
    id: 'cuota-fecha',
    categoriaId: 'otros',
    titulo: 'Cuota de padres por fecha',
    descripcion: 'Cálculo de cuota de padres por fecha.',
    accent: 'sky',
    motor: 'legacy-php',
    legacyFile: 'calculo.php',
    keywords: ['cuota', 'padres', 'fecha'],
  },
  {
    id: 'deudores-iew-1mes',
    categoriaId: 'otros',
    titulo: 'Deudores 1 mes IEW',
    descripcion: 'Deudores de un mes IEW.',
    accent: 'sky',
    motor: 'legacy-php',
    legacyFile: 'calculode.php',
    keywords: ['deudores', 'iew'],
  },
  {
    id: 'deudores-iwch-1mes',
    categoriaId: 'otros',
    titulo: 'Deudores 1 mes IWCH',
    descripcion: 'Deudores de un mes IWCH.',
    accent: 'sky',
    motor: 'legacy-php',
    legacyFile: 'calculodw.php',
    keywords: ['deudores', 'iwch'],
  },
  {
    id: 'reinscritos-kinder-pend',
    categoriaId: 'otros',
    titulo: 'Reinscritos sin pago (Kinder)',
    descripcion: 'Reinscritos Kinder que no han pagado.',
    accent: 'amber',
    motor: 'legacy-php',
    legacyFile: 'DIKinder.php',
    keywords: ['reinscritos', 'kinder', 'pendiente'],
  },
  {
    id: 'cuota-padres-general',
    categoriaId: 'otros',
    titulo: 'Cuota de padres general',
    descripcion: 'Cuota de padres — Primaria.',
    accent: 'amber',
    motor: 'legacy-php',
    legacyFile: 'primaria_cuota.php',
    keywords: ['cuota', 'padres'],
  },
  {
    id: 'insc-admin-dif1',
    categoriaId: 'otros',
    titulo: 'Inscripciones admin (1er. diferido)',
    descripcion: 'Inscripciones reales — primer diferido.',
    accent: 'amber',
    motor: 'legacy-php',
    legacyFile: 'inscripcionesreales.php',
    keywords: ['inscripciones', 'diferido 1', 'admin'],
  },
  {
    id: 'insc-admin-dif2',
    categoriaId: 'otros',
    titulo: 'Inscripciones admin (2do. diferido)',
    descripcion: 'Inscripciones reales — segundo diferido.',
    accent: 'amber',
    motor: 'legacy-php',
    legacyFile: 'inscripcionesreales2.php',
    keywords: ['inscripciones', 'diferido 2', 'admin'],
  },
  {
    id: 'ems',
    categoriaId: 'otros',
    titulo: 'Herramientas, material y seguro',
    descripcion: 'Reporte EMS / material escolar.',
    accent: 'emerald',
    motor: 'legacy-php',
    legacyFile: 'reporteEMS.php',
    keywords: ['ems', 'material', 'seguro'],
  },
  {
    id: 'doble-titulacion',
    categoriaId: 'otros',
    titulo: 'Doble titulación',
    descripcion: 'Alumnos en doble titulación.',
    accent: 'emerald',
    motor: 'legacy-php',
    legacyFile: 'doble.php',
    keywords: ['doble', 'titulacion'],
  },
  {
    id: 'nuevo-ingreso-mes',
    categoriaId: 'otros',
    titulo: 'Nuevo ingreso por mes',
    descripcion: 'Formulario de reporte por mes (nuevo ingreso).',
    accent: 'violet',
    motor: 'legacy-php',
    legacyFile: 'nuevoIngresoxmes_form.php',
    keywords: ['nuevo ingreso', 'mes'],
  },
  {
    id: 'familias-winston',
    categoriaId: 'otros',
    titulo: 'Familias Winston',
    descripcion: 'Alumnos por niveles — familias Winston.',
    accent: 'indigo',
    motor: 'legacy-php',
    legacyFile: 'alumnoGeneralNiveles.php',
    keywords: ['familias', 'winston'],
  },
  // Nativos Next.js
  {
    id: 'becados',
    categoriaId: 'nativos',
    titulo: 'Alumnos becados',
    descripcion: 'Becas activas (alumno_beca) por ciclo — HTML/PDF nativo.',
    accent: 'amber',
    motor: 'api-next',
    usaCiclo: 'libre',
    apiPath: '/api/reportes/becados',
    keywords: ['beca', 'becados', 'nativo', 'insforge'],
  },
  {
    id: 'alumnos-ciclo-pdf',
    categoriaId: 'nativos',
    titulo: 'Alumnos por ciclo (PDF)',
    descripcion: 'Listado PDF generado en Servicios Admin.',
    accent: 'violet',
    motor: 'static-pdf',
    usaCiclo: 'libre',
    staticPath: '/reportes/alumnos-ciclo-23.pdf',
    keywords: ['alumnos', 'ciclo', 'pdf'],
  },
]

export function resolveLegacyFile(
  entry: ReporteCatalogEntry,
  nivel: NivelId
): string | null {
  if (!entry.legacyFile) return null
  if (typeof entry.legacyFile === 'string') return entry.legacyFile
  return entry.legacyFile(nivel)
}
