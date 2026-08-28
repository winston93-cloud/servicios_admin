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

/**
 * Crea FIEL en memoria a partir de archivos subidos (no se persisten).
 *
 * Usamos `Fiel` re-exportado por `@nodecfdi/sat-ws-descarga-masiva` (recomendado
 * en su README). Ese paquete depende de `@nodecfdi/credentials` para la
 * criptografía; no implementamos SOAP ni firma RSA manualmente.
 */
export async function crearFielDesdeUpload(
  upload: FielUpload
): Promise<SatFielHandle> {
  const password = upload.password.trim()
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

  const mod = await import('@nodecfdi/sat-ws-descarga-masiva')
  const { Fiel } = mod

  let fiel
  try {
    fiel = Fiel.create(
      upload.cer.toString('binary'),
      upload.key.toString('binary'),
      password
    )
  } catch {
    throw new SatDescargaError(
      'No se pudo leer la e.firma. Revise archivos .cer/.key y contraseña.',
      'FIEL_READ',
      400
    )
  }

  if (!fiel.isValid()) {
    throw new SatDescargaError(
      'La e.firma no es válida: debe ser FIEL vigente (no CSD de sellos).',
      'FIEL_INVALID',
      400
    )
  }

  const rfc = String(fiel.getRfc?.() ?? fiel.rfc ?? '').trim()
  if (!rfc) {
    throw new SatDescargaError(
      'No se pudo obtener el RFC del certificado.',
      'FIEL_RFC',
      400
    )
  }

  return { rfc, fiel }
}
