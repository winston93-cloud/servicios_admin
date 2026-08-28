import { createPrivateKey, X509Certificate } from 'node:crypto'
import { normalizarArchivoFiel } from './satFiel'

function esPem(buf: Buffer): boolean {
  return buf.subarray(0, Math.min(30, buf.length)).toString('utf8').includes('-----BEGIN')
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

  let privateKey
  try {
    privateKey = createPrivateKey({
      key: keyNorm,
      format: esPem(keyNorm) ? 'pem' : 'der',
      type: 'pkcs8',
      passphrase: password,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Node crypto no descifró el .key: ${msg}`)
  }

  const cerPem = cert.toString()
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  const { Fiel } = await import('@nodecfdi/sat-ws-descarga-masiva')
  return Fiel.create(cerPem, keyPem, '')
}
