/**
 * Genera 4 Excel de accesos para directoras (Educativo ES/EN + Primaria ES/EN).
 *
 * Datos vivos desde InsForge (boleta_maestro + asignaciones).
 * Contraseña: env CLAVE_8 o tmp/claves-educativo-primaria-8dig.json (no hardcode).
 * URL hub: env SERVICIOS_PUBLIC_URL o NEXT_PUBLIC_SITE_URL + /reportes-conducta
 *
 * Uso: CLAVE_8=38928121 node scripts/generar-excels-claves-directorias.mjs
 */
import { createClient } from '@insforge/sdk'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import ExcelJS from 'exceljs'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return {}
  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )
}

const env = loadEnv()

function resolverClavePlana() {
  if (process.env.CLAVE_8 && /^\d{8}$/.test(process.env.CLAVE_8)) return process.env.CLAVE_8
  const p = resolve(process.cwd(), 'tmp/claves-educativo-primaria-8dig.json')
  if (existsSync(p)) {
    const j = JSON.parse(readFileSync(p, 'utf8'))
    const c = String(j.clave_plana_8_digitos || '')
    if (/^\d{8}$/.test(c)) return c
  }
  throw new Error(
    'Falta la clave plana de 8 dígitos. Exporta CLAVE_8=######## o genera tmp/claves-educativo-primaria-8dig.json con set-clave-general-educativo-primaria.mjs'
  )
}

function resolverUrlHub() {
  const base = (
    process.env.SERVICIOS_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    env.SERVICIOS_PUBLIC_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    'https://servicios.winston93.edu.mx'
  ).replace(/\/$/, '')
  return `${base}/reportes-conducta`
}

const CLAVE = resolverClavePlana()
const URL_HUB = resolverUrlHub()

const db = createClient({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: env.INSFORGE_API_KEY,
}).database

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

/** idioma desde asignación a slot Maestro(a)=1 / Teacher=2; fallback por correo/usuario. */
function idiomaDesdeAsignacion(maestroId, asigMap) {
  const hit = asigMap.get(maestroId)
  if (hit === 1) return 'es'
  if (hit === 2) return 'en'
  return null
}

function idiomaFallback(m) {
  const u = `${m.maestro_usuario || ''} ${m.maestro_email || ''}`.toLowerCase()
  if (
    /(english|grade|nursery|toddlers|pre-k|pre-first|kgarten|firstgrade|secondgrade|thirdgrade|fourthgrade|fifthgrade|sixthgrade)/.test(
      u
    )
  ) {
    return 'en'
  }
  return 'es'
}

async function buildWorkbook(meta, rows) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Servicios Administrativos Winston'
  wb.created = new Date()
  const ws = wb.addWorksheet('Accesos', {
    views: [{ state: 'frozen', ySplit: 7 }],
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
  ws.getCell('A5').value =
    `Cómo entrar: 1) Abrir el hub  2) Elegir la tarjeta de su nivel (Maternal/Kinder o Primaria)  3) Iniciar sesión con usuario y contraseña de esta lista.`
  ws.getCell('A5').font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } }
  ws.getCell('A5').alignment = { wrapText: true, vertical: 'middle' }
  ws.getRow(5).height = 28

  ws.mergeCells('A6:G6')
  ws.getCell('A6').value = `Hub (3 tarjetas): ${URL_HUB}`
  ws.getCell('A6').font = { name: 'Calibri', size: 10, color: { argb: 'FF0369A1' }, underline: true }

  const header = ws.getRow(7)
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
  const f2 = ws.addRow([`Total docentes: ${sorted.length}   ·   Contraseña general del grupo (desde catálogo): ${CLAVE}`])
  ws.mergeCells(`A${f2.number}:G${f2.number}`)
  f2.font = { name: 'Calibri', size: 11, bold: true }

  const f3 = ws.addRow([`Hub: ${URL_HUB}  →  elige tarjeta  →  login del nivel`])
  ws.mergeCells(`A${f3.number}:G${f3.number}`)
  f3.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF0369A1' } }

  await wb.xlsx.writeFile(meta.path)
  return { path: meta.path, n: sorted.length, destinario: meta.destinario }
}

async function main() {
  const { data: maestros, error } = await db
    .from('boleta_maestro')
    .select('maestro_id, maestro_usuario, maestro_nombre, maestro_app, maestro_apm, maestro_email, maestro_nivel')
    .in('maestro_nivel', [1, 2, 3])
  if (error) throw new Error(error.message)
  if (!maestros?.length) throw new Error('No hay maestros nivel 1–3 en boleta_maestro')

  const { data: materias, error: eMat } = await db
    .from('boleta_materia')
    .select('materia_id, materia_orden, materia_nivel')
    .in('materia_nivel', [1, 2, 3])
    .in('materia_orden', [1, 2])
  if (eMat) throw new Error(eMat.message)

  const matOrden = new Map((materias || []).map((m) => [Number(m.materia_id), Number(m.materia_orden)]))
  const matIds = [...matOrden.keys()]
  const asigMap = new Map()
  if (matIds.length) {
    const { data: asigs, error: eAsig } = await db
      .from('boleta_maestro_grupo')
      .select('maestro_id, materia_id')
      .in('materia_id', matIds)
    if (eAsig) throw new Error(eAsig.message)
    for (const a of asigs || []) {
      const orden = matOrden.get(Number(a.materia_id))
      if (orden) asigMap.set(Number(a.maestro_id), orden)
    }
  }

  const buckets = { kinder_es: [], kinder_en: [], prim_es: [], prim_en: [] }

  for (const m of maestros) {
    const idioma = idiomaDesdeAsignacion(Number(m.maestro_id), asigMap) || idiomaFallback(m)
    const row = {
      nivel: etiquetaNivel(m.maestro_nivel),
      idioma: idioma === 'es' ? 'Español' : 'Inglés',
      nombre: nombreCompleto(m),
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
      subtitulo: 'Maestras de español (Maternal y Kinder)',
      path: resolve(outDir, '01-direccion-kinder-educativo.xlsx'),
    },
    {
      key: 'kinder_en',
      destinario: 'English Preschool Coordination',
      titulo: 'Educativo — English Preschool',
      subtitulo: 'Teachers (Maternal & Kinder)',
      path: resolve(outDir, '02-english-preschool.xlsx'),
    },
    {
      key: 'prim_es',
      destinario: 'Dirección Primaria',
      titulo: 'Winston Primaria — Dirección',
      subtitulo: 'Maestras de español (1° a 6°)',
      path: resolve(outDir, '03-direccion-primaria-winston.xlsx'),
    },
    {
      key: 'prim_en',
      destinario: 'English Elementary Coordination',
      titulo: 'Winston Primaria — English Elementary',
      subtitulo: 'Teachers (1st–6th)',
      path: resolve(outDir, '04-english-elementary.xlsx'),
    },
  ]

  const results = []
  for (const spec of specs) {
    results.push(await buildWorkbook(spec, buckets[spec.key]))
  }

  console.log(JSON.stringify({ urlHub: URL_HUB, results }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
