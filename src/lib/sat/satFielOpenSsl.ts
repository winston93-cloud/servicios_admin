import { execFile } from 'node:child_process'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { SatDescargaError } from './satDescargaErrors'
import { normalizarArchivoFiel } from './satFiel'

const execFileAsync = promisify(execFile)

function detectarFormato(buf: Buffer): 'pem' | 'der' | 'base64-text' | 'unknown' {
  const texto = buf.subarray(0, Math.min(40, buf.length)).toString('utf8').trim()
  if (texto.startsWith('-----BEGIN')) return 'pem'
  if (buf[0] === 0x30) return 'der'
  if (/^[A-Za-z0-9+/=]+$/.test(buf.toString('utf8').trim().slice(0, 40))) {
    return 'base64-text'
  }
  return 'unknown'
}

async function opensslCerPem(cerPath: string, outPath: string): Promise<void> {
  const errores: string[] = []
  for (const inform of ['DER', 'PEM'] as const) {
    try {
      await execFileAsync('openssl', [
        'x509',
        '-inform',
        inform,
        '-in',
        cerPath,
        '-out',
        outPath,
      ])
      return
    } catch (e) {
      errores.push(
        `${inform}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }
  throw new Error(`Certificado no legible por OpenSSL (${errores.join('; ')})`)
}

async function opensslKeyPem(
  keyPath: string,
  outPath: string,
  password: string
): Promise<void> {
  const env = { ...process.env, FIEL_PASS: password }
  const intentos: string[][] = [
    [
      'pkcs8',
      '-inform',
      'DER',
      '-in',
      keyPath,
      '-passin',
      'env:FIEL_PASS',
      '-nocrypt',
      '-out',
      outPath,
    ],
    [
      'pkcs8',
      '-in',
      keyPath,
      '-passin',
      'env:FIEL_PASS',
      '-nocrypt',
      '-out',
      outPath,
    ],
    ['rsa', '-in', keyPath, '-passin', 'env:FIEL_PASS', '-out', outPath],
  ]

  const errores: string[] = []
  for (const args of intentos) {
    try {
      await execFileAsync('openssl', args, { env })
      return
    } catch (e) {
      errores.push(e instanceof Error ? e.message : String(e))
    }
  }

  throw new Error(
    `Clave privada no descifrada por OpenSSL (${errores.slice(0, 2).join('; ')})`
  )
}

/**
 * Fallback: convierte .cer/.key del SAT a PEM con OpenSSL (soporta más algoritmos PBE).
 */
export async function crearFielConOpenSsl(
  cer: Buffer,
  key: Buffer,
  password: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const id = randomUUID()
  const cerPath = join(tmpdir(), `sat-os-${id}.cer`)
  const keyPath = join(tmpdir(), `sat-os-${id}.key`)
  const cerPemPath = join(tmpdir(), `sat-os-${id}.cer.pem`)
  const keyPemPath = join(tmpdir(), `sat-os-${id}.key.pem`)

  try {
    await writeFile(cerPath, cer)
    await writeFile(keyPath, key)
    await opensslCerPem(cerPath, cerPemPath)
    await opensslKeyPem(keyPath, keyPemPath, password)

    const cerPem = await readFile(cerPemPath, 'utf8')
    const keyPem = await readFile(keyPemPath, 'utf8')
    const { Fiel } = await import('@nodecfdi/sat-ws-descarga-masiva')
    return Fiel.create(cerPem, keyPem, '')
  } finally {
    await Promise.all(
      [cerPath, keyPath, cerPemPath, keyPemPath].map((p) =>
        unlink(p).catch(() => undefined)
      )
    )
  }
}

export type FielDiagnostico = {
  cerBytes: number
  keyBytes: number
  cerFormato: string
  keyFormato: string
}

export function diagnosticoFielUpload(cer: Buffer, key: Buffer): FielDiagnostico {
  const cerN = normalizarArchivoFiel(cer)
  const keyN = normalizarArchivoFiel(key)
  return {
    cerBytes: cerN.length,
    keyBytes: keyN.length,
    cerFormato: detectarFormato(cerN),
    keyFormato: detectarFormato(keyN),
  }
}

export function logFalloFiel(
  etapa: string,
  err: unknown,
  diag: FielDiagnostico
) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`sat/fiel:${etapa}`, {
    ...diag,
    error: msg,
  })
}

export function envolverErrorFiel(
  code: string,
  message: string,
  detail: string
): SatDescargaError {
  return new SatDescargaError(message, code, 400, detail)
}
