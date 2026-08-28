import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { SatDescargaError } from './satDescargaErrors'
import {
  diagnosticoFielUpload,
  logFalloFiel,
} from './satFielOpenSsl'
import {
  certificadoLegible,
  crearFielConNodeCrypto,
  variantesPassword,
} from './satFielNodeCrypto'

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
 */
export function normalizarArchivoFiel(buf: Buffer): Buffer {
  const sinBom = quitarBom(buf)
  if (sinBom.length === 0) return sinBom

  const comoTexto = sinBom.toString('utf8').trim()
  if (comoTexto.startsWith('-----BEGIN')) {
    return Buffer.from(comoTexto, 'utf8')
  }

  if (sinBom[0] === 0x30) {
    return sinBom
  }

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
      400,
      `cerBytes=${cer.length}`
    )
  }
  if (keyN.length < 100) {
    throw new SatDescargaError(
      `La clave privada (.key) parece incompleta (${key.length} bytes). Descárguela de nuevo del SAT.`,
      'FIEL_KEY',
      400,
      `keyBytes=${key.length}`
    )
  }
}

function esFalloContrasenaOFformato(fallos: string[]): boolean {
  if (!fallos.length) return false
  return fallos.every((f) =>
    /bad decrypt|unparsed der|invalid key|password|private key|descifr|cannot open private key/i.test(
      f
    )
  )
}

function mensajeFalloFiel(
  fallos: string[],
  cerOriginal: Buffer
): { message: string; code: string } {
  const cerOk = certificadoLegible(cerOriginal)

  if (esFalloContrasenaOFformato(fallos)) {
    if (cerOk) {
      return {
        code: 'FIEL_PASSWORD',
        message:
          'El certificado .cer se lee correctamente, pero la contraseña no abre el archivo .key. Confirme que usa la contraseña exacta de la e.firma (FIEL) del SAT — no la del CSD de facturación — y que el .key es del mismo trámite que el .cer.',
      }
    }
    return {
      code: 'FIEL_PASSWORD',
      message:
        'Contraseña incorrecta o archivo .key dañado. Verifique la contraseña de su FIEL.',
    }
  }

  return {
    code: 'FIEL_READ',
    message: 'No se pudo leer la e.firma. Revise archivos .cer/.key y contraseña.',
  }
}

function mapearErrorFiel(
  err: unknown,
  detailPrevio?: string,
  cer?: Buffer
): never {
  const msg = err instanceof Error ? err.message.trim() : String(err)
  const detail = [detailPrevio, msg].filter(Boolean).join(' | ')

  if (/does not belong|no pertenece/i.test(msg)) {
    throw new SatDescargaError(
      'El .cer y el .key no corresponden al mismo RFC. Use el par de archivos de la misma e.firma.',
      'FIEL_MISMATCH',
      400,
      detail
    )
  }
  if (/private key|invalid key|bad decrypt|password|contrase|descifr/i.test(msg)) {
    throw new SatDescargaError(
      'Contraseña incorrecta o archivo .key dañado. Verifique la contraseña de su FIEL.',
      'FIEL_PASSWORD',
      400,
      detail
    )
  }
  if (/certificate|certificado|x509|asn/i.test(msg)) {
    throw new SatDescargaError(
      'No se pudo leer el certificado (.cer). Debe ser el archivo FIEL vigente del SAT (no CSD).',
      'FIEL_CER',
      400,
      detail
    )
  }

  throw new SatDescargaError(
    msg
      ? `No se pudo leer la e.firma: ${msg}`
      : 'No se pudo leer la e.firma. Revise archivos .cer/.key y contraseña.',
    'FIEL_READ',
    400,
    detail
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

async function crearFielEnMemoria(
  cer: Buffer,
  key: Buffer,
  password: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { Fiel } = await import('@nodecfdi/sat-ws-descarga-masiva')
  return Fiel.create(
    bufferAContenidoFiel(cer),
    bufferAContenidoFiel(key),
    password
  )
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

  const diag = diagnosticoFielUpload(upload.cer, upload.key)
  const fallos: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiel: any

  const metodos = [
    (pass: string) => crearFielConArchivosTemp(cerNorm, keyNorm, pass),
    (pass: string) => crearFielEnMemoria(cerNorm, keyNorm, pass),
    (pass: string) => crearFielConNodeCrypto(cerNorm, keyNorm, pass),
  ]
  const nombres = ['nodecfdi-openfiles', 'nodecfdi-memoria', 'node-crypto']

  for (const pass of variantesPassword(password)) {
    for (let i = 0; i < metodos.length; i++) {
      const nombre = nombres[i]
      try {
        fiel = await metodos[i](pass)
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const etiqueta = `${nombre}${pass !== password ? '-altpass' : ''}`
        if (!fallos.some((f) => f.startsWith(`${etiqueta}:`))) {
          fallos.push(`${etiqueta}: ${msg}`)
          logFalloFiel(etiqueta, err, diag)
        }
      }
    }
    if (fiel) break
  }

  if (!fiel) {
    const { message, code } = mensajeFalloFiel(fallos, upload.cer)
    throw new SatDescargaError(message, code, 400, fallos.join(' || '))
  }

  if (!fiel.isValid()) {
    throw new SatDescargaError(
      'La e.firma no es válida: debe ser FIEL vigente (no CSD de sellos) y no estar vencida.',
      'FIEL_INVALID',
      400,
      fallos.length ? `intentosPrevios=${fallos.length}` : undefined
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
