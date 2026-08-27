import { createDbAdmin } from '@/lib/insforgeAdmin'
import { SEXO_ALUMNO_OPCIONES } from '@/lib/alumnoSexo'
import { fechaNacAMostrar, fechaNacIsoDesdeBd } from '@/lib/fechaNacimiento'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { fetchAlumnosActivosNivel } from './fetchDb'
import { etiquetaCicloReporte } from './renderDocument'

export type FilaNacimientoSexo = {
  no: number
  nombre: string
  fechaNac: string
  sexo: string
  sexoCodigo: string
}

export type GrupoGradoNacimientoSexo = {
  grado: number
  gradoLabel: string
  filas: FilaNacimientoSexo[]
}

export type ResumenNacimientoSexo = {
  titulo: string
  ciclo: number
  cicloLabel: string
  nivel: number
  nivelLabel: string
  total: number
  grupos: GrupoGradoNacimientoSexo[]
}

function etiquetaSexo(codigo: string): string {
  const c = String(codigo ?? '').trim().toUpperCase()
  const hit = SEXO_ALUMNO_OPCIONES.find((o) => o.valor === c)
  if (hit) return hit.etiqueta
  if (!c) return '—'
  return c
}

export async function cargarReporteNacimientoSexo(
  nivel: number,
  cicloEscolar: number
): Promise<ResumenNacimientoSexo> {
  const alumnos = await fetchAlumnosActivosNivel(nivel, cicloEscolar)
  const db = createDbAdmin()
  const detallePorAlumno = new Map<number, { fechaNac: string; sexo: string }>()
  const ids = alumnos.map((a) => a.alumno_id)

  for (let i = 0; i < ids.length; i += 120) {
    const chunk = ids.slice(i, i + 120)
    const { data, error } = await db
      .from('alumno_detalles')
      .select('alumno_id, alumno_fecha_nac, alumno_sexo')
      .in('alumno_id', chunk)

    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const iso = fechaNacIsoDesdeBd(r.alumno_fecha_nac as string | null)
      detallePorAlumno.set(Number(r.alumno_id), {
        fechaNac: iso ? fechaNacAMostrar(iso) : '—',
        sexo: String(r.alumno_sexo ?? '').trim().toUpperCase(),
      })
    }
  }

  const porGrado = new Map<number, typeof alumnos>()
  for (const a of alumnos) {
    const g = Number(a.alumno_grado) || 0
    const list = porGrado.get(g) ?? []
    list.push(a)
    porGrado.set(g, list)
  }

  const grados = [...porGrado.keys()].sort((a, b) => a - b)
  const grupos: GrupoGradoNacimientoSexo[] = grados.map((grado) => {
    const list = porGrado.get(grado) ?? []
    const filas: FilaNacimientoSexo[] = list.map((a, i) => {
      const det = detallePorAlumno.get(a.alumno_id)
      const sexoCodigo = det?.sexo ?? ''
      return {
        no: i + 1,
        nombre: a.nombre,
        fechaNac: det?.fechaNac ?? '—',
        sexo: etiquetaSexo(sexoCodigo),
        sexoCodigo,
      }
    })
    return {
      grado,
      gradoLabel: etiquetaGradoEscolar(nivel, grado) || `Grado ${grado}`,
      filas,
    }
  })

  const nivelLabel = etiquetaNivelEscolar(nivel)
  return {
    titulo: 'Fecha de nacimiento y sexo',
    ciclo: cicloEscolar,
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    nivel,
    nivelLabel,
    total: alumnos.length,
    grupos,
  }
}
