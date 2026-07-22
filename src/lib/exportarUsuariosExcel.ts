import ExcelJS from 'exceljs'
import {
  nombreCompletoUsuario,
  type UsuarioRegistro,
} from '@/lib/usuarioCatalogoService'

/** Anchos en caracteres Excel; email/clave amplios para no empalmar. */
const ANCHOS = {
  id: 8,
  username: 16,
  nombre: 34,
  email: 42,
  password: 22,
  perfil: 10,
  nivel: 8,
  status: 11,
  alta: 20,
} as const

function descargarBuffer(buffer: ArrayBuffer | ExcelJS.Buffer, nombre: string) {
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  window.URL.revokeObjectURL(url)
}

function bordeFino(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFCBD5E1' } }
  return { top: side, left: side, bottom: side, right: side }
}

function statusLabel(s: number | null | undefined): string {
  return Number(s) === 1 ? 'Activo' : 'Inactivo'
}

function anchoParaTexto(texto: string, min: number, max: number): number {
  const len = String(texto ?? '').trim().length
  // Excel: ~1 unidad ≈ 1 carácter + margen
  return Math.min(max, Math.max(min, len + 2))
}

export async function exportarUsuariosExcel(usuarios: UsuarioRegistro[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Servicios Administrativos'
  workbook.created = new Date()

  const fechaGen = new Date().toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const ordenados = [...usuarios].sort((a, b) => a.usuario_id - b.usuario_id)

  const anchoEmail = Math.max(
    ANCHOS.email,
    ...ordenados.map((u) => anchoParaTexto(u.usuario_email ?? '', ANCHOS.email, 55))
  )
  const anchoClave = Math.max(
    ANCHOS.password,
    ...ordenados.map((u) => anchoParaTexto(u.usuario_password ?? '', ANCHOS.password, 36))
  )
  const anchoNombre = Math.max(
    ANCHOS.nombre,
    ...ordenados.map((u) => anchoParaTexto(nombreCompletoUsuario(u), ANCHOS.nombre, 48))
  )
  const anchoUser = Math.max(
    ANCHOS.username,
    ...ordenados.map((u) => anchoParaTexto(u.usuario_username ?? '', ANCHOS.username, 24))
  )

  const ws = workbook.addWorksheet('Usuarios', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 22 },
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })

  ws.columns = [
    { key: 'id', width: ANCHOS.id },
    { key: 'username', width: anchoUser },
    { key: 'nombre', width: anchoNombre },
    { key: 'email', width: anchoEmail },
    { key: 'password', width: anchoClave },
    { key: 'perfil', width: ANCHOS.perfil },
    { key: 'nivel', width: ANCHOS.nivel },
    { key: 'status', width: ANCHOS.status },
    { key: 'alta', width: ANCHOS.alta },
  ]

  const titulo = ws.addRow(['Catálogo de usuarios — personal administrativo'])
  titulo.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } }
  ws.mergeCells(1, 1, 1, 9)
  ws.getRow(1).height = 26

  const sub = ws.addRow([
    `Generado: ${fechaGen}  ·  ${usuarios.length} registro(s)  ·  Instituto Winston Churchill / Educativo`,
  ])
  sub.font = { size: 10, color: { argb: 'FF64748B' } }
  ws.mergeCells(2, 1, 2, 9)
  ws.getRow(2).height = 18

  ws.addRow([])

  const header = ws.addRow([
    'ID',
    'Username',
    'Nombre completo',
    'Email',
    'Clave',
    'Perfil',
    'Nivel',
    'Estatus',
    'Alta',
  ])
  header.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.border = bordeFino()
  })
  header.height = 24

  ordenados.forEach((u, idx) => {
    const row = ws.addRow([
      u.usuario_id,
      u.usuario_username,
      nombreCompletoUsuario(u),
      u.usuario_email ?? '',
      u.usuario_password ?? '',
      u.perfil_id ?? '',
      u.nivel ?? '',
      statusLabel(u.usuario_status),
      u.usuario_alta ? String(u.usuario_alta).slice(0, 19) : '',
    ])
    const zebra = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'
    row.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } }
      cell.border = bordeFino()
      cell.font = { size: 10, color: { argb: 'FF0F172A' } }
      // Sin wrap: email/clave en una sola línea (ancho ya calculado).
      const izq = col === 3 || col === 4 || col === 5
      cell.alignment = {
        vertical: 'middle',
        horizontal: izq ? 'left' : 'center',
        wrapText: false,
        shrinkToFit: false,
      }
    })
    if (Number(u.usuario_status) !== 1) {
      row.getCell(8).font = { size: 10, color: { argb: 'FFB91C1C' }, bold: true }
    } else {
      row.getCell(8).font = { size: 10, color: { argb: 'FF047857' }, bold: true }
    }
    row.height = 22
  })

  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + ordenados.length, column: 9 },
  }

  const buf = await workbook.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)
  descargarBuffer(buf, `usuarios_catalogo_${stamp}.xlsx`)
}
