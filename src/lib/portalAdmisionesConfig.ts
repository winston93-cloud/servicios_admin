/** Configuración del portal de inscripciones (env / tablas — sin listas hardcodeadas). */

export function admisionesLegacyBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_ADMISIONES_LEGACY_URL?.trim() ||
    'https://winston93.edu.mx/admisiones'
  return base.replace(/\/$/, '')
}

export function portalDocumentosBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_PORTAL_DOCUMENTOS_URL?.trim() ||
    'https://documentos.winston93.edu.mx/documentos'
  return base.replace(/\/$/, '')
}

export function jwtDocumentosSecret(): string | null {
  const s = process.env.JWT_DOCUMENTOS_SECRET?.trim()
  return s && s.length >= 16 ? s : null
}

export function jwtDocumentosIssuer(): string {
  return process.env.JWT_DOCUMENTOS_ISSUER?.trim() || 'winston-escolar'
}

export function jwtDocumentosTtlSec(): number {
  const n = Number(process.env.JWT_DOCUMENTOS_TTL_SEC)
  return Number.isFinite(n) && n > 60 ? n : 3600
}

/** Slug de nivel para PDF de reglamento (admisiones/module/pdf/list/reglamento_{nivel}_{ciclo}.pdf). */
export function nivelReglamentoSlug(nivel: number): string | null {
  switch (nivel) {
    case 1:
      return 'maternal'
    case 2:
      return 'kinder'
    case 3:
      return 'primaria'
    case 4:
      return 'secundaria'
    default:
      return null
  }
}

export function urlReglamentoEscolarLegacy(
  nivel: number,
  cicloEscolar: number
): string | null {
  const slug = nivelReglamentoSlug(nivel)
  if (!slug) return null
  return `${admisionesLegacyBaseUrl()}/module/pdf/list/reglamento_${slug}_${cicloEscolar}.pdf`
}

/** @deprecated Preferir metadata InsForge + hrefReglamentoArchivo; se mantiene como fallback. */
export function urlReglamentoEscolar(nivel: number, cicloEscolar: number): string | null {
  return urlReglamentoEscolarLegacy(nivel, cicloEscolar)
}
