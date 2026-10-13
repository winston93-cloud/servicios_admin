import { listarEntregas, entregaVacia, type BoletaEntrega } from './boletasEntrega'
import { listarPublicaciones, type BoletaPublicacion } from './boletasPortal'
import { teachersPorGrupoKinderEn } from './boletasCapturaGrupos'
import { gruposConAlumnos, listarAlumnos, progresoAlumnos } from './boletasKinderEnService'
import { etiquetaGrupoKinderEn, type KinderEnGrado } from './boletasKinderEnCatalog'

export type GrupoTableroKinderEn = {
  grado: KinderEnGrado
  grupo: string
  etiqueta: string
  alumnos: number
  completos: number
  teacher: string | null
  entrega: BoletaEntrega
  /** Maternal no tiene boleta en el portal de papás. */
  publicable: boolean
  publicacion: BoletaPublicacion | null
}

/** Estado de cada grupo de Kinder Inglés en un trimestre: avance, entrega de la teacher y publicación. */
export async function tableroKinderEn(ciclo: number, trimestre: number): Promise<GrupoTableroKinderEn[]> {
  const [grupos, entregas, publicaciones, teachers] = await Promise.all([
    gruposConAlumnos(ciclo),
    listarEntregas({ ciclo, modulo: 'kinder-en', trimestre }),
    listarPublicaciones(ciclo, ['kinder-en']),
    teachersPorGrupoKinderEn(),
  ])
  return Promise.all(
    grupos.map(async (g) => {
      const alumnos = await listarAlumnos({ grado: g.grado, grupoLetra: g.grupo, ciclo })
      const progreso = await progresoAlumnos(
        alumnos.map((a) => a.alumno_id),
        g.grado,
        trimestre,
        ciclo
      )
      const completos = [...progreso.values()].filter((p) => p.total > 0 && p.capturadas >= p.total).length
      const clave = { ciclo, modulo: 'kinder-en' as const, trimestre, grado: g.grado, grupo: g.grupo }
      return {
        grado: g.grado,
        grupo: g.grupo,
        etiqueta: etiquetaGrupoKinderEn(g.grado, g.grupo),
        alumnos: alumnos.length,
        completos,
        teacher: teachers.get(`${g.grado}-${g.grupo}`)?.nombre ?? null,
        entrega: entregas.find((e) => e.grado === g.grado && e.grupo === g.grupo) ?? entregaVacia(clave),
        publicable: g.grado > 0,
        publicacion:
          publicaciones.find(
            (p) => p.trimestre === trimestre && ((p.grado === g.grado && p.grupo === g.grupo) || (p.grado === 0 && p.grupo === ''))
          ) ?? null,
      }
    })
  )
}
