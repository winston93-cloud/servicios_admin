/**
 * Genera Excel plantilla maestros secundaria (matriz clases 26-27).
 * node scripts/generar-excel-plantilla-maestros-secundaria.mjs
 */
import ExcelJS from 'exceljs'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@insforge/sdk'

const env = Object.fromEntries(
  readFileSync(resolve('.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim().replace(/:$/, ''), l.slice(i + 1).trim()]
    })
)

const client = createClient({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: env.INSFORGE_API_KEY,
})

const GRUPOS = ['7A', '7B', '7C', '8A', '8B', '9A', '9B', '9C']

/** Orden y color como la imagen institucional */
const ASIGNATURAS = [
  { key: 'esp', label: 'Español', color: 'FCE4D6', match: /ESPAÑOL/i },
  { key: 'cie', label: 'Ciencias', color: 'DDEBF7', match: /CIENCIAS/i },
  { key: 'mat', label: 'Matemáticas', color: 'E2D5F1', match: /MATEMÁTICAS/i },
  { key: 'ing', label: 'Inglés', color: 'D0F0E8', match: /INGLES|INGLÉS/i },
  { key: 'his', label: 'Historia', color: 'F8CBAD', match: /HISTORIA/i },
  { key: 'geo', label: 'Geografía', color: 'F8CBAD', match: /GEOGRAFÍA|GEOGRAFIA/i },
  { key: 'civ', label: 'Cívica', color: 'E4DFEC', match: /CÍVICA|CIVICA|FORMACIÓN CÍVICA/i },
  { key: 'art', label: 'Artes', color: 'DDEBF7', match: /ARTES/i },
  { key: 'edf', label: 'Ed. Física', color: 'FCE4D6', match: /EDUCACIÓN FÍSICA|EDUCACION FISICA/i },
  { key: 'tec', label: 'Tecnología', color: 'FFF2CC', match: /TECNOLOGÍA|TECNOLOGIA|INNOVACIÓN/i },
  { key: 'emp', label: 'Emprendimiento', color: 'C6EFCE', match: /EMPRENDIMIENTO/i },
  { key: 'rob', label: 'Robótica', color: 'F8CBAD', match: /ROBÓTICA|ROBOTICA/i },
  { key: 'fra', label: 'Francés', color: 'F8D7E8', match: /FRANCÉS|FRANCES/i },
  { key: 'fsh', label: 'FSH', color: 'F4B183', match: /FORMACIÓN SOCIAL|FORMACION SOCIAL/i },
  { key: 'mind', label: 'Mindfulness', color: 'D6DCE4', match: /MINDFULNESS/i },
]

function gradoEtiqueta(g) {
  if (Number(g) === 1) return '7'
  if (Number(g) === 2) return '8'
  if (Number(g) === 3) return '9'
  return String(g)
}

