import 'server-only'
import { createHmac } from 'node:crypto'
import { createInsforgeAdmin } from '@/lib/insforgeAdmin'

/** Tipo vigente de QR de alumno. El kiosk aún acepta P. al escanear; aquí solo se emite A. */
export const QR_ACCESO_TIPO_ALUMNO = 'A'

function secretLocal(): string {
  return (process.env.QR_TOKEN_SECRET ?? '').trim()
}

/**
 * Mismo algoritmo que `scripts/qr-token.mjs` / `functions/control-acceso.ts`.
 * HMAC-SHA256 de `A.{ref}` → base64url → 12 caracteres.
 */
export function firmarCodigoAccesoAlumno(ref: number, secret: string): string {
  const n = Number(ref)
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error('Número de control inválido.')
  }
  const base = `${QR_ACCESO_TIPO_ALUMNO}.${n}`
  const firma = createHmac('sha256', secret).update(base).digest('base64url').slice(0, 12)
  return `${base}.${firma}`
}

type EmitirQrFnRespuesta = {
  codigo?: string
  error?: string
}

async function emitirViaFuncionInsforge(alumnoRef: number): Promise<string> {
  const admin = createInsforgeAdmin()
  const { data, error } = await admin.functions.invoke('emitir-qr', {
    body: { alumnoRef },
  })
  if (error) {
    throw new Error(error.message || 'No se pudo emitir el QR en InsForge.')
  }
  const payload = (data ?? {}) as EmitirQrFnRespuesta
  const codigo = String(payload.codigo ?? '').trim()
  if (!codigo.startsWith(`${QR_ACCESO_TIPO_ALUMNO}.`)) {
    throw new Error(payload.error || 'InsForge no devolvió un código de acceso.')
  }
  return codigo
}

/** Prefiere `QR_TOKEN_SECRET` en el servidor Next; si no está, usa la edge `emitir-qr`. */
export async function emitirCodigoQrAcceso(alumnoRef: number): Promise<string> {
  const local = secretLocal()
  if (local) return firmarCodigoAccesoAlumno(alumnoRef, local)
  return emitirViaFuncionInsforge(alumnoRef)
}
