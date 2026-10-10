import type { ReactNode } from 'react'
import type { DashboardModuleAccent } from '@/components/dashboard/DashboardModuleCard'
import { urlProrrogasAjustesApp } from '@/lib/prorrogasAjustesConfig'
import { urlCchicApp } from '@/lib/cchicConfig'
import { urlChequesApp, urlContratosApp, urlSsiwEntregaLogin, urlUsaProgramApp } from '@/lib/dashboardModulosConfig'
import { ACCESOS_USUARIOS_PERMITIDOS } from '@/lib/accesos/accesosTypes'
import { BENEFICIOS_EXTERNOS_USUARIOS } from '@/lib/beneficiosExternos/config'

export type DashboardAdminNavItem = {
  /** Clave estable para ACL de visualización en dashboard. */
  id: string
  label: string
  desc: string
  accent: DashboardModuleAccent
  icon: ReactNode
  path?: string
  href?: string
  kicker?: string
  badge?: string
  tags?: string[]
  featured?: boolean
  /** Si true, no se muestra en el dashboard (sigue en catálogo ACL). */
  dashboardHidden?: boolean
  /**
   * Usuarios sin `dashboard_modulos` en BD (mapa legado de ocultos) solo ven la tarjeta
   * si su usuario_id está aquí. Con lista en BD se asigna normal desde el catálogo de usuarios.
   */
  soloUsuariosLegacy?: readonly number[]
  /** Solo estos usuario_id la ven, aunque se asigne desde el catálogo de usuarios. */
  soloUsuarios?: readonly number[]
  /**
   * 2026-10-10 — Tarjeta fija para estos usuario_id: sale siempre en su dashboard,
   * sin depender de usuario.dashboard_modulos ni del catálogo (no es asignable).
   */
  fijoParaUsuarios?: readonly number[]
  /** 2026-10-10 — Si existe, la tarjeta abre este popup en el dashboard en lugar de navegar. */
  popup?: 'beneficios-externos-alumno'
}

const ICON_DESAYUNOS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10h16v2.5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V10z" />
    <path d="M7 10V7.5a2.5 2.5 0 0 1 5 0V10" />
    <path d="M19 10h1a2 2 0 0 1 0 4h-1" />
    <path d="M8 3.5v2" />
    <path d="M12 2.5v2.5" />
    <path d="M16 3.5v2" />
  </svg>
)