function nombreCortoMaestro(full) {
  const p = String(full || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
  if (p.length <= 2) return full
  // Nombre + primer apellido (estilo imagen)
  const nombre = p[0]
  // Si hay segundo nombre compuesto tipo "ANA MONTSERRATH LUQUE..."
  // tomar primer token de nombre + apellido principal (penúltimo o el que no sea partícula)
  const app = p.find((t, i) => i > 0 && !/^(DE|DEL|LA|LAS|LOS|Y)$/i.test(t)) || p[1]
  // Preferir: primer nombre + apellido paterno típico (segundo o tercero)
  if (p.length >= 3) {
    // "JACQUELINE PEREZ MORALES" → Jaqueline Pérez
    // "MEIGHLYNG VEIGELIA REYES VARGAS" → Meighlyng Reyes
    // "ANA MONTSERRATH LUQUE FLORES" → Ana Luque
    const known = {
      JACQUELINE: 'Jaqueline Pérez',
      CRISTINA: 'Cristina Castillo',
      LIZZETH: 'Lizzeth Maldonado',
      ORLANDO: 'Orlando Sánchez',
      MARTHA: 'Martha Sánchez',
      KARLA: 'Karla Castillo',
      LESLIE: 'Leslie Vicencio',
      MEIGHLYNG: 'Meighlyng Reyes',
      ANA: 'Ana Luque',
      NOE: 'Noé Trejo',
      NOÉ: 'Noé Trejo',
      JENIFER: 'Jenifer Lizbeth López',
      INGRID: 'Ingrid Mejia Flores',
      MELISSA: 'Melissa Gamez',
      ROSA: 'Rosa Romero',
      MIRNA: 'Mirna Alicia',
      DINORAH: 'Dinorah Lerma',
    }
    const k = p[0].toUpperCase()
    if (known[k]) return known[k]
  }
  return `${titleCase(nombre)} ${titleCase(app)}`
}

function titleCase(s) {
  const t = String(s || '').toLowerCase()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

function asignaturaDe(materiaNombre) {
  return ASIGNATURAS.find((a) => a.match.test(materiaNombre)) || null
}

function expandChecks(materiaGrado, grupoLetra) {
  const g = gradoEtiqueta(materiaGrado)
  const letters = String(grupoLetra || '')
    .toUpperCase()
    .replace(/[^ABC]/g, '')
  const set = new Set()
  for (const L of letters) set.add(`${g}${L}`)
  return set
}

const q = await client.database
  .from('boleta_maestro_grupo')
  .select('maestro_id, materia_id, grupo_letra')
if (q.error) throw new Error(q.error.message)

const mats = await client.database
  .from('boleta_materia')
  .select('materia_id, materia_nombre, materia_grado, materia_nivel')
  .eq('materia_nivel', 4)
if (mats.error) throw new Error(mats.error.message)

const maes = await client.database
  .from('boleta_maestro')
  .select('maestro_id, maestro_nombre, maestro_app, maestro_apm, maestro_usuario')
if (maes.error) throw new Error(maes.error.message)

const matMap = new Map((mats.data || []).map((m) => [Number(m.materia_id), m]))
const maeMap = new Map((maes.data || []).map((m) => [Number(m.maestro_id), m]))

/** row key: asignatura|maestroDisplay → Set of 7A..9C */
const matrix = new Map()
const meta = new Map() // key → {asignatura, maestro, color, maestro_id, usuario}

for (const g of q.data || []) {
  const mat = matMap.get(Number(g.materia_id))
  if (!mat) continue
  const mae = maeMap.get(Number(g.maestro_id))
  if (!mae) continue
  const asig = asignaturaDe(mat.materia_nombre)
  if (!asig) continue
  const full = [mae.maestro_nombre, mae.maestro_app, mae.maestro_apm]
    .filter(Boolean)
    .join(' ')
  const maestro = nombreCortoMaestro(full)
  const key = `${asig.key}|${maestro}`
  if (!matrix.has(key)) {
    matrix.set(key, new Set())
    meta.set(key, {
      asignatura: asig.label,
      color: asig.color,
      order: ASIGNATURAS.findIndex((a) => a.key === asig.key),
      maestro,
      maestro_id: Number(mae.maestro_id),
      usuario: mae.maestro_usuario,
      nombre_completo: full,
    })
  }
  for (const c of expandChecks(mat.materia_grado, g.grupo_letra)) {
    matrix.get(key).add(c)
  }
}

const ordered = [...meta.entries()].sort((a, b) => {
  if (a[1].order !== b[1].order) return a[1].order - b[1].order
  return a[1].maestro.localeCompare(b[1].maestro, 'es')
})

const wb = new ExcelJS.Workbook()
wb.creator = 'servicios_admin'
wb.created = new Date()
const ws = wb.addWorksheet('Maestros secundaria 26-27', {
  views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }],
  properties: { defaultRowHeight: 18 },
})

const thin = {
  style: 'thin',
  color: { argb: 'FF1F1F1F' },
}
const borderAll = { top: thin, left: thin, bottom: thin, right: thin }

// Título
ws.mergeCells('A1', 'K1')
const title = ws.getCell('A1')
title.value = 'WINSTON CHURCHILL — CLASES IMPARTIDAS POR MAESTROS 26-27'
title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0B173A' } }
title.alignment = { vertical: 'middle', horizontal: 'center' }
title.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF2CC' },
}
ws.getRow(1).height = 28

ws.mergeCells('A2', 'K2')
const sub = ws.getCell('A2')
sub.value =
  'Plantilla secundaria · Depurada 26-ago · Con clase arriba · Sin asignación: solo cuentas auxiliares (YOLANDA / IDIOMAS) · Bajas ya aplicadas en BD'
sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF5E6C84' } }
sub.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
ws.getRow(2).height = 22

