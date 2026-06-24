import type { DatosFacturacion } from '../datosFacturacionTypes'
import type { CfdiEmisorPacConfig } from './cfdiEmisor'
import type { CfdiConceptoResuelto, CfdiInstitucionEducativa, FormaPagoCfdi } from './cfdiTypes'

export interface ReceptorCfdi {
  rfc: string
  razonSocial: string
  regimenFiscal: string
  usoCfdi: string
  codigoPostal: string
  calle: string
  nexterior: string
  ninterior: string
  colonia: string
  municipio: string
  entidad: string
  email: string
}

export const RECEPTOR_PUBLICO_GENERAL: ReceptorCfdi = {
  rfc: 'XAXX010101000',
  razonSocial: 'PUBLICO EN GENERAL.',
  regimenFiscal: '616',
  usoCfdi: 'S01',
  codigoPostal: '89440',
  calle: 'CONOCIDA',
  nexterior: 'S/N',
  ninterior: '',
  colonia: 'CONOCIDA',
  municipio: 'TAMPICO',
  entidad: 'TAMAULIPAS',
  email: 'isc.escobedo@gmail.com',
}

export function receptorDesdeDatosFacturacion(d: DatosFacturacion): ReceptorCfdi {
  return {
    rfc: d.rfc.trim().toUpperCase(),
    razonSocial: d.razsocial.trim().toUpperCase(),
    regimenFiscal: d.regfiscal.trim(),
    usoCfdi: d.usocfdi.trim().toUpperCase(),
    codigoPostal: d.codpostal.trim(),
    calle: d.calle.trim(),
    nexterior: d.nexterior.trim() || 'S/N',
    ninterior: d.ninterior.trim(),
    colonia: d.ncolonia.trim(),
    municipio: d.nmunicipio.trim(),
    entidad: d.nentidad.trim(),
    email: d.email.trim(),
  }
}

export interface TimbradoPayloadInput {
  emisor: CfdiEmisorPacConfig
  receptor: ReceptorCfdi
  concepto: CfdiConceptoResuelto
  institucion: CfdiInstitucionEducativa
  monto: number
  formaPago: FormaPagoCfdi
  receptorEmail?: string
}

export function construirPayloadFacturoPorTi(input: TimbradoPayloadInput): object {
  const montoStr = input.monto.toFixed(2)
  const fecha = new Date().toISOString().slice(0, 19)

  return {
    DatosGenerales: {
      Version: '4.0',
      CSD: input.emisor.csd,
      LlavePrivada: input.emisor.llavePrivada,
      CSDPassword: input.emisor.csdPassword,
      GeneraPDF: true,
      Logotipo: input.emisor.logoBase64 || '',
      CFDI: 'Factura',
      OpcionDecimales: 2,
      NumeroDecimales: 2,
      TipoCFDI: 'Ingreso',
      EnviaEmail: true,
      ReceptorEmail: input.receptorEmail || input.receptor.email,
      ReceptorEmailCC: '',
      ReceptorEmailCCO: '',
      EmailMensaje: input.emisor.emailMensaje,
    },
    Encabezado: {
      CFDIsRelacionados: null,
      TipoRelacion: null,
      Emisor: {
        RFC: input.emisor.rfc,
        NombreRazonSocial: input.emisor.razonSocial,
        RegimenFiscal: input.emisor.regimenFiscal,
        Direccion: [
          {
            Calle: input.emisor.calle,
            NumeroExterior: input.emisor.numeroExterior,
            NumeroInterior: '',
            Colonia: input.emisor.colonia,
            Localidad: '',
            Municipio: input.emisor.municipio,
            Estado: input.emisor.estado,
            Pais: 'México',
            CodigoPostal: input.emisor.codigoPostal,
          },
        ],
      },
      Receptor: {
        RFC: input.receptor.rfc,
        NombreRazonSocial: input.receptor.razonSocial,
        UsoCFDI: input.receptor.usoCfdi,
        RegimenFiscal: input.receptor.regimenFiscal,
        Direccion: {
          Calle: input.receptor.calle,
          NumeroExterior: input.receptor.nexterior,
          NumeroInterior: input.receptor.ninterior,
          Colonia: input.receptor.colonia,
          Localidad: '',
          Municipio: input.receptor.municipio,
          Estado: input.receptor.entidad,
          Pais: 'México',
          CodigoPostal: input.receptor.codigoPostal,
        },
      },
      Fecha: fecha,
      Serie: input.emisor.serie,
      Folio: '0',
      MetodoPago: 'PUE',
      FormaPago: input.formaPago,
      Moneda: 'MXN',
      LugarExpedicion: input.emisor.lugarExpedicion,
      SubTotal: montoStr,
      Total: montoStr,
    },
    Conceptos: [
      {
        Cantidad: 1,
        CodigoUnidad: 'E48',
        Unidad: 'SERVICIO',
        CodigoProducto: input.concepto.codigoProducto,
        Producto: input.concepto.descripcion,
        PrecioUnitario: montoStr,
        Importe: montoStr,
        ObjetoDeImpuesto: '02',
        Impuestos: [
          {
            TipoImpuesto: 1,
            Impuesto: 2,
            Factor: 3,
            Base: montoStr,
          },
        ],
        InstitucionesEducativas: {
          NombreAlumno: input.institucion.nombreAlumno,
          CURP: input.institucion.curp,
          NivelEducativo: input.institucion.nivelEducativo,
          ClaveInstitucionEducativa: input.institucion.claveInstitucion,
        },
      },
    ],
  }
}

export interface NotaCreditoPayloadInput extends TimbradoPayloadInput {
  uuidRelacionado: string
  tipoRelacion: string
}

export function construirPayloadNotaCredito(input: NotaCreditoPayloadInput): object {
  const base = construirPayloadFacturoPorTi(input) as {
    DatosGenerales: Record<string, unknown>
    Encabezado: Record<string, unknown>
    Conceptos: Array<Record<string, unknown>>
  }

  const montoStr = input.monto.toFixed(2)

  base.DatosGenerales.CFDI = 'NotaCredito'
  base.DatosGenerales.TipoCFDI = 'Egreso'
  base.DatosGenerales.EmailMensaje =
    input.emisor.clave === 'churchill'
      ? 'Devoluciones Instituto Winston Churchill'
      : 'Devoluciones Educativo'
  base.DatosGenerales.ReceptorEmail = 'devoluciones@winston93.edu.mx'

  base.Encabezado.CFDIsRelacionados = input.uuidRelacionado
  base.Encabezado.TipoRelacion = input.tipoRelacion
  base.Encabezado.FormaPago = '02'

  const concepto = base.Conceptos[0]
  if (concepto?.Impuestos && Array.isArray(concepto.Impuestos)) {
    concepto.Impuestos = [
      {
        TipoImpuesto: '1',
        Impuesto: '2',
        Factor: '3',
        Base: montoStr,
        Tasa: '0.160000',
        ImpuestoImporte: (input.monto * 0.16).toFixed(2),
      },
    ]
  }

  return base
}
