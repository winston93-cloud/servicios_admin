/**
 * Genera 4 Excel de accesos para directoras (Educativo ES/EN + Primaria ES/EN).
 * Uso: node scripts/generar-excels-claves-directorias.mjs
 */
import { createClient } from '@insforge/sdk'
import { readFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import ExcelJS from 'exceljs'

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const db = createClient({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: env.INSFORGE_API_KEY,
}).database

const CLAVE = JSON.parse(readFileSync(resolve('tmp/claves-educativo-primaria-8dig.json'), 'utf8'))
  .clave_plana_8_digitos
const titulares = JSON.parse(readFileSync(resolve('scripts/data/titulares-es-en-2627.json'), 'utf8'))
  .titulares

const URL_RAC = 'https://servicios.winston93.edu.mx/reportes-conducta'

const emailMeta = new Map()
for (const t of titulares) {
  emailMeta.set(String(t.correo).toLowerCase(), {
    idioma: t.idioma,
    maestroNivel: t.maestroNivel,
    nombreExcel: t.nombre,
  })
}

function nombreCompleto(m) {
  return [m.maestro_nombre, m.maestro_app, m.maestro_apm]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function etiquetaNivel(n) {
  if (n === 1) return 'Maternal'
  if (n === 2) return 'Kinder'
  if (n === 3) return 'Primaria'
  return String(n)
}

function inferIdioma(m) {
  const meta = emailMeta.get(String(m.maestro_email || '').toLowerCase())
  if (meta?.idioma) return meta.idioma
  const u = `${m.maestro_usuario || ''} ${m.maestro_email || ''}`.toLowerCase()
  if (/(english|grade|nursery|toddlers|pre-k|pre-first|kgarten|firstgrade|secondgrade|thirdgrade|fourthgrade|fifthgrade|sixthgrade)/.test(u)) {
    return 'en'
  }
  return 'es'
}

async function buildWorkbook(meta, rows) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Servicios Administrativos Winston'
  wb.created = new Date()
  const ws = wb.addWorksheet('Accesos', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { fitToPage: true, orientation: 'landscape', paperSize: 9 },
  })

  ws.columns = [
    { width: 5 },
    { width: 12 },
    { width: 12 },
    { width: 42 },
    { width: 28 },
    { width: 42 },
    { width: 14 },
  ]

  ws.mergeCells('A1:G1')
  ws.getCell('A1').value = 'Instituto Winston Churchill'
  ws.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } }

  ws.mergeCells('A2:G2')
  ws.getCell('A2').value = meta.titulo
  ws.getCell('A2').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFB45309' } }

  ws.mergeCells('A3:G3')
  ws.getCell('A3').value = meta.subtitulo
  ws.getCell('A3').font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF334155' } }

  ws.mergeCells('A4:G4')
  ws.getCell('A4').value =
    `Para: ${meta.destinario}  ·  Ciclo 2026-2027  ·  Generado ${new Date().toLocaleString('es-MX')}`
  ws.getCell('A4').font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } }

  ws.mergeCells('A5:G5')
  ws.getCell('A5').value = [
    'Cada docente entra con su usuario y la contraseña indicada.',
    `Enlace: ${URL_RAC}`,
    'Contraseña general del ciclo (8 dígitos). Uso interno — no reenviar fuera del colegio.',
  ].join('  |  ')
  ws.getCell('A5').font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } }
  ws.getCell('A5').alignment = { wrapText: true, vertical: 'middle' }
  ws.getRow(5).height = 30

  const header = ws.getRow(6)
  header.values = ['#', 'Nivel', 'Área', 'Nombre completo', 'Usuario', 'Correo institucional', 'Contraseña']
  header.height = 22
  header.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } }
  header.alignment = { vertical: 'middle', horizontal: 'center' }
  for (let c = 1; c <= 7; c++) {
    const cell = header.getCell(c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const na = a.nivel.localeCompare(b.nivel, 'es')
    if (na) return na
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  sorted.forEach((r, i) => {
    const row = ws.addRow([i + 1, r.nivel, r.idioma, r.nombre, r.usuario, r.correo, r.clave])
    row.font = { name: 'Calibri', size: 11 }
    row.alignment = { vertical: 'middle' }
    row.getCell(5).font = { name: 'Consolas', size: 11 }
    row.getCell(7).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFB45309' } }
    const bg = i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    }
  })

  ws.addRow([])
  const f2 = ws.addRow([`Total docentes: ${sorted.length}   ·   Contraseña general: ${CLAVE}`])
  ws.mergeCells(`A${f2.number}:G${f2.number}`)
  f2.font = { name: 'Calibri', size: 11, bold: true }

  const f3 = ws.addRow([`Enlace al sistema: ${URL_RAC}`])
  ws.mergeCells(`A${f3.number}:G${f3.number}`)
  f3.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF0369A1' }, underline: true }

  await wb.xlsx.writeFile(meta.path)
  return { path: meta.path, n: sorted.length, destinario: meta.destinario }
}

