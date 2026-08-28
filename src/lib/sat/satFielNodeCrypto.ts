import { createPrivateKey, X509Certificate, type KeyObject } from 'node:crypto'
import { normalizarArchivoFiel } from './satFiel'

function esPem(buf: Buffer): boolean {
  return buf.subarray(0, Math.min(30, buf.length)).toString('utf8').includes('-----BEGIN')
}

export function variantesPassword(password: string): string[] {
  const out: string[] = []
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v)
  }
  push(password)
  push(password.trim())
  push(password.normalize('NFC'))
  push(password.normalize('NFD'))
  return out
}

function abrirClavePrivada(keyNorm: Buffer, password: string): KeyObject {
  const pem = esPem(keyNorm)
  const formatos: Array<{
    format: 'pem' | 'der'
    type?: 'pkcs8' | 'pkcs1' | 'sec1'
  }> = [
    { format: pem ? 'pem' : 'der' },
    { format: pem ? 'pem' : 'der', type: 'pkcs8' },
    { format: pem ? 'pem' : 'der', type: 'pkcs1' },
  ]
  if (!pem) {
    formatos.push({ format: 'der', type: 'sec1' })
  }

  const errores: string[] = []
  for (const fmt of formatos) {
    try {
      return createPrivateKey({
        key: keyNorm,
        format: fmt.format,
        ...(fmt.type ? { type: fmt.type } : {}),
        passphrase: password,
      })
    } catch (e) {
      errores.push(e instanceof Error ? e.message : String(e))
    }
  }

  throw new Error(errores.slice(0, 3).join('; '))
}

export function certificadoLegible(cer: Buffer): boolean {
  try {
    // eslint-disable-next-line no-new
    new X509Certificate(normalizarArchivoFiel(cer))
    return true
  } catch {
    return false
  }
}

/**
 * Descifra .key con crypto nativo de Node y arma FIEL vía PEM (sin binario openssl).
 */
export async function crearFielConNodeCrypto(
  cer: Buffer,
  key: Buffer,
  password: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const cerNorm = normalizarArchivoFiel(cer)
  const keyNorm = normalizarArchivoFiel(key)

  let cert: X509Certificate
  try {
    cert = new X509Certificate(cerNorm)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Node crypto no leyó el .cer: ${msg}`)
  }

  let privateKey: KeyObject | null = null
  const errores: string[] = []

  for (const pass of variantesPassword(password)) {
    try {
      privateKey = abrirClavePrivada(keyNorm, pass)
      break
    } catch (e) {
      errores.push(
        `pass[${pass.length}]: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  if (!privateKey) {
    throw new Error(`Node crypto no descifró el .key (${errores.join(' | ')})`)
  }

  const cerPem = cert.toString()
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  const { Fiel } = await import('@nodecfdi/sat-ws-descarga-masiva')
  return Fiel.create(cerPem, keyPem, '')
}
