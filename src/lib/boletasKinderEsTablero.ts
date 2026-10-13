import { listarEntregas, entregaVacia, type BoletaEntrega } from './boletasEntrega'
import { listarPublicaciones, type BoletaPublicacion } from './boletasPortal'
import { docentesPorGrupoKinder } from './boletasKinderDocentesGrupo'
import { gruposConAlumnosKinderEs, listarAlumnos, progresoAlumnos } from './boletasKinderEsService'
import { etiquetaGrupoKinderEs, type KinderEsGrado } from './boletasKinderEsCatalog'

export type GrupoTableroKinderEs = {
  grado: KinderEsGrado
  grupo: string
  etiqueta: string
  alumnos: number
  completos: number
  teacher: string | null
  entrega: BoletaEntrega
  publicable: boolean
  publicacion: BoletaPublicacion | null
}

/** Estado de cada grupo de Kinder Español en un trimestre: avance, entrega de la maestra y publicación. */
export async function tableroKinderEs(ciclo: number, trimestre: number): Promise<GrupoTableroKinderEs[]> {
  const [grupos, entregas, publicaciones, maestras] = await Promise.all([
    gruposConAlumnosKinderEs(ciclo),
    listarEntregas({ ciclo, modulo: 'kinder-es', trimestre }),
    listarPublicaciones(ciclo, ['kinder-es']),
    docentesPorGrupoKinder('es'),
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
      const clave = { ciclo, modulo: 'kinder-es' as const, trimestre, grado: g.grado, grupo: g.grupo }
      return {
        grado: g.grado,
        grupo: g.grupo,
        etiqueta: etiquetaGrupoKinderEs(g.grado, g.grupo),
        alumnos: alumnos.length,
        completos,
        teacher: maestras.get(`${g.grado}-${g.grupo}`)?.nombre ?? null,
        entrega: entregas.find((e) => e.grado === g.grado && e.grupo === g.grupo) ?? entregaVacia(clave),
        publicable: true,
        publicacion:
          publicaciones.find(
            (p) => p.trimestre === trimestre && ((p.grado === g.grado && p.grupo === g.grupo) || (p.grado === 0 && p.grupo === ''))
          ) ?? null,
      }
    })
  )
}
