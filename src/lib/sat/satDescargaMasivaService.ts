import { SatDescargaError } from './satDescargaErrors'
import { parsearCfdiXml, type CfdiRecibidoFila } from './parseCfdiXml'
import type { SatFielHandle } from './satFiel'

const MAX_DIAS_RANGO = 31

function periodoSat(fechaInicio: string, fechaFin: string): {
  inicio: string
  fin: string
} {
  const ini = fechaInicio.trim()
  const fin = fechaFin.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ini) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) {
    throw new SatDescargaError(
      'Use fechas válidas (AAAA-MM-DD).',
      'FECHAS_INVALIDAS',
      400
    )
  }
  const d1 = new Date(`${ini}T00:00:00`)
  const d2 = new Date(`${fin}T23:59:59`)
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
    throw new SatDescargaError('Fechas inválidas.', 'FECHAS_INVALIDAS', 400)
  }
  if (d2 < d1) {
    throw new SatDescargaError(
      'La fecha fin debe ser posterior o igual a la fecha inicio.',
      'FECHAS_RANGO',
      400
    )
  }
  const dias = Math.ceil((d2.getTime() - d1.getTime()) / 86_400_000)
  if (dias > MAX_DIAS_RANGO) {
    throw new SatDescargaError(
      `El SAT limita consultas largas. Use un rango máximo de ${MAX_DIAS_RANGO} días por solicitud.`,
      'FECHAS_RANGO_LARGO',
      400
    )
  }
  return {
    inicio: `${ini} 00:00:00`,
    fin: `${fin} 23:59:59`,
  }
}

async function crearServicioSat(fielHandle: SatFielHandle) {
  const mod = await import('@nodecfdi/sat-ws-descarga-masiva')
  const {
    FielRequestBuilder,
    HttpsWebClient,
    Service,
    ServiceEndpoints,
  } = mod
  const webClient = new HttpsWebClient()
  const requestBuilder = new FielRequestBuilder(fielHandle.fiel)
  return new Service(
    requestBuilder,
    webClient,
    undefined,
    ServiceEndpoints.cfdi()
  )
}

export type SolicitudDescargaResult = {
  idSolicitud: string
  rfcReceptor: string
  fechaInicio: string
  fechaFin: string
}

export async function solicitarDescargaRecibidos(
  fielHandle: SatFielHandle,
  fechaInicio: string,
  fechaFin: string
): Promise<SolicitudDescargaResult> {
  const mod = await import('@nodecfdi/sat-ws-descarga-masiva')
  const {
    QueryParameters,
    DateTimePeriod,
    DownloadType,
    RequestType,
  } = mod

  const periodo = periodoSat(fechaInicio, fechaFin)
  const service = await crearServicioSat(fielHandle)

  const params = QueryParameters.create(
    DateTimePeriod.createFromValues(periodo.inicio, periodo.fin)
  )
    .withDownloadType(new DownloadType('received'))
    .withRequestType(new RequestType('xml'))

  const errores = params.validate?.() ?? []
  if (errores.length > 0) {
    throw new SatDescargaError(
      `Parámetros inválidos: ${errores.join('; ')}`,
      'QUERY_INVALIDA',
      400
    )
  }

  const query = await service.query(params)
  if (!query.getStatus().isAccepted()) {
    throw new SatDescargaError(
      query.getStatus().getMessage() || 'El SAT rechazó la solicitud de descarga.',
      'SOLICITUD_RECHAZADA',
      502
    )
  }

  const idSolicitud = String(query.getRequestId() ?? '').trim()
  if (!idSolicitud) {
    throw new SatDescargaError(
      'El SAT no devolvió IdSolicitud.',
      'SIN_ID_SOLICITUD',
      502
    )
  }

  return {
    idSolicitud,
    rfcReceptor: fielHandle.rfc,
    fechaInicio,
    fechaFin,
  }
}

export type VerificacionDescargaResult =
  | {
      estado: 'procesando'
      mensaje: string
      codigoEstado: string
    }
  | {
      estado: 'lista'
      idSolicitud: string
      paquetes: string[]
      totalPaquetes: number
    }
  | {
      estado: 'fallida'
      mensaje: string
      codigoEstado: string
    }

