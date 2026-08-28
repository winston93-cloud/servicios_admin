import ExcelJS from 'exceljs'
import type { CfdiRecibidoFila } from './parseCfdiXml'

const HEADERS = [
  'UUID',
  'Fecha',
  'Serie',
  'Folio',
  'Tipo',
  'RFC Emisor',
  'Nombre Emisor',
  'RFC Receptor',
  'Nombre Receptor',
  'SubTotal',
  'Descuento',
  'Total',
  'Moneda',
] as const

export async function generarExcelCfdiRecibidos(
  filas: CfdiRecibidoFila[],
  meta?: { rfcReceptor?: string; desde?: string; hasta?: string }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'servicios_admin'
  wb.created = new Date()

  const ws = wb.addWorksheet('CFDI Recibidos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [
    { key: 'uuid', width: 38 },
    { key: 'fecha', width: 22 },
    { key: 'serie', width: 10 },
    { key: 'folio', width: 12 },
    { key: 'tipo', width: 8 },
    { key: 'emisorRfc', width: 16 },
    { key: 'emisorNombre', width: 36 },
    { key: 'receptorRfc', width: 16 },
    { key: 'receptorNombre', width: 36 },
    { key: 'subtotal', width: 14 },
    { key: 'descuento', width: 12 },
    { key: 'total', width: 14 },
    { key: 'moneda', width: 8 },
  ]

  const header = ws.addRow([...HEADERS])
  header.font = { bold: true }
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  }

  for (const f of filas) {
    ws.addRow({
      uuid: f.uuid,
      fecha: f.fecha,
      serie: f.serie,
      folio: f.folio,
      tipo: f.tipoComprobante,
      emisorRfc: f.emisorRfc,
      emisorNombre: f.emisorNombre,
      receptorRfc: f.receptorRfc,
      receptorNombre: f.receptorNombre,
      subtotal: f.subtotal,
      descuento: f.descuento,
      total: f.total,
      moneda: f.moneda,
    })
  }

  ;['subtotal', 'descuento', 'total'].forEach((col) => {
    ws.getColumn(col).numFmt = '#,##0.00'
  })

  if (meta?.rfcReceptor || meta?.desde) {
    const info = wb.addWorksheet('Info')
    info.addRow(['RFC receptor (FIEL)', meta.rfcReceptor ?? ''])
    info.addRow(['Desde', meta.desde ?? ''])
    info.addRow(['Hasta', meta.hasta ?? ''])
    info.addRow(['Registros', filas.length])
    info.addRow(['Generado', new Date().toISOString()])
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
