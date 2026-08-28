import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'

const STORAGE_ULTIMO = 'servicios-admin-sat-fiel-ultimo'
const STORAGE_LEGACY_PAQUETES = 'servicios-admin-sat-fiel-paquetes'

export type SatFielPaqueteResumen = {
  id: string
  nombre: string
  cerNombre: string
  keyNombre: string
  creadoEn: string
  actualizadoEn: string
  ultimoUsoEn: string | null
}

type LegacyPaquete = {
  id: string
  nombre: string
  cerBase64: string
  keyBase64: string
  cerNombre: string
  keyNombre: string
  password: string
}

function headersJson(): Record<string, string> {
  return {
    ...portalSessionFetchHeaders(),
    Accept: 'application/json',
  }
}

function base64ABlob(base64: string, tipo: string): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}

export function obtenerUltimoPaqueteFielId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_ULTIMO)
}

export function marcarUltimoPaqueteFiel(id: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_ULTIMO, id)
}

export async function listarPaquetesFielApi(): Promise<SatFielPaqueteResumen[]> {
  const res = await fetch('/api/sat/fiel-paquetes', {
    headers: headersJson(),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    paquetes?: SatFielPaqueteResumen[]
    error?: string
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'No se pudieron cargar los paquetes e.firma.')
  }
  return data.paquetes ?? []
}

export async function guardarPaqueteFielApi(input: {
  nombre: string
  cer: File
  key: File
  password: string
  id?: string
}): Promise<SatFielPaqueteResumen> {
  const fd = new FormData()
  if (input.id) fd.set('id', input.id)
  fd.set('nombre', input.nombre.trim())
  fd.set('password', input.password)
  fd.set('cer', input.cer)
  fd.set('key', input.key)
  fd.set('cerNombre', input.cer.name)
  fd.set('keyNombre', input.key.name)

  const res = await fetch('/api/sat/fiel-paquetes', {
    method: 'POST',
    headers: portalSessionFetchHeaders(),
    body: fd,
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    paquete?: SatFielPaqueteResumen
    error?: string
  }
  if (!res.ok || !data.ok || !data.paquete) {
    throw new Error(data.error || 'No se pudo guardar el paquete.')
  }
  marcarUltimoPaqueteFiel(data.paquete.id)
  return data.paquete
}

export async function eliminarPaqueteFielApi(id: string): Promise<void> {
  const res = await fetch(`/api/sat/fiel-paquetes?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headersJson(),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'No se pudo eliminar el paquete.')
  }
  if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_ULTIMO) === id) {
    window.localStorage.removeItem(STORAGE_ULTIMO)
  }
}

function leerLegacyLocal(): LegacyPaquete[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_LEGACY_PAQUETES)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is LegacyPaquete =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as LegacyPaquete).nombre === 'string' &&
        typeof (p as LegacyPaquete).cerBase64 === 'string' &&
        typeof (p as LegacyPaquete).keyBase64 === 'string' &&
        typeof (p as LegacyPaquete).password === 'string'
    )
  } catch {
    return []
  }
}

/** Migra paquetes del localStorage anterior a InsForge (una sola vez). */
export async function migrarPaquetesLocalesSiHay(): Promise<number> {
  const legacy = leerLegacyLocal()
  if (!legacy.length) return 0

  const existentes = await listarPaquetesFielApi()
  if (existentes.length > 0) {
    window.localStorage.removeItem(STORAGE_LEGACY_PAQUETES)
    return 0
  }

  let migrados = 0
  for (const p of legacy) {
    await guardarPaqueteFielApi({
      nombre: p.nombre,
      cer: new File(
        [base64ABlob(p.cerBase64, 'application/x-x509-ca-cert')],
        p.cerNombre || 'certificado.cer'
      ),
      key: new File(
        [base64ABlob(p.keyBase64, 'application/octet-stream')],
        p.keyNombre || 'clave.key'
      ),
      password: p.password,
    })
    migrados += 1
  }

  window.localStorage.removeItem(STORAGE_LEGACY_PAQUETES)
  return migrados
}
