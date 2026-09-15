import { readFile } from 'fs/promises'
import path from 'path'
import { jsPDF } from 'jspdf'
import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_PRIMARIA,
  PRIMARIA_ES_BLOQUES,
  PRIMARIA_ES_GRADOS,
  claveMateria,
  grupoNumeroDesdeLetra,
  letraDesdeGrupoNumero,
  maestraEspanolPrimaria,
  materiasPorGrado,
  parseClaveMateria,
  plantillaPdfPorGrado,
  type PrimariaEsBloque,
  type PrimariaEsGrado,
  type PrimariaEsMateria,
} from './boletasPrimariaEsCatalog'
import { etiquetaCicloBoletas } from './boletasCiclo'

const STATUS_ACTIVOS = [1, 4, 5] as const
const TABLE = 'boleta_calificacion_primaria_es'

export type PrimariaEsAlumnoLista = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  alumno_grado: number
  alumno_grupo: number
  grupo_letra: string
}

export type PrimariaEsCapturaMateria = PrimariaEsMateria & {
  calificacion: string
  clave: string
}

export type PrimariaEsCapturaBloque = {
  id: PrimariaEsBloque
  etiqueta: string
  materias: PrimariaEsCapturaMateria[]
}

export type PrimariaEsCaptura = {
  alumno: PrimariaEsAlumnoLista
  bimestre: number
  ciclo: number
  bloques: PrimariaEsCapturaBloque[]
}

function nombreAlumno(a: {
  alumno_app?: unknown
  alumno_apm?: unknown
  alumno_nombre?: unknown
}): string {
  return [a.alumno_app, a.alumno_apm, a.alumno_nombre]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function asGrado(n: number): PrimariaEsGrado {
  if (n >= 1 && n <= 6) return n as PrimariaEsGrado
  throw new Error('Grado inválido (use 1–6)')
}

export async function listarAlumnos(input: {
  grado: number
  grupoLetra: string
  ciclo: number
}): Promise<PrimariaEsAlumnoLista[]> {
  const grado = asGrado(Number(input.grado))
  const grupoNum = grupoNumeroDesdeLetra(input.grupoLetra)
  if (!grupoNum || grupoNum > 3) throw new Error('Grupo inválido (A–C)')
  const ciclo = Number(input.ciclo)
  if (!ciclo) throw new Error('Ciclo requerido')

  const db = createBoletasDb()
  const { data, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_nivel', BOLETAS_NIVEL_PRIMARIA)
    .eq('alumno_grado', grado)
    .eq('alumno_grupo', grupoNum)
    .eq('alumno_ciclo_escolar', ciclo)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .order('alumno_app')

  if (error) throw new Error(error.message)

  return (data ?? []).map((a) => {
    const g = Number(a.alumno_grupo)
    return {
      alumno_id: Number(a.alumno_id),
      alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
      nombre: nombreAlumno(a),
      alumno_grado: Number(a.alumno_grado),
      alumno_grupo: g,
      grupo_letra: letraDesdeGrupoNumero(g),
    }
  })
}

async function cargarAlumnoPrimaria(alumnoId: number): Promise<PrimariaEsAlumnoLista> {
  const db = createBoletasDb()
  const { data, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status'
    )
    .eq('alumno_id', alumnoId)
    .limit(1)

  if (error) throw new Error(error.message)
  const a = data?.[0]
  if (!a) throw new Error('Alumno no encontrado')
  if (Number(a.alumno_nivel) !== BOLETAS_NIVEL_PRIMARIA) {
    throw new Error('El alumno no es de primaria')
  }
  const g = Number(a.alumno_grupo)
  return {
    alumno_id: Number(a.alumno_id),
    alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
    nombre: nombreAlumno(a),
    alumno_grado: Number(a.alumno_grado),
    alumno_grupo: g,
    grupo_letra: letraDesdeGrupoNumero(g),
  }
}

function armarBloques(
  grado: PrimariaEsGrado,
  mapa: Map<string, string>
): PrimariaEsCapturaBloque[] {
  const materias = materiasPorGrado(grado)
  return PRIMARIA_ES_BLOQUES.map((b) => {
    const mats = materias.filter((m) => m.bloque === b.id)
    return {
      id: b.id,
      etiqueta: b.etiqueta,
      materias: mats.map((m) => {
        const clave = claveMateria(m.bloque, m.id)
        return {
          ...m,
          clave,
          calificacion: mapa.get(clave) ?? '',
        }
      }),
    }
  }).filter((b) => b.materias.length > 0)
}

export async function obtenerCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<PrimariaEsCaptura> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  if (bimestre < 1 || bimestre > 3) throw new Error('Bimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')

  const alumno = await cargarAlumnoPrimaria(alumnoId)
  const grado = asGrado(alumno.alumno_grado)

  const db = createBoletasDb()
  const { data: rows, error } = await db
    .from(TABLE)
    .select('bloque, materia_id, calificacion')
    .eq('alumno_id', alumnoId)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)

  if (error) throw new Error(error.message)

  const mapa = new Map(
    (rows ?? []).map((r) => [
      claveMateria(String(r.bloque) as PrimariaEsBloque, Number(r.materia_id)),
      String(r.calificacion ?? ''),
    ])
  )

  return {
    alumno,
    bimestre,
    ciclo,
    bloques: armarBloques(grado, mapa),
  }
}