export const NAV_ITEMS_ADMIN: DashboardAdminNavItem[] = [
  {
    id: 'desayunos',
    label: 'Desayunos, Estancias y Comidas',
    desc: 'Cobros, pedidos y control de alimentación escolar en un solo flujo operativo.',
    path: '/pos',
    accent: 'amber',
    icon: ICON_DESAYUNOS,
    kicker: 'Punto de venta',
    tags: ['POS', 'Estancias', 'Comidas'],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    desc: 'Consulta y generación de reportes administrativos por ciclo y área.',
    path: '/reportes',
    accent: 'violet',
    kicker: 'Análisis',
    tags: ['PDF', 'Consultas', 'Exportar'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'servicios',
    label: 'Servicios',
    desc: 'Alumnos, pagos, becas y herramientas administrativas del ciclo escolar.',
    path: '/servicios',
    accent: 'indigo',
    kicker: 'Administración',
    tags: ['Alumnos', 'Pagos', 'Becas'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: 'prorrogas',
    label: 'Prórrogas',
    desc: 'Registro y seguimiento de prórrogas de pago escolar.',
    href: urlProrrogasAjustesApp(),
    accent: 'rose',
    kicker: 'Pagos',
    tags: ['Prórrogas'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="16" r="3" />
        <polyline points="12 14 12 16 13.5 17.5" />
      </svg>
    ),
  },
  {
    id: 'devoluciones',
    label: 'Devoluciones',
    desc: 'Reembolsos cuando el papá se arrepiente de un pago con tarjeta (inscripción, colegiatura u otro concepto).',
    path: '/devoluciones',
    accent: 'rose',
    kicker: 'Pagos',
    tags: ['Tarjeta', 'Inscripción', 'Colegiatura'],
    badge: 'Nuevo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <path d="M12 14v3" />
        <path d="M9.5 15.5 12 13l2.5 2.5" />
      </svg>
    ),
  },
  {
    id: 'notificaciones',
    label: 'Notificaciones',
    desc: 'Avisa a empleados por la campanita del dashboard y correo institucional.',
    path: '/notificaciones',
    accent: 'sky',
    kicker: 'Comunicación',
    tags: ['Empleados', 'Correo'],
    badge: 'Nuevo',
    /** Vive en /servicios (menú inferior); no en el dashboard. */
    dashboardHidden: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: 'checador',
    label: 'Checador',
    desc: 'Reloj checador de asistencia del personal.',
    href: 'https://reloj-checador-ruddy.vercel.app/',
    accent: 'indigo',
    kicker: 'Empleados',
    tags: ['Asistencia', 'Checadas'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    ),
  },
  {
    id: 'bajas',
    label: 'Bajas administrativas',
    desc: 'Baja general de alumnos y aviso por correo al equipo institucional.',
    path: '/bajas-administrativas',
    accent: 'rose',
    kicker: 'Alumnos',
    tags: ['Bajas', 'Estatus'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="17" y1="8" x2="22" y2="13" />
        <line x1="22" y1="8" x2="17" y2="13" />
      </svg>
    ),
  },
  {
    id: 'monitoreo',
    label: 'Monitoreo y Control',
    desc: 'Caja chica, egresos, fondos y reportes de control.',
    href: urlCchicApp(),
    accent: 'indigo',
    kicker: 'Finanzas',
    tags: ['Caja chica', 'Egresos'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
        <rect x="3" y="2" width="18" height="4" rx="1" />
        <path d="M7 6v2" />
        <path d="M12 6v2" />
        <path d="M17 6v2" />
      </svg>
    ),
  },
  {
    id: 'control-escolar',
    label: 'Control Escolar',
    desc: 'Autoriza documentación completa de nuevo ingreso y habilita el recibo final.',
    path: '/control-escolar',
    accent: 'sky',
    kicker: 'Inscripciones',
    tags: ['Documentos', 'Recibo final'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: 'programa-usa',
    label: 'Programa USA',
    desc: 'Alumnos, pagos en USD, cartas de bienvenida y expediente documental de Winston–Hökku Academy.',
    href: urlUsaProgramApp(),
    accent: 'sky',
    kicker: 'Winston USA Program',
    tags: ['Pagos USD', 'Expediente', 'Control Escolar'],
    badge: 'Nuevo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: 'agenda-psicologas',
    label: 'Agenda psicólogas',
    desc: 'Calendario y citas del área de psicología.',
    href: 'https://agendaw.vercel.app/admin/',
    accent: 'sky',
    kicker: 'Psicología',
    tags: ['Citas', 'Calendario'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M12 14v4" />
        <path d="M10 16h4" />
      </svg>
    ),
  },
  {
    id: 'agenda-directoras',
    label: 'Agenda directoras',
    desc: 'Panel de agenda para dirección escolar.',
    href: 'https://agendaw.vercel.app/admin/dashboard',
    accent: 'violet',
    kicker: 'Dirección',
    tags: ['Agenda', 'Coordinación'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M7 14h4" />
        <path d="M7 18h7" />
        <path d="M14 14h3" />
      </svg>
    ),
  },
  {
    id: 'open-house',
    label: 'Open House/Sesiones Inf. Admin',
    desc: 'Inscripciones y gestión de Open House y sesiones informativas.',
    href: 'https://open-house-chi.vercel.app/admin',
    accent: 'emerald',
    kicker: 'Admisiones',
    tags: ['Open House', 'Inscripciones'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
        <path d="M12 7v3" />
        <path d="M10.5 9.5h3" />
      </svg>
    ),
  },
  {
    id: 'facturacion',
    label: 'Facturación CFDI',
    desc: 'Timbrado, cancelaciones y devoluciones fiscales.',
    path: '/facturacion',
    accent: 'emerald',
    kicker: 'Fiscal',
    tags: ['Timbrado', 'CFDI', 'Cancelación'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h16v20l-4-2-4 2-4-2-4 2V2z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </svg>
    ),
  },
  {
    id: 'news-desayunos',
    label: 'News y Desayunos',
    desc: 'Publicar folleto mensual (News) y menú de desayunos/comidas para familias.',
    path: '/news-desayunos',
    accent: 'amber',
    kicker: 'Comunicación',
    tags: ['News', 'Menú', 'Familias'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8M8 11h6" />
        <path d="M8 15h4" />
        <circle cx="17" cy="7" r="2" />
      </svg>
    ),
  },
  {
    id: 'sat',
    label: 'Módulo SAT',
    desc: 'Descarga masiva de CFDI recibidos y conciliación fiscal.',
    path: '/facturacion/sat',
    accent: 'sky',
    kicker: 'Fiscal',
    tags: ['SAT', 'Recibidos', 'Conciliación'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    id: 'cheques',
    label: 'Cheques',
    desc: 'Emisión, impresión y control de cheques (Winston, Educativo y Sociedades de Padres).',
    href: urlChequesApp(),
    accent: 'sky',
    kicker: 'Tesorería',
    tags: ['Cheques', 'Pólizas', 'InsForge'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <line x1="6" y1="10" x2="18" y2="10" />
        <line x1="6" y1="14" x2="12" y2="14" />
      </svg>
    ),
  },
  {
    id: 'contratos',
    label: 'Contratos',
    desc: 'Generación y gestión de contratos laborales (determinado, indeterminado y por hora).',
    href: urlContratosApp(),
    accent: 'violet',
    kicker: 'RRHH',
    tags: ['Contratos', 'PDF', 'DOCX'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <line x1="10" y1="9" x2="12" y2="9" />
      </svg>
    ),
  },
  {
    id: 'boletas',
    label: 'Sistema Integral de Boletas Escolares',
    desc: 'Hub de boletas: Kinder y Primaria (español e inglés) y Secundaria.',
    path: '/boletas',
    accent: 'indigo',
    kicker: 'Control escolar',
    tags: ['Boletas', 'Kinder', 'Primaria', 'Secundaria'],
    badge: 'Nuevo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="8" y1="15" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    id: 'becas',
    label: 'Becas',
    desc: 'Renovaciones, solicitudes, permisos y bitácora de Control Escolar.',
    path: '/becas',
    accent: 'amber',
    kicker: 'Becas',
    tags: ['Revisión', 'Control Escolar'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: 'becarios',
    label: 'Becarios',
    desc: 'Bitácora diaria de avances, observaciones y reportes del programa de becarios.',
    path: '/becarios',
    accent: 'sky',
    kicker: 'Desarrollo',
    tags: ['Bitácora', 'Kevin', 'Omar'],
    badge: 'Nuevo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'reportes-conducta',
    label: 'Reportes académicos y de conducta',
    desc: 'Captura y seguimiento de reportes académicos y de conducta escolar.',
    path: '/reportes-conducta',
    accent: 'rose',
    kicker: 'Académico',
    tags: ['Académico', 'Conducta'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: 'entregas-pie',
    label: 'Entregas a Pie',
    desc: 'Entrega de alumnos con salida a pie registrada para el día.',
    href: urlSsiwEntregaLogin(),
    accent: 'emerald',
    kicker: 'Salida institucional',
    tags: ['Entregas', 'A pie'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 11l-3-3-3 3" />
        <path d="M19 8v8" />
      </svg>
    ),
  },
  {
    id: 'revision-pagados',
    label: 'Revisión Pagados/No Pagados',
    desc: 'Entrada al colegio: busca por grupo (2a, 7b…) y ve lista verde pagó / rojo pendiente.',
    path: '/revision-pagados',
    accent: 'sky',
    kicker: 'Entrada',
    tags: ['Grupo', 'Pagados', 'Pendientes'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <path d="M7 15h4" />
        <path d="M16 14l1.5 1.5L20 13" />
      </svg>
    ),
  },
  {
    id: 'talleres-clases-especiales',
    label: 'Talleres y Clases Especiales',
    desc: 'Catálogo de talleres y maestros, y horario semanal de lunes a sábado.',
    path: '/talleres',
    accent: 'violet',
    kicker: 'Extracurricular',
    tags: ['Talleres', 'Clases especiales'],
    badge: 'Nuevo',
    // laura, coordprim / coordkin / josefina (direcciones primaria, kinder y secundaria),
    // coording / kinder_ing (direcciones de inglés primaria y kinder), fatima (control escolar kinder),
    // mario, santiago (DG)
    soloUsuariosLegacy: [2, 7, 8, 10, 13, 17, 39, 54, 59],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="1.5" />
        <circle cx="17.5" cy="10.5" r="1.5" />
        <circle cx="8.5" cy="7.5" r="1.5" />
        <circle cx="6.5" cy="12.5" r="1.5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.63 0-.42-.16-.8-.43-1.1-.26-.29-.42-.67-.42-1.1 0-.9.73-1.67 1.65-1.67H16c3.05 0 5.5-2.45 5.5-5.5C21.5 6.07 17.2 2 12 2z" />
      </svg>
    ),
  },
  {
    id: 'accesos-autorizados',
    label: 'Accesos Autorizados',
    desc: 'Usuarios y contraseñas de equipos, correos y sistemas, cifrados y con bitácora.',
    path: '/accesos',
    accent: 'amber',
    kicker: 'Seguridad',
    tags: ['Contraseñas', 'Bóveda'],
    badge: 'Nuevo',
    soloUsuarios: ACCESOS_USUARIOS_PERMITIDOS,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1.5" />
      </svg>
    ),
  },
  {
    id: 'enlaces-x',
    label: 'Enlaces de X · Tecnologías de punta',
    desc: 'Publicaciones de IA, agentes y desarrollo compartidas por Dirección General, en español.',
    path: '/tecnologias-de-punta',
    accent: 'violet',
    kicker: 'Desarrollo',
    tags: ['IA', 'Agentes', 'X'],
    badge: 'Nuevo',
    // laura, mario, santiago (DG)
    soloUsuariosLegacy: [2, 17, 59],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h4.5L20 20h-4.5z" />
        <path d="M20 4l-6.5 7.2" />
        <path d="M4 20l6.5-7.2" />
      </svg>
    ),
  },
  {
    id: 'registro-entrada-salida',
    label: 'Registro de entrada/salida',
    desc: 'Registro del acceso de entradas y salidas de los alumnos mediante código QR.',
    href: 'https://winston-registro.vercel.app/login',
    accent: 'emerald',
    kicker: 'Alumnos',
    tags: ['Código QR', 'Entradas', 'Salidas'],
    badge: 'Nuevo',
    // laura, kevin, mario, santiago (DG)
    soloUsuariosLegacy: [2, 6, 17, 59],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3z" />
        <path d="M21 14v7h-4" />
        <path d="M14 21h.01" />
      </svg>
    ),
  },
  {
    id: 'team-english',
    label: 'Team English',
    desc: 'Teachers de inglés: perfiles y C.V., planeaciones semanales, capacitaciones, desempeño y classrooms.',
    path: '/team-english',
    accent: 'rose',
    kicker: 'English Department',
    tags: ['Teachers', 'Planeación', 'Desempeño'],
    badge: 'Nuevo',
    // Solo coording (dirección de inglés primaria), laura y mario.
    soloUsuarios: [2, 10, 17],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        <path d="M17 9h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-3-3h-3a2 2 0 0 1-1.6-.8" />
        <path d="M6 12V8h3" />
        <path d="M6 10h2.5" />
      </svg>
    ),
  },
  // 2026-10-10 — Beneficios externos: dos tarjetas (vista del alumno + módulo del personal),
  // fijas y exclusivas de ruben, mario y alan. No tocan el módulo de Becas.
  {
    id: 'beneficios-externos-alumno',
    label: 'Beneficios externos',
    desc: 'Así la verá el alumno: ¿aplicó a una beca externa?, ¿cuál?, ¿ya la recibió? y subir documento.',
    path: '/beneficios-externos',
    // 2026-10-10 — Se abre como popup sobre el dashboard (la ruta queda como respaldo).
    popup: 'beneficios-externos-alumno',
    accent: 'emerald',
    kicker: 'Vista del alumno',
    tags: ['Vista previa', 'Familias'],
    badge: 'Prueba',
    soloUsuarios: BENEFICIOS_EXTERNOS_USUARIOS,
    fijoParaUsuarios: BENEFICIOS_EXTERNOS_USUARIOS,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v9H4v-9" />
        <path d="M2 7h20v5H2z" />
        <path d="M12 21V7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
  {
    id: 'beneficios-externos',
    label: 'Beneficios externos · Personal',
    desc: 'Módulo del personal: respuestas de las familias y revisión de documentos de becas externas.',
    path: '/beneficios-externos/personal',
    accent: 'emerald',
    kicker: 'Nuevo módulo',
    tags: ['Beca SEP', 'Revisión'],
    badge: 'Prueba',
    soloUsuarios: BENEFICIOS_EXTERNOS_USUARIOS,
    fijoParaUsuarios: BENEFICIOS_EXTERNOS_USUARIOS,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
]

export function navItemKey(item: {
  id?: string
  label?: string
  path?: string
  href?: string
}): string {
  return item.id || item.path || item.href || item.label || 'item'
}

export function abrirNavItem(
  item: Pick<DashboardAdminNavItem, 'path' | 'href'>,
  push: (path: string) => void,
  opts?: { usuario?: string | null; operador?: string | null }
) {
  if (item.href) {
    let href = item.href
    const user = (opts?.usuario ?? opts?.operador ?? '').trim()
    // Prórrogas identifica al autor con ?usuario= del dashboard.
    if (user && /prorrogas/i.test(href)) {
      href = urlProrrogasAjustesApp(user)
    }
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }
  if (item.path) push(item.path)
}
