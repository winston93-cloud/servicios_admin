/** Sinopsis tipo “cartelera” para hover Netflix del dashboard admin. */
export type DashboardModulePreview = {
  synopsis: string
  highlights: string[]
}

export const DASHBOARD_MODULE_PREVIEWS: Record<string, DashboardModulePreview> = {
  'Desayunos, Estancias y Comidas': {
    synopsis:
      'El POS institucional de alimentación: cobra desayunos, estancias y comidas en segundos, con control operativo del día y cierre claro para caja.',
    highlights: ['Cobro rápido en mostrador', 'Pedidos y estancias', 'Flujo listo para el turno'],
  },
  Reportes: {
    synopsis:
      'La sala de control analítico: genera reportes por ciclo, nivel y área, exporta PDF y tiene a la vista lo que administración necesita decidir.',
    highlights: ['Consultas por ciclo', 'Exportación PDF', 'Visión por área'],
  },
  Servicios: {
    synopsis:
      'El hub administrativo del ciclo escolar: alumnos, pagos, becas, bauchers y catálogos en un solo panel para el equipo Winston.',
    highlights: ['Ficha del alumno', 'Pagos y colegiaturas', 'Herramientas del ciclo'],
  },
  Prórrogas: {
    synopsis:
      'Gestiona prórrogas de pago con seguimiento trazable: registra, consulta y coordina excepciones sin perder el control del adeudo.',
    highlights: ['Alta y seguimiento', 'Historial por alumno', 'Coordinación de pagos'],
  },
  'Bajas administrativas': {
    synopsis:
      'Proceso formal de baja: actualiza estatus, notifica al equipo y deja constancia institucional cuando un alumno sale del padrón activo.',
    highlights: ['Cambio de estatus', 'Aviso por correo', 'Registro institucional'],
  },
  'Monitoreo y Control': {
    synopsis:
      'Caja chica con disciplina financiera: egresos, fondos, ejecutores y reportes para saber a dónde va cada peso del control operativo.',
    highlights: ['Fondos y egresos', 'Reportes de control', 'Acceso con login'],
  },
  'Control Escolar': {
    synopsis:
      'Cierra el circuito de nuevo ingreso: valida documentación completa y libera el recibo final cuando el expediente está en orden.',
    highlights: ['Checklist documental', 'Autorización NI', 'Recibo final'],
  },
  'Agenda psicólogas': {
    synopsis:
      'Calendario del área de psicología: agenda citas, organiza horarios y da visibilidad al seguimiento socioemocional de la comunidad.',
    highlights: ['Citas y horarios', 'Panel de psicología', 'Coordinación diaria'],
  },
  'Agenda directoras': {
    synopsis:
      'Agenda de dirección escolar: prioriza reuniones, seguimiento y coordinación entre planteles sin perder el hilo del día.',
    highlights: ['Panel de dirección', 'Coordinación', 'Seguimiento'],
  },
  'Open House/Sesiones Inf. Admin': {
    synopsis:
      'Admisiones en acción: administra Open House y sesiones informativas, captura interesados y da seguimiento al embudo de ingreso.',
    highlights: ['Open House', 'Sesiones informativas', 'Seguimiento de prospectos'],
  },
  'Facturación CFDI': {
    synopsis:
      'Motor fiscal del instituto: timbra, cancela y gestiona devoluciones CFDI con el rigor que exige el SAT y la operación diaria.',
    highlights: ['Timbrado CFDI', 'Cancelaciones', 'Devoluciones'],
  },
  Cheques: {
    synopsis:
      'Tesorería digital de cheques: emite, imprime y controla pólizas para Winston, Educativo y Sociedades de Padres en un solo sistema.',
    highlights: ['Emisión e impresión', 'Multi-entidad', 'Control de pólizas'],
  },
  Contratos: {
    synopsis:
      'RRHH documental: genera contratos laborales (determinado, indeterminado y por hora) en PDF/DOCX listos para firma y archivo.',
    highlights: ['3 tipos de contrato', 'PDF y Word', 'Gestión centralizada'],
  },
  Boletas: {
    synopsis:
      'Boletas de secundaria: captura de calificaciones, PDF, reportes de promedio (ciclos históricos) y envío autenticado.',
    highlights: ['Captura por materia', 'PDF y promedios', 'Ciclos históricos'],
  },
  'Becas Panel': {
    synopsis:
      'Torre de control de becas: revisa renovaciones y solicitudes con acceso de Control Escolar para decidir con información completa.',
    highlights: ['Renovaciones', 'Solicitudes', 'Login de control'],
  },
  Becas: {
    synopsis:
      'Hub de becas y Control Escolar: renovaciones, solicitudes, permisos, bitácora y boletas de secundaria en un solo panel.',
    highlights: ['Renovaciones', 'Solicitudes', 'Boletas secundaria'],
  },
  'Reportes académicos y de conducta': {
    synopsis:
      'Seguimiento académico y disciplinario: captura reportes, citas y suspensiones, y avisa a las familias con el mismo buzón de envíos masivos.',
    highlights: ['Captura por materia', 'Citas y suspensiones', 'Aviso a familias'],
  },
  'Entregas a Pie': {
    synopsis:
      'Salida segura a pie: identifica alumnos con registro del día y agiliza la entrega en puerta con el flujo SSIW conectado al dashboard.',
    highlights: ['Registro del día', 'Entrega en puerta', 'Operación en vivo'],
  },
}

export function previewParaModulo(
  label: string,
  fallbackDesc: string,
  fallbackTags: string[] = []
): DashboardModulePreview {
  return (
    DASHBOARD_MODULE_PREVIEWS[label] ?? {
      synopsis: fallbackDesc,
      highlights: fallbackTags.slice(0, 3),
    }
  )
}
