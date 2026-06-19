/** InsForge del proyecto AgendaW (citas de admisión), separado de Winston Servicios. */
export function admissionInsforgeUrl(): string {
  return (
    process.env.ADMISSION_INSFORGE_URL ??
    process.env.NEXT_PUBLIC_ADMISSION_INSFORGE_URL ??
    ''
  ).trim()
}

export function admissionInsforgeAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_ADMISSION_INSFORGE_ANON_KEY ??
    ''
  ).trim()
}

export function admissionInsforgeApiKey(): string {
  return (process.env.ADMISSION_INSFORGE_API_KEY ?? '').trim()
}

export function hasAdmissionInsforgeEnv(): boolean {
  return Boolean(admissionInsforgeUrl() && admissionInsforgeApiKey())
}
