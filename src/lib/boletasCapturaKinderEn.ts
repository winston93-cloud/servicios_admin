import { BoletasAuthError } from './boletasAuth'
import type { BoletasCapturaConfig, BoletasCapturaSesion } from './boletasCapturaAuth'
import { requireSesionCaptura, supervisaModulo } from './boletasCapturaAuth'
import { maestroTieneGrupo, type ModuloCapturaKinder } from './boletasCapturaGrupos'
import { obtenerEntrega, type BoletaEntrega } from './boletasEntrega'
import { estaPublicada, trimestreValido } from './boletasPortal'
import { cargarAlumno as cargarAlumnoEn } from './boletasKinderEnService'
import { cargarAlumno as cargarAlumnoEs } from './boletasKinderEsService'
import { esGradoKinderEn, grupoNumeroDesdeLetra, type KinderEnGrado } from './boletasKinderEnCatalog'
import { resolverCicloEscolarSistemaValor } from './ciclosEscolaresService'

export type ContextoTeacherKinderEn = {
  sesion: BoletasCapturaSesion
  modulo: ModuloCapturaKinder
  ciclo: number
  trimestre: number
  grado: KinderEnGrado
  grupo: string
  entrega: BoletaEntrega
  publicada: boolean
  /** La docente puede capturar: ni enviada a dirección ni publicada a papás. */
  editable: boolean
}

function prohibido(msg: string): BoletasAuthError {
  const err = new BoletasAuthError(msg)
  err.status = 403
  return err
}

/** Sesión + grupo asignado + estado de entrega/publicación del trimestre (ciclo actual del sistema). */
export async function contextoTeacherKinderEn(
  cfg: BoletasCapturaConfig,
  req: Request,
  raw: { grado: unknown; grupo: unknown; trimestre: unknown },
  modulo: ModuloCapturaKinder = 'kinder-en'
): Promise<ContextoTeacherKinderEn> {
  const sesion = requireSesionCaptura(cfg, req)
  const grado = Number(raw.grado)
  const grupo = String(raw.grupo ?? '').toUpperCase()
  const trimestre = trimestreValido(raw.trimestre)
  if (!esGradoKinderEn(grado) || !grupoNumeroDesdeLetra(grupo)) throw new Error('Grupo inválido.')
  if (modulo === 'kinder-es' && grado === 0) throw new Error('Maternal no tiene boleta de español.')
  if (trimestre == null) throw new Error('Trimestre inválido (1 a 3).')
  if (sesion.supervisor && !supervisaModulo(sesion, modulo)) {
    throw prohibido('Tu cuenta no supervisa esa boleta.')
  }
  if (!sesion.supervisor && !(await maestroTieneGrupo(sesion.maestroId, cfg.niveles, modulo, grado, grupo))) {
    throw prohibido('Ese grupo no está asignado a tu usuario. Pide a tu directora que te lo asigne.')
  }
  const ciclo = await resolverCicloEscolarSistemaValor()
  const [entrega, publicada] = await Promise.all([
    obtenerEntrega({ ciclo, modulo, trimestre, grado, grupo }),
    grado > 0 ? estaPublicada(ciclo, modulo, trimestre, { grado, grupo }) : Promise.resolve(false),
  ])
  return {
    sesion,
    modulo,
    ciclo,
    trimestre,
    grado,
    grupo,
    entrega,
    publicada,
    editable: entrega.estado !== 'enviada' && !publicada,
  }
}

export async function assertAlumnoDelGrupo(ctx: ContextoTeacherKinderEn, alumnoId: number): Promise<void> {
  if (!Number.isInteger(alumnoId) || alumnoId <= 0) throw new Error('Alumno inválido.')
  const a = ctx.modulo === 'kinder-es' ? await cargarAlumnoEs(alumnoId) : await cargarAlumnoEn(alumnoId)
  if (a.grado_ui !== ctx.grado || a.grupo_letra !== ctx.grupo) {
    throw prohibido('Ese alumno no es de tu grupo.')
  }
}

export function assertEditable(ctx: ContextoTeacherKinderEn): void {
  if (ctx.publicada) throw prohibido('Este trimestre ya está publicado a papás; ya no se puede editar.')
  if (ctx.entrega.estado === 'enviada') {
    throw prohibido('Ya enviaste este grupo a dirección. Si hay que corregir, tu directora te lo regresa.')
  }
}
