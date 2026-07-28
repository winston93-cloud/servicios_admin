/** Documentos obligatorios para nuevo ingreso (paso 4). */

export const DOCUMENTOS_NI_TIPOS = [
  {
    id: 'acta_nacimiento',
    etiqueta: 'Acta de nacimiento',
    descripcion: 'Acta de nacimiento del alumno (PDF).',
  },
  {
    id: 'curp_alumno',
    etiqueta: 'CURP del alumno',
    descripcion: 'Constancia CURP del alumno (PDF).',
  },
  {
    id: 'curp_tutor',
    etiqueta: 'CURP de mamá o papá',
    descripcion: 'CURP de la madre o del padre (PDF).',
  },
  {
    id: 'boleta_sep',
    etiqueta: 'Boleta',
    descripcion: 'Boleta o cartilla de calificaciones (PDF).',
  },
  {
    id: 'constancia_no_adeudo',
    etiqueta: 'Carta de no adeudo',
    descripcion: 'Carta o constancia de no adeudo de la escuela de procedencia (PDF).',
  },
  {
    id: 'carta_buena_conducta',
    etiqueta: 'Carta de buena conducta',
    descripcion: 'Carta de buena conducta de la escuela de procedencia (PDF).',
  },
  {
    id: 'certificado_primaria',
    etiqueta: 'Certificado',
    descripcion:
      'Certificado de terminación de estudios de primaria (PDF). Obligatorio al ingresar a 7mo de secundaria.',
  },
] as const

export type DocumentoNiTipoId = (typeof DOCUMENTOS_NI_TIPOS)[number]['id']

const ACTA_CURP: readonly DocumentoNiTipoId[] = ['acta_nacimiento', 'curp_alumno']

const KINDER_2_3: readonly DocumentoNiTipoId[] = [
  'acta_nacimiento',
  'curp_alumno',
  'boleta_sep',
  'carta_buena_conducta',
  'constancia_no_adeudo',
]

const EXPEDIENTE_PRIMARIA: readonly DocumentoNiTipoId[] = [
  'acta_nacimiento',
  'curp_alumno',
  'curp_tutor',
  'constancia_no_adeudo',
  'carta_buena_conducta',
]

/** Nuevo ingreso a 7mo (1.º de secundaria): expediente + certificado de primaria. */
const EXPEDIENTE_SECUNDARIA_7MO: readonly DocumentoNiTipoId[] = [
  ...EXPEDIENTE_PRIMARIA,
  'certificado_primaria',
]

/** Nuevo ingreso a 8vo / 9no: expediente + boleta (no certificado). */
const EXPEDIENTE_SECUNDARIA_8_9: readonly DocumentoNiTipoId[] = [
  ...EXPEDIENTE_PRIMARIA,
  'boleta_sep',
]

/**
 * Requisitos por nivel/grado (nuevo ingreso o cambio de nivel).
 * - Maternal: acta + CURP
 * - Kinder 1: acta + CURP
 * - Kinder 2 y 3: acta, CURP, boleta SEP, buena conducta, no adeudo
 * - Primaria: expediente (acta, CURPs, no adeudo, buena conducta)
 * - Secundaria 7mo: expediente + certificado de primaria
 * - Secundaria 8vo / 9no: expediente + boleta (en lugar de certificado)
 */
export function documentosNiRequeridosPorNivelGrado(
  nivel: number,
  grado: number
): (typeof DOCUMENTOS_NI_TIPOS)[number][] {
  let ids: readonly DocumentoNiTipoId[]

  if (nivel === 1) {
    ids = ACTA_CURP
  } else if (nivel === 2) {
    ids = grado <= 1 ? ACTA_CURP : KINDER_2_3
  } else if (nivel === 3) {
    ids = EXPEDIENTE_PRIMARIA
  } else if (nivel === 4) {
    // 7mo = grado 1 → certificado; 8vo/9no (2/3) → boleta
    ids = grado <= 1 ? EXPEDIENTE_SECUNDARIA_7MO : EXPEDIENTE_SECUNDARIA_8_9
  } else {
    ids = EXPEDIENTE_PRIMARIA
  }

  return DOCUMENTOS_NI_TIPOS.filter((d) => ids.includes(d.id))
}

/** @deprecated Preferir documentosNiRequeridosPorNivelGrado */
export function documentosNiRequeridosPorNivel(nivel: number) {
  return documentosNiRequeridosPorNivelGrado(nivel, 1)
}

export const DOCUMENTOS_NI_MAX_BYTES = 4 * 1024 * 1024
export const DOCUMENTOS_NI_BUCKET = 'portal-documentos-ni'

/** Destino de control escolar según nivel (1 Maternal, 2 Kinder, 3 Primaria, 4 Secundaria). */
export function correoControlEscolarPorNivel(nivel: number): string | null {
  switch (nivel) {
    case 1:
    case 2:
      return 'controlescolariew@winston93.edu.mx'
    case 3:
      return 'controlescolar.primaria@winston93.edu.mx'
    case 4:
      return 'controlescolar.secundaria@winston93.edu.mx'
    default:
      return null
  }
}

/** Si está definida, sustituye el correo real (pruebas). */
export function correoDocumentosNiEfectivo(nivel: number): string | null {
  const prueba = process.env.PORTAL_DOCUMENTOS_CORREO_PRUEBA?.trim()
  if (prueba) return prueba
  return correoControlEscolarPorNivel(nivel)
}

export function esDocumentoNiTipoId(v: string): v is DocumentoNiTipoId {
  return DOCUMENTOS_NI_TIPOS.some((d) => d.id === v)
}

export function etiquetaDocumentoNi(id: DocumentoNiTipoId): string {
  return DOCUMENTOS_NI_TIPOS.find((d) => d.id === id)?.etiqueta ?? id
}

/** Nombre de archivo comparable (sin ruta, minúsculas). */
export function normalizarNombreArchivoDoc(nombre: string): string {
  return String(nombre ?? '')
    .trim()
    .replace(/^.*[/\\]/, '')
    .toLowerCase()
}