export async function verificarSolicitudDescarga(
  fielHandle: SatFielHandle,
  idSolicitud: string
): Promise<VerificacionDescargaResult> {
  const id = idSolicitud.trim()
  if (!id) {
    throw new SatDescargaError('IdSolicitud requerido.', 'SIN_ID', 400)
  }

  const service = await crearServicioSat(fielHandle)
  const verify = await service.verify(id)

  if (!verify.getStatus().isAccepted()) {
    throw new SatDescargaError(
      verify.getStatus().getMessage() || 'Error al verificar solicitud en el SAT.',
      'VERIFICACION_RECHAZADA',
      502
    )
  }

  const statusRequest = verify.getStatusRequest()
  const codigo = String(
    statusRequest.getEntryId?.() ?? statusRequest.getValue?.() ?? ''
  )

  if (
    statusRequest.isTypeOf('Expired') ||
    statusRequest.isTypeOf('Failure') ||
    statusRequest.isTypeOf('Rejected')
  ) {
    return {
      estado: 'fallida',
      mensaje:
        statusRequest.toJSON().message ||
        'La solicitud no pudo completarse en el SAT.',
      codigoEstado: codigo,
    }
  }

  if (
    statusRequest.isTypeOf('InProgress') ||
    statusRequest.isTypeOf('Accepted')
  ) {
    return {
      estado: 'procesando',
      mensaje: 'El SAT aún está preparando los paquetes. Intente de nuevo en unos segundos.',
      codigoEstado: codigo,
    }
  }

  if (!statusRequest.isTypeOf('Finished')) {
    return {
      estado: 'procesando',
      mensaje: `Estado SAT: ${codigo || 'desconocido'}. Espere y vuelva a verificar.`,
      codigoEstado: codigo,
    }
  }

  const paquetes: string[] = []
  for (const packageId of verify.getPackageIds()) {
    paquetes.push(String(packageId))
  }

  return {
    estado: 'lista',
    idSolicitud: id,
    paquetes,
    totalPaquetes: paquetes.length,
  }
}

export async function descargarYExtraerCfdiRecibidos(
  fielHandle: SatFielHandle,
  packageIds: string[]
): Promise<CfdiRecibidoFila[]> {
  if (!packageIds.length) {
    throw new SatDescargaError(
      'No hay paquetes para descargar.',
      'SIN_PAQUETES',
      400
    )
  }

  const mod = await import('@nodecfdi/sat-ws-descarga-masiva')
  const { CfdiPackageReader } = mod
  const service = await crearServicioSat(fielHandle)
  const filas: CfdiRecibidoFila[] = []
  const uuids = new Set<string>()

  for (const packageId of packageIds) {
    const download = await service.download(packageId)
    if (!download.getStatus().isAccepted()) {
      throw new SatDescargaError(
        download.getStatus().getMessage() ||
          `No se pudo descargar el paquete ${packageId}.`,
        'DESCARGA_PAQUETE',
        502
      )
    }

    const zipBase64 = download.getPackageContent()
    const zipBinary = Buffer.from(zipBase64, 'base64').toString('binary')

    let reader
    try {
      reader = await CfdiPackageReader.createFromContents(zipBinary)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ZIP inválido'
      throw new SatDescargaError(
        `Error al abrir paquete ${packageId}: ${msg}`,
        'ZIP_INVALIDO',
        500
      )
    }

    for await (const map of reader.cfdis()) {
      for (const [, content] of map) {
        const xml =
          typeof content === 'string'
            ? content
            : Buffer.from(content as ArrayBuffer).toString('utf8')
        const fila = parsearCfdiXml(xml)
        if (!fila) continue
        const key = fila.uuid || `${fila.emisorRfc}-${fila.fecha}-${fila.total}`
        if (uuids.has(key)) continue
        uuids.add(key)
        filas.push(fila)
      }
    }
  }

  filas.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return filas
}
