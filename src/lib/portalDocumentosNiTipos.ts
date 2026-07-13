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
    id: 'constancia_no_adeudo',
    etiqueta: 'Constancia de no adeudo',
    descripcion: 'Constancia de no adeudo de la escuela de procedencia (PDF).',
  },
  {
    id: 'carta_buena_conducta',
    etiqueta: 'Carta de buena conducta',
    descripcion: 'Carta de buena conducta de la escuela de procedencia (PDF).',
  },
] as const

export type DocumentoNiTipoId = (typeof DOCUMENTOS_NI_TIPOS)[number]['id']

/** Maternal solo acta + CURP; el resto de niveles pide el expediente completo. */
const DOCUMENTOS_NI_POR_NIVEL: Record<number, readonly DocumentoNiTipoId[]> = {
  1: ['acta_nacimiento', 'curp_alumno'],
  2: [
    'acta_nacimiento',
    'curp_alumno',
    'curp_tutor',
    'constancia_no_adeudo',
    'carta_buena_conducta',
  ],
  3: [
    'acta_nacimiento',
    'curp_alumno',
    'curp_tutor',
    'constancia_no_adeudo',
    'carta_buena_conducta',
  ],
  4: [
    'acta_nacimiento',
    'curp_alumno',
    'curp_tutor',
    'constancia_no_adeudo',
    'carta_buena_conducta',
  ],
}

export function documentosNiRequeridosPorNivel(nivel: number) {
  const ids = DOCUMENTOS_NI_POR_NIVEL[nivel] ?? DOCUMENTOS_NI_POR_NIVEL[3]
  return DOCUMENTOS_NI_TIPOS.filter((d) => ids.includes(d.id))
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