async function main() {
  const { data: maestros, error } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_usuario, maestro_nombre, maestro_app, maestro_apm, maestro_email, maestro_nivel')
    .in('maestro_nivel', [1, 2, 3])
  if (error) throw new Error(error.message)
  if (!maestros?.length) throw new Error('No hay maestros nivel 1–3')

  const buckets = {
    kinder_es: [],
    kinder_en: [],
    prim_es: [],
    prim_en: [],
  }

  for (const m of maestros) {
    const idioma = inferIdioma(m)
    const meta = emailMeta.get(String(m.maestro_email || '').toLowerCase())
    const row = {
      nivel: etiquetaNivel(m.maestro_nivel),
      idioma: idioma === 'es' ? 'Español' : 'Inglés',
      nombre: meta?.nombreExcel || nombreCompleto(m),
      usuario: m.maestro_usuario,
      correo: m.maestro_email || '',
      clave: CLAVE,
    }
    if (m.maestro_nivel <= 2 && idioma === 'es') buckets.kinder_es.push(row)
    else if (m.maestro_nivel <= 2 && idioma === 'en') buckets.kinder_en.push(row)
    else if (m.maestro_nivel === 3 && idioma === 'es') buckets.prim_es.push(row)
    else if (m.maestro_nivel === 3 && idioma === 'en') buckets.prim_en.push(row)
  }

  const outDir = resolve('tmp/claves-directorias-2627')
  mkdirSync(outDir, { recursive: true })

  const specs = [
    {
      key: 'kinder_es',
      destinario: 'Dirección Kinder / Educativo',
      titulo: 'Educativo — Dirección Kinder',
      subtitulo: 'Maestras de español (Maternal y Kinder) · Reportes académicos y de conducta',
      path: resolve(outDir, '01-direccion-kinder-educativo.xlsx'),
    },
    {
      key: 'kinder_en',
      destinario: 'English Preschool Coordination',
      titulo: 'Educativo — English Preschool',
      subtitulo: 'Teachers (Maternal & Kinder) · Academic & Conduct Reports',
      path: resolve(outDir, '02-english-preschool.xlsx'),
    },
    {
      key: 'prim_es',
      destinario: 'Dirección Primaria',
      titulo: 'Winston Primaria — Dirección',
      subtitulo: 'Maestras de español (1° a 6°) · Reportes académicos y de conducta',
      path: resolve(outDir, '03-direccion-primaria-winston.xlsx'),
    },
    {
      key: 'prim_en',
      destinario: 'English Elementary Coordination',
      titulo: 'Winston Primaria — English Elementary',
      subtitulo: 'Teachers (1st–6th) · Academic & Conduct Reports',
      path: resolve(outDir, '04-english-elementary.xlsx'),
    },
  ]

  const results = []
  for (const spec of specs) {
    results.push(await buildWorkbook(spec, buckets[spec.key]))
  }

  console.log(JSON.stringify(results, null, 2))
  console.log('Carpeta:', outDir)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
