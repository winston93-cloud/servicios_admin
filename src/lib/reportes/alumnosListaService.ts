import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { fetchAlumnosActivosNivel } from './fetchDb'
import { etiquetaCicloReporte } from './renderDocument'

export type FilaAlumnosLista = {
  no: number
  grado: string
  grupo: string
  noCtrl: string
  nombre: string
}

export type ResumenAlumnosLista = {
  ciclo: number
  cicloLabel: string
  nivel: number
  nivelLabel: string
  filas: FilaAlumnosLista[]
}

export async function cargarAlumnosLista(
  nivel: number,
  ciclo: number
): Promise<ResumenAlumnosLista> {
  const alumnos = await fetchAlumnosActivosNivel(nivel, ciclo)

  const filas: FilaAlumnosLista[] = alumnos.map((a, i) => ({
    no: i + 1,
    grado: etiquetaGradoEscolar(a.alumno_nivel, a.alumno_grado),
    grupo: etiquetaGrupoEscolar(a.alumno_grupo),
    noCtrl: a.alumno_ref,
    nombre: a.nombre,
  }))

  return {
    ciclo,
    cicloLabel: etiquetaCicloReporte(ciclo),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    filas,
  }
}

export function alumnosListaATabla(resumen: ResumenAlumnosLista) {
  return {
    headers: ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
    ]),
  }
}