// Headers
const headers = [
  'Asignatura',
  'Maestro',
  ...GRUPOS.map((g) => `${g.charAt(0)}°${g.charAt(1)}`),
  'Baja',
  'Notas / motivo baja',
]
const headerRow = ws.addRow(headers)
headerRow.height = 22
headerRow.eachCell((cell, col) => {
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0B173A' } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = borderAll
  if (col <= 2) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC6E0B4' },
    }
  } else if (col <= 10) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF2CC' },
    }
  } else {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF4B183' },
    }
  }
})

/** Notas fijas en filas con clase (nuevos / aclaraciones) */
const NOTAS_ASIGNADOS = {
  cristina: 'NUEVO INGRESO EN SECUNDARIA',
  leslie: 'NUEVO INGRESO 26-27',
  jenifer: 'NUEVO INGRESO A SECUNDARIA',
  ingrid: 'NUEVO INGRESO 26-27',
  rosa: 'NUEVO INGRESO 26-27',
  dinorah: 'NUEVO INGRESO 26-27',
  melissa: 'Cuenta activa (antes registrada como Elizabeth Gamez / eli)',
}

for (const [key, info] of ordered) {
  const checks = matrix.get(key)
  const u = String(info.usuario || '').toLowerCase()
  const rowVals = [
    info.asignatura,
    info.maestro,
    ...GRUPOS.map((g) => (checks.has(g) ? '✓' : '')),
    'NO',
    NOTAS_ASIGNADOS[u] || '',
  ]
  const row = ws.addRow(rowVals)
  row.height = 20
  row.eachCell((cell, col) => {
    cell.border = borderAll
    cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF16213E' } }
    if (col === 1 || col === 2) {
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'left' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${info.color}` },
      }
      if (col === 1) cell.font = { ...cell.font, bold: true }
    } else if (col >= 3 && col <= 10) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      if (cell.value === '✓') {
        cell.font = {
          name: 'Calibri',
          size: 14,
          bold: true,
          color: { argb: 'FF1B7A3D' },
        }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2EFDA' },
        }
      } else {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF595959' },
        }
      }
    } else if (col === 11) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF9F0' },
      }
      // validación lista SÍ/NO se agrega abajo
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    }
  })
}

// Anchos
ws.getColumn(1).width = 16
ws.getColumn(2).width = 24
for (let c = 3; c <= 10; c++) ws.getColumn(c).width = 7
ws.getColumn(11).width = 10
ws.getColumn(12).width = 32

// Validación Baja (solo filas de matriz con asignación)
const lastAsigRow = 3 + ordered.length
for (let r = 4; r <= lastAsigRow; r++) {
  ws.getCell(r, 11).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"SÍ,NO"'],
    showErrorMessage: true,
    errorTitle: 'Baja',
    error: 'Elija SÍ o NO',
  }
}

// Separador + maestros en boleta_maestro sin asignación secundaria
const conAsigIds = new Set(ordered.map(([, info]) => info.maestro_id))
const sinAsig = (maes.data || [])
  .filter((m) => !conAsigIds.has(Number(m.maestro_id)))
  .map((m) => ({
    maestro_id: Number(m.maestro_id),
    usuario: m.maestro_usuario,
    nombre_completo: [m.maestro_nombre, m.maestro_app, m.maestro_apm]
      .filter(Boolean)
      .join(' '),
    maestro: nombreCortoMaestro(
      [m.maestro_nombre, m.maestro_app, m.maestro_apm].filter(Boolean).join(' ')
    ),
  }))
  .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))

ws.addRow([])
const sep = ws.addRow([
  'SIN ASIGNACIÓN SECUNDARIA (sí están en boleta_maestro)',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
])
ws.mergeCells(sep.number, 1, sep.number, 12)
sep.getCell(1).font = {
  name: 'Calibri',
  size: 12,
  bold: true,
  color: { argb: 'FFFFFFFF' },
}
sep.getCell(1).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF833C0C' },
}
sep.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
sep.height = 22

/** Cuentas auxiliares sin clase: no son baja */
const NOTAS_SIN_ASIG = {
  yoli: 'Clave auxiliar para capturar / entrar a reportes — NO TOCAR',
  lion: 'Clave que usa teacher Karla (IDIOMAS) — NO TOCAR',
}

const sinStart = sep.number + 1
for (const t of sinAsig) {
  const u = String(t.usuario || '').toLowerCase()
  const nota = NOTAS_SIN_ASIG[u] || 'Sin clase secundaria'
  const rowVals = [
    '(sin clase)',
    t.maestro || t.nombre_completo,
    ...GRUPOS.map(() => ''),
    'NO',
    nota,
  ]
  const row = ws.addRow(rowVals)
  row.height = 20
  row.eachCell((cell, col) => {
    cell.border = borderAll
    cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF16213E' } }
    if (col === 1 || col === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      }
      if (col === 1) {
        cell.font = {
          name: 'Calibri',
          size: 11,
          italic: true,
          color: { argb: 'FF833C0C' },
        }
      }
    } else if (col >= 3 && col <= 10) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFBFBFBF' },
      }
    } else if (col === 11) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF9F0' },
      }
    }
  })
}
const sinEnd = sinStart + sinAsig.length - 1
if (sinAsig.length) {
  for (let r = sinStart; r <= sinEnd; r++) {
    ws.getCell(r, 11).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"SÍ,NO"'],
      showErrorMessage: true,
      errorTitle: 'Baja',
      error: 'Elija SÍ o NO',
    }
  }
}

// Anchos
ws.getColumn(1).width = 16
ws.getColumn(2).width = 24
for (let c = 3; c <= 10; c++) ws.getColumn(c).width = 7
ws.getColumn(11).width = 10
ws.getColumn(12).width = 32

// Hoja auxiliar: catálogo completo
const ws2 = wb.addWorksheet('Catálogo maestros')
ws2.addRow([
  'maestro_id',
  'Usuario',
  'Nombre completo',
  'Asignación secundaria',
  'Asignaturas (resumen)',
  'Baja',
  'Notas',
])
ws2.getRow(1).font = { bold: true }
ws2.getRow(1).eachCell((c) => {
  c.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC6E0B4' },
  }
  c.border = borderAll
})

const byTeacher = new Map()
for (const [, info] of ordered) {
  const id = info.maestro_id
  if (!byTeacher.has(id)) {
    byTeacher.set(id, {
      ...info,
      asignaturas: new Set([info.asignatura]),
      con_asignacion: true,
    })
  } else {
    byTeacher.get(id).asignaturas.add(info.asignatura)
  }
}
for (const t of sinAsig) {
  byTeacher.set(t.maestro_id, {
    maestro_id: t.maestro_id,
    usuario: t.usuario,
    nombre_completo: t.nombre_completo,
    asignaturas: new Set(),
    con_asignacion: false,
  })
}

for (const t of [...byTeacher.values()].sort((a, b) => {
  if (a.con_asignacion !== b.con_asignacion) return a.con_asignacion ? -1 : 1
  return a.nombre_completo.localeCompare(b.nombre_completo, 'es')
})) {
  const u = String(t.usuario || '').toLowerCase()
  const notaCat = t.con_asignacion
    ? NOTAS_ASIGNADOS[u] || ''
    : NOTAS_SIN_ASIG[u] || ''
  const r = ws2.addRow([
    t.maestro_id,
    t.usuario,
    t.nombre_completo,
    t.con_asignacion ? 'Sí' : 'No',
    t.con_asignacion ? [...t.asignaturas].join(', ') : '—',
    'NO',
    notaCat,
  ])
  r.eachCell((c, col) => {
    c.border = borderAll
    if (!t.con_asignacion) {
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      }
    }
    if (col === 4 && !t.con_asignacion) {
      c.font = { italic: true, color: { argb: 'FF833C0C' } }
    }
  })
  ws2.getCell(r.number, 6).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"SÍ,NO"'],
  }
}
ws2.getColumn(1).width = 12
ws2.getColumn(2).width = 14
ws2.getColumn(3).width = 36
ws2.getColumn(4).width = 18
ws2.getColumn(5).width = 40
ws2.getColumn(6).width = 10
ws2.getColumn(7).width = 28

const out = resolve(
  process.env.HOME || '.',
  'Escritorio/Plantilla_Maestros_Secundaria_26-27.xlsx'
)
await wb.xlsx.writeFile(out)
console.log(`OK → ${out}`)
console.log(
  `Con asignación: ${ordered.length} filas / ${conAsigIds.size} maestros | Sin asignación: ${sinAsig.length}`
)