export async function guardarCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
  valores: Record<string, string>
}): Promise<{ saved: number }> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  if (bimestre < 1 || bimestre > 3) throw new Error('Bimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')

  const alumno = await cargarAlumnoPrimaria(alumnoId)
  const grado = asGrado(alumno.alumno_grado)
  const permitidos = new Set(
    materiasPorGrado(grado).map((m) => claveMateria(m.bloque, m.id))
  )

  const db = createBoletasDb()
  const ahora = new Date().toISOString()
  const filas: {
    alumno_id: number
    bloque: string
    materia_id: number
    bimestre: number
    ciclo: number
    calificacion: string
    updated_at: string
  }[] = []

  for (const [rawKey, rawVal] of Object.entries(input.valores ?? {})) {
    if (!permitidos.has(rawKey)) continue
    const parsed = parseClaveMateria(rawKey)
    if (!parsed) continue
    const calificacion = String(rawVal ?? '').trim().slice(0, 40)
    filas.push({
      alumno_id: alumnoId,
      bloque: parsed.bloque,
      materia_id: parsed.id,
      bimestre,
      ciclo,
      calificacion,
      updated_at: ahora,
    })
  }

  if (!filas.length) return { saved: 0 }

  const { error } = await db.from(TABLE).upsert(filas, {
    onConflict: 'alumno_id,bloque,materia_id,bimestre,ciclo',
  })
  if (error) throw new Error(error.message)

  return { saved: filas.length }
}

async function loadPlantillaBase64(grado: PrimariaEsGrado): Promise<string | null> {
  try {
    const file = plantillaPdfPorGrado(grado)
    const abs = path.join(process.cwd(), 'public', 'boletas', 'primaria-es', file)
    const buf = await readFile(abs)
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function generarPdfPrimariaEs(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<Buffer> {
  const captura = await obtenerCaptura(input)
  const { alumno, bimestre, ciclo, bloques } = captura
  const grado = asGrado(alumno.alumno_grado)
  const gradoEtiqueta =
    PRIMARIA_ES_GRADOS.find((g) => g.valor === grado)?.etiqueta ?? `${grado}°`
  const maestra = maestraEspanolPrimaria(grado, alumno.alumno_grupo)
  const plantilla = await loadPlantillaBase64(grado)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  if (plantilla) {
    // Fondo legacy (boleta1/3/4) + hoja de captura legible debajo
    doc.addImage(plantilla, 'JPEG', 10, 8, 170, 265)
    doc.addPage()
  }

  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('INSTITUTO WINSTON CHURCHILL', pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(11)
  doc.text('Boleta Primaria · Español', pageW / 2, y, { align: 'center' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Alumno: ${alumno.nombre}`, 14, y)
  y += 5
  doc.text(
    `Ref: ${String(alumno.alumno_ref ?? '').padStart(5, '0')}   Grado: ${gradoEtiqueta} ${alumno.grupo_letra}   Trimestre: ${bimestre}   Ciclo: ${etiquetaCicloBoletas(ciclo)}`,
    14,
    y
  )
  y += 5
  if (maestra) {
    doc.text(`Maestra: ${maestra}`, 14, y)
    y += 5
  }
  y += 3

  for (const bloque of bloques) {
    if (y > 250) {
      doc.addPage()
      y = 18
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 70, 130)
    doc.text(bloque.etiqueta.toUpperCase(), 14, y)
    doc.setTextColor(0)
    y += 5
    doc.setDrawColor(180)
    doc.line(14, y, pageW - 14, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const mat of bloque.materias) {
      if (y > 265) {
        doc.addPage()
        y = 18
      }
      const nombre = mat.nombre.slice(0, 70)
      const cal = mat.calificacion.trim() || '—'
      doc.text(nombre, 14, y)
      doc.text(cal.slice(0, 28), 150, y)
      y += 5
    }
    y += 4
  }

  y += 6
  if (y > 270) {
    doc.addPage()
    y = 18
  }
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(
    `Plantilla referencia: ${plantillaPdfPorGrado(grado)} · servicios_admin / primaria-español (InsForge).`,
    14,
    Math.min(y, pageH - 12)
  )
  doc.setTextColor(0)

  return Buffer.from(doc.output('arraybuffer'))
}
