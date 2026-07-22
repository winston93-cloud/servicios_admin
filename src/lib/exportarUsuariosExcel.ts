import ExcelJS from 'exceljs'
import {
  nombreCompletoUsuario,
  type UsuarioRegistro,
} from '@/lib/usuarioCatalogoService'

const ANCHOS = {
  id: 8,
  username: 16,
  nombre: 36,
  email: 28,
  password: 16,
  perfil: 10,
  nivel: 8,
  status: 10,
  alta: 18,
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

export async function exportarUsuariosExcel(usuarios: UsuarioRegistro[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Servicios Administrativos'
  workbook.created = new Date()

  const fechaGen = new Date().toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const ws = workbook.addWorksheet('Usuarios', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  })

  ws.columns = [
    { key: 'id', width: ANCHOS.id },
    { key: 'username', width: ANCHOS.username },
    { key: 'nombre', width: ANCHOS.nombre },
    { key: 'email', width: ANCHOS.email },
    { key: 'password', width: ANCHOS.password },
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
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = bordeFino()
  })
  header.height = 22

  const ordenados = [...usuarios].sort((a, b) => a.usuario_id - b.usuario_id)

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
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 3 || col === 4 ? 'left' : 'center',
        wrapText: true,
      }
    })
    if (Number(u.usuario_status) !== 1) {
      row.getCell(8).font = { size: 10, color: { argb: 'FFB91C1C' }, bold: true }
    } else {
      row.getCell(8).font = { size: 10, color: { argb: 'FF047857' }, bold: true }
    }
    row.height = 20
  })

  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + ordenados.length, column: 9 },
  }

  const buf = await workbook.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)
  descargarBuffer(buf, `usuarios_catalogo_${stamp}.xlsx`)
}
