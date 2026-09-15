import { jsPDF } from 'jspdf'
import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_KINDER,
  KINDER_ES_GRADOS,
  grupoNumeroDesdeLetra,
  indicadoresPorGrado,
  letraDesdeGrupoNumero,
  type KinderEsGrado,
  type KinderEsIndicador,
} from './boletasKinderEsCatalog'
import { etiquetaCicloBoletas } from './boletasCiclo'

const STATUS_ACTIVOS = [1, 4, 5] as const

export type KinderEsAlumnoLista = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  alumno_grado: number
  alumno_grupo: number
  grupo_letra: string
}

export type KinderEsCapturaIndicador = KinderEsIndicador & {
  calificacion: string
}

export type KinderEsCaptura = {
  alumno: KinderEsAlumnoLista
  bimestre: number
  ciclo: number
  indicadores: KinderEsCapturaIndicador[]
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

function asGrado(n: number): KinderEsGrado {
  if (n === 1 || n === 2 || n === 3) return n
  throw new Error('Grado inválido (use 1–3 / K1–K3)')
}

export async function listarAlumnos(input: {
  grado: number
  grupoLetra: string
  ciclo: number
}): Promise<KinderEsAlumnoLista[]> {
  const grado = asGrado(Number(input.grado))
  const grupoNum = grupoNumeroDesdeLetra(input.grupoLetra)
  if (!grupoNum) throw new Error('Grupo inválido (A–D)')
  const ciclo = Number(input.ciclo)
  if (!ciclo) throw new Error('Ciclo requerido')

  const db = createBoletasDb()
  const { data, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_nivel', BOLETAS_NIVEL_KINDER)
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

async function cargarAlumnoKinder(alumnoId: number): Promise<KinderEsAlumnoLista> {
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
  if (Number(a.alumno_nivel) !== BOLETAS_NIVEL_KINDER) {
    throw new Error('El alumno no es de kinder')
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

export async function obtenerCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<KinderEsCaptura> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  if (bimestre < 1 || bimestre > 3) throw new Error('Bimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')

  const alumno = await cargarAlumnoKinder(alumnoId)
  const grado = asGrado(alumno.alumno_grado)
  const indicadores = indicadoresPorGrado(grado)
  const ids = indicadores.map((i) => i.id)

  const db = createBoletasDb()
  const { data: rows, error } = ids.length
    ? await db
        .from('boleta_calificacion_kinder_es')
        .select('indicador_id, calificacion')
        .eq('alumno_id', alumnoId)
        .eq('bimestre', bimestre)
        .eq('ciclo', ciclo)
        .in('indicador_id', ids)
    : { data: [] as { indicador_id: number; calificacion: string }[], error: null }

  if (error) throw new Error(error.message)

  const mapa = new Map(
    (rows ?? []).map((r) => [Number(r.indicador_id), String(r.calificacion ?? '')])
  )

  return {
    alumno,
    bimestre,
    ciclo,
    indicadores: indicadores.map((ind) => ({
      ...ind,
      calificacion: mapa.get(ind.id) ?? '',
    })),
  }
}

export async function guardarCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
  valores: Record<number, string>
}): Promise<{ saved: number }> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  if (bimestre < 1 || bimestre > 3) throw new Error('Bimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')

  const alumno = await cargarAlumnoKinder(alumnoId)
  const grado = asGrado(alumno.alumno_grado)
  const permitidos = new Set(indicadoresPorGrado(grado).map((i) => i.id))

  const db = createBoletasDb()
  const ahora = new Date().toISOString()
  const filas: {
    alumno_id: number
    indicador_id: number
    bimestre: number
    ciclo: number
    calificacion: string
    updated_at: string
  }[] = []

  for (const [rawId, rawVal] of Object.entries(input.valores ?? {})) {
    const indicadorId = Number(rawId)
    if (!permitidos.has(indicadorId)) continue
    const calificacion = String(rawVal ?? '').trim().slice(0, 40)
    filas.push({
      alumno_id: alumnoId,
      indicador_id: indicadorId,
      bimestre,
      ciclo,
      calificacion,
      updated_at: ahora,
    })
  }

  if (!filas.length) return { saved: 0 }

  const { error } = await db.from('boleta_calificacion_kinder_es').upsert(filas, {
    onConflict: 'alumno_id,indicador_id,bimestre,ciclo',
  })
  if (error) throw new Error(error.message)

  return { saved: filas.length }
}

export async function generarPdfKinderEs(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<Buffer> {
  const captura = await obtenerCaptura(input)
  const { alumno, bimestre, ciclo, indicadores } = captura
  const gradoEtiqueta =
    KINDER_ES_GRADOS.find((g) => g.valor === alumno.alumno_grado)?.etiqueta ??
    `K${alumno.alumno_grado}`

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('INSTITUTO WINSTON CHURCHILL', pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(11)
  doc.text('Boleta Kinder · Español', pageW / 2, y, { align: 'center' })
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
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Indicador', 14, y)
  doc.text('Calificación', 150, y)
  y += 4
  doc.setDrawColor(180)
  doc.line(14, y, pageW - 14, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  for (const ind of indicadores) {
    if (y > 265) {
      doc.addPage()
      y = 18
    }
    const nombre = ind.nombre.slice(0, 70)
    const cal = ind.calificacion.trim() || '—'
    doc.text(nombre, 14, y)
    doc.text(cal.slice(0, 28), 150, y)
    y += 5
  }

  y += 10
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Documento generado por servicios_admin / boletas kinder-español (InsForge).', 14, y)
  doc.setTextColor(0)

  return Buffer.from(doc.output('arraybuffer'))
}
