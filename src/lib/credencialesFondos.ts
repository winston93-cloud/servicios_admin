import fs from 'fs'
import path from 'path'
import type { AppInsforgeClient } from '@/lib/dbTypes'
import { NIVELES_CREDENCIAL } from './credencialesConfig'

const BUCKET = 'credenciales-fondos'

function rutaDefault(nivel: number): string {
  const meta = NIVELES_CREDENCIAL.find((n) => n.nivel === nivel)
  const key = meta?.defaultKey ?? 'kinder'
  return path.join(process.cwd(), 'public', 'credenciales', 'defaults', `${key}.png`)
}

function rutaCustomLocal(nivel: number): string {
  return path.join(process.cwd(), 'public', 'credenciales', 'custom', `nivel-${nivel}.png`)
}

function storagePath(nivel: number): string {
  return `nivel-${nivel}.png`
}

export function leerFondoDefaultBuffer(nivel: number): Buffer | null {
  try {
    return fs.readFileSync(rutaDefault(nivel))
  } catch {
    return null
  }
}

export async function leerFondoCustomBuffer(
  client: AppInsforgeClient | null,
  nivel: number
): Promise<Buffer | null> {
  const local = rutaCustomLocal(nivel)
  if (fs.existsSync(local)) {
    try {
      return fs.readFileSync(local)
    } catch {
      /* siguiente */
    }
  }

  if (!client) return null

  try {
    const { data, error } = await client.storage.from(BUCKET).download(storagePath(nivel))
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch {
    return null
  }
}

export async function resolverFondoCredencial(
  client: AppInsforgeClient | null,
  nivel: number
): Promise<{ buffer: Buffer; mime: 'PNG' | 'JPEG'; origen: 'custom' | 'default' } | null> {
  const custom = await leerFondoCustomBuffer(client, nivel)
  if (custom?.length) {
    return { buffer: custom, mime: detectarMime(custom), origen: 'custom' }
  }
  const def = leerFondoDefaultBuffer(nivel)
  if (def?.length) {
    return { buffer: def, mime: 'PNG', origen: 'default' }
  }
  return null
}

function detectarMime(buf: Buffer): 'PNG' | 'JPEG' {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'JPEG'
  return 'PNG'
}

export async function guardarFondoCustom(
  client: AppInsforgeClient | null,
  nivel: number,
  buffer: Buffer,
  contentType: string
): Promise<{ ok: true; via: 'local' | 'storage' } | { ok: false; error: string }> {
  const dir = path.join(process.cwd(), 'public', 'credenciales', 'custom')
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(rutaCustomLocal(nivel), buffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo guardar localmente'
    if (!client) return { ok: false, error: msg }
  }

  if (client) {
    const blob = new Blob([buffer], { type: contentType || 'image/png' })
    const { error } = await client.storage.from(BUCKET).upload(storagePath(nivel), blob)
    if (error) {
      if (fs.existsSync(rutaCustomLocal(nivel))) {
        return { ok: true, via: 'local' }
      }
      return { ok: false, error: error.message }
    }
    return { ok: true, via: 'storage' }
  }

  if (fs.existsSync(rutaCustomLocal(nivel))) {
    return { ok: true, via: 'local' }
  }
  return { ok: false, error: 'No se pudo guardar la imagen' }
}
