import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const SALT = 'sat-fiel-paquete-v1'

function claveCifrado(): Buffer {
  const secret =
    process.env.SAT_FIEL_STORAGE_SECRET?.trim() ||
    process.env.INSFORGE_API_KEY?.trim()
  if (!secret) {
    throw new Error(
      'Falta SAT_FIEL_STORAGE_SECRET o INSFORGE_API_KEY para cifrar paquetes e.firma.'
    )
  }
  return scryptSync(secret, SALT, 32)
}

export function cifrarSecretoFiel(texto: string): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, claveCifrado(), iv)
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, cifrado]).toString('base64')
}

export function descifrarSecretoFiel(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Secreto e.firma corrupto.')
  }
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const data = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, claveCifrado(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
