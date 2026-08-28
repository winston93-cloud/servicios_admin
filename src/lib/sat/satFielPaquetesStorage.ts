const STORAGE_PAQUETES = 'servicios-admin-sat-fiel-paquetes'
const STORAGE_ULTIMO = 'servicios-admin-sat-fiel-ultimo'

export type SatFielPaquete = {
  id: string
  nombre: string
  cerBase64: string
  keyBase64: string
  cerNombre: string
  keyNombre: string
  password: string
  creadoEn: string
  actualizadoEn: string
}

function puedeUsarStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function leerLista(): SatFielPaquete[] {
  if (!puedeUsarStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_PAQUETES)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is SatFielPaquete =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as SatFielPaquete).id === 'string' &&
        typeof (p as SatFielPaquete).nombre === 'string' &&
        typeof (p as SatFielPaquete).cerBase64 === 'string' &&
        typeof (p as SatFielPaquete).keyBase64 === 'string' &&
        typeof (p as SatFielPaquete).password === 'string'
    )
  } catch {
    return []
  }
}

function escribirLista(paquetes: SatFielPaquete[]) {
  if (!puedeUsarStorage()) return
  window.localStorage.setItem(STORAGE_PAQUETES, JSON.stringify(paquetes))
}

async function archivoABase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

function base64AArchivo(base64: string, nombre: string, tipo: string): File {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], nombre, { type: tipo })
}

export function listarPaquetesFiel(): SatFielPaquete[] {
  return leerLista().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function obtenerPaqueteFiel(id: string): SatFielPaquete | null {
  return leerLista().find((p) => p.id === id) ?? null
}

export function obtenerUltimoPaqueteFielId(): string | null {
  if (!puedeUsarStorage()) return null
  const id = window.localStorage.getItem(STORAGE_ULTIMO)
  return id && obtenerPaqueteFiel(id) ? id : null
}

export function marcarUltimoPaqueteFiel(id: string) {
  if (!puedeUsarStorage()) return
  window.localStorage.setItem(STORAGE_ULTIMO, id)
}

export async function guardarPaqueteFiel(input: {
  nombre: string
  cer: File
  key: File
  password: string
  id?: string
}): Promise<SatFielPaquete> {
  const nombre = input.nombre.trim()
  if (!nombre) throw new Error('Indique un nombre para el paquete de e.firma.')
  if (!input.cer || !input.key) throw new Error('Suba .cer y .key.')
  if (!input.password.trim()) throw new Error('Indique la contraseña de la e.firma.')

  const ahora = new Date().toISOString()
  const existente = input.id ? obtenerPaqueteFiel(input.id) : null
  const paquete: SatFielPaquete = {
    id: existente?.id ?? crypto.randomUUID(),
    nombre,
    cerBase64: await archivoABase64(input.cer),
    keyBase64: await archivoABase64(input.key),
    cerNombre: input.cer.name,
    keyNombre: input.key.name,
    password: input.password,
    creadoEn: existente?.creadoEn ?? ahora,
    actualizadoEn: ahora,
  }

  const lista = leerLista().filter((p) => p.id !== paquete.id)
  lista.push(paquete)
  escribirLista(lista)
  marcarUltimoPaqueteFiel(paquete.id)
  return paquete
}

export function eliminarPaqueteFiel(id: string) {
  const lista = leerLista().filter((p) => p.id !== id)
  escribirLista(lista)
  if (!puedeUsarStorage()) return
  if (window.localStorage.getItem(STORAGE_ULTIMO) === id) {
    window.localStorage.removeItem(STORAGE_ULTIMO)
  }
}

export function paqueteFielAFicheros(paquete: SatFielPaquete): {
  cer: File
  key: File
  password: string
} {
  return {
    cer: base64AArchivo(paquete.cerBase64, paquete.cerNombre, 'application/x-x509-ca-cert'),
    key: base64AArchivo(paquete.keyBase64, paquete.keyNombre, 'application/octet-stream'),
    password: paquete.password,
  }
}
