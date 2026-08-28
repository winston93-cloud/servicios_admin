import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { SatDescargaError } from './satDescargaErrors'

export type FielUpload = {
  cer: Buffer
  key: Buffer
  password: string
}

export type SatFielHandle = {
  rfc: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fiel: any
}

/** Quita BOM UTF-8 si el archivo PEM lo trae. */
function quitarBom(buf: Buffer): Buffer {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3)
  }
  return buf
}

/**
 * Normaliza .cer/.key del SAT: DER binario, PEM o archivo de texto base64 (sin headers).
 * En .key de texto base64, NodeCfdi falla si se pasa el ASCII sin decodificar.
 */
export function normalizarArchivoFiel(buf: Buffer): Buffer {
  const sinBom = quitarBom(buf)
  if (sinBom.length === 0) return sinBom

  const comoTexto = sinBom.toString('utf8').trim()
  if (comoTexto.startsWith('-----BEGIN')) {
    return Buffer.from(comoTexto, 'utf8')
  }

  // DER/PKCS#8 suele empezar con 0x30 (SEQUENCE)
  if (sinBom[0] === 0x30) {
    return sinBom
  }

  // Archivo de una sola línea base64 (común al descargar del portal SAT)
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(comoTexto)) {
    try {
      const decodificado = Buffer.from(comoTexto.replace(/\s/g, ''), 'base64')
      if (decodificado.length > 16) {
        return decodificado
      }
    } catch {
      /* seguir con original */
    }
  }

  return sinBom
}

function bufferAContenidoFiel(buf: Buffer): string {
  const normalizado = normalizarArchivoFiel(buf)
  const peek = normalizado.subarray(0, Math.min(64, normalizado.length)).toString('utf8')
  if (peek.includes('-----BEGIN')) {
    return normalizado.toString('utf8')
  }
  return normalizado.toString('latin1')
}

function validarArchivosFiel(cer: Buffer, key: Buffer) {
  const cerN = normalizarArchivoFiel(cer)
  const keyN = normalizarArchivoFiel(key)

  if (cerN.length < 100) {
    throw new SatDescargaError(
      `El certificado (.cer) parece incompleto (${cer.length} bytes). Descárguelo de nuevo del SAT.`,
      'FIEL_CER',
      400
    )
  }
  if (keyN.length < 100) {
    throw new SatDescargaError(
      `La clave privada (.key) parece incompleta (${key.length} bytes). Descárguela de nuevo del SAT.`,
      'FIEL_KEY',
      400
    )
  }
}

function mapearErrorFiel(err: unknown): never {
  const msg = err instanceof Error ? err.message.trim() : String(err)

  if (/does not belong|no pertenece/i.test(msg)) {
    throw new SatDescargaError(
      'El .cer y el .key no corresponden al mismo RFC. Use el par de archivos de la misma e.firma.',
      'FIEL_MISMATCH',
      400
    )
  }
  if (/private key|invalid key|bad decrypt|password|contrase/i.test(msg)) {
    throw new SatDescargaError(
      'Contraseña incorrecta o archivo .key dañado. Verifique la contraseña de su FIEL.',
      'FIEL_PASSWORD',
      400
    )
  }
  if (/certificate|certificado|x509|asn/i.test(msg)) {
    throw new SatDescargaError(
      'No se pudo leer el certificado (.cer). Debe ser el archivo FIEL vigente del SAT (no CSD).',
      'FIEL_CER',
      400
    )
  }

  throw new SatDescargaError(
    msg
      ? `No se pudo leer la e.firma: ${msg}`
      : 'No se pudo leer la e.firma. Revise archivos .cer/.key y contraseña.',
    'FIEL_READ',
    400
  )
}

async function crearFielConArchivosTemp(
  cer: Buffer,
  key: Buffer,
  password: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const cerPath = join(tmpdir(), `sat-fiel-${randomUUID()}.cer`)
  const keyPath = join(tmpdir(), `sat-fiel-${randomUUID()}.key`)

  try {
    await writeFile(cerPath, cer)
    await writeFile(keyPath, key)

    const { Credential } = await import('@nodecfdi/credentials/node')
    const { Fiel } = await import('@nodecfdi/sat-ws-descarga-masiva')

    const credential = Credential.openFiles(cerPath, keyPath, password)
    return new Fiel(credential)
  } finally {
    await Promise.all([
      unlink(cerPath).catch(() => undefined),
      unlink(keyPath).catch(() => undefined),
    ])
  }
}

/**
 * Crea FIEL en memoria a partir de archivos subidos (no se persisten).
 */
export async function crearFielDesdeUpload(
  upload: FielUpload
): Promise<SatFielHandle> {
  const password = upload.password
  if (!password) {
    throw new SatDescargaError(
      'Indique la contraseña de la clave privada.',
      'FIEL_PASSWORD',
      400
    )
  }
  if (!upload.cer?.length || !upload.key?.length) {
    throw new SatDescargaError(
      'Suba el certificado (.cer) y la clave privada (.key).',
      'FIEL_FILES',
      400
    )
  }

  const cerNorm = normalizarArchivoFiel(upload.cer)
  const keyNorm = normalizarArchivoFiel(upload.key)
  validarArchivosFiel(upload.cer, upload.key)

  let fiel
  try {
    try {
      fiel = await crearFielConArchivosTemp(cerNorm, keyNorm, password)
    } catch {
      const { Fiel } = await import('@nodecfdi/sat-ws-descarga-masiva')
      fiel = Fiel.create(
        bufferAContenidoFiel(cerNorm),
        bufferAContenidoFiel(keyNorm),
        password
      )
    }
  } catch (err) {
    if (err instanceof SatDescargaError) throw err
    mapearErrorFiel(err)
  }

  if (!fiel.isValid()) {
    throw new SatDescargaError(
      'La e.firma no es válida: debe ser FIEL vigente (no CSD de sellos) y no estar vencida.',
      'FIEL_INVALID',
      400
    )
  }

  const rfc = String(fiel.getRfc()).trim()
  if (!rfc) {
    throw new SatDescargaError(
      'No se pudo obtener el RFC del certificado.',
      'FIEL_RFC',
      400
    )
  }

  return { rfc, fiel }
}

/** Lee archivo de multipart (File, Blob o similar). */
export async function bufferDesdeUpload(
  entry: FormDataEntryValue | null
): Promise<Buffer | null> {
  if (!entry || typeof entry === 'string') return null
  if (typeof (entry as Blob).arrayBuffer !== 'function') return null
  const buf = Buffer.from(await (entry as Blob).arrayBuffer())
  return buf.length > 0 ? buf : null
}
