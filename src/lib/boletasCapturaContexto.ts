import { BoletasAuthError } from './boletasAuth'
import type { BoletasCapturaConfig, BoletasCapturaSesion } from './boletasCapturaAuth'
import { MODULOS_CAPTURA_NIVEL, requireSesionCaptura, supervisaModulo } from './boletasCapturaAuth'
import { maestroTieneGrupo, type ModuloCaptura } from './boletasCapturaGrupos'
import { obtenerEntrega, type BoletaEntrega } from './boletasEntrega'
import { estaPublicada, trimestreValido } from './boletasPortal'
import { cargarAlumno as cargarAlumnoEn } from './boletasKinderEnService'
import { cargarAlumno as cargarAlumnoEs } from './boletasKinderEsService'
import { esGradoKinderEn, grupoNumeroDesdeLetra } from './boletasKinderEnCatalog'
import {
  cargarAlumnoPrimaria,
  esGradoPrimaria,
  grupoNumeroDesdeLetra as grupoPrimaria,
} from './boletasPrimariaComun'
import { resolverCicloEscolarSistemaValor } from './ciclosEscolaresService'

export type ContextoCaptura = {
  sesion: BoletasCapturaSesion
  modulo: ModuloCaptura
  ciclo: number
  trimestre: number
  grado: number
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

function grupoValido(modulo: ModuloCaptura, grado: number, grupo: string): boolean {
  if (modulo.startsWith('primaria')) return esGradoPrimaria(grado) && Boolean(grupoPrimaria(grupo))
  return esGradoKinderEn(grado) && Boolean(grupoNumeroDesdeLetra(grupo)) && !(modulo === 'kinder-es' && grado === 0)
}

/** Sesión + grupo asignado + estado de entrega/publicación del trimestre (ciclo actual del sistema). */
export async function contextoCaptura(
  cfg: BoletasCapturaConfig,
  req: Request,
  raw: { grado: unknown; grupo: unknown; trimestre: unknown },
  modulo: ModuloCaptura = 'kinder-en'
): Promise<ContextoCaptura> {
  if (!MODULOS_CAPTURA_NIVEL[cfg.slug].includes(modulo)) {
    const err = new BoletasAuthError('Esa boleta no es de este nivel.')
    err.status = 404
    throw err
  }
  const sesion = requireSesionCaptura(cfg, req)
  const grado = Number(raw.grado)
  const grupo = String(raw.grupo ?? '').toUpperCase()
  const trimestre = trimestreValido(raw.trimestre)
  if (modulo === 'kinder-es' && grado === 0) throw new Error('Maternal no tiene boleta de español.')
  if (!grupoValido(modulo, grado, grupo)) throw new Error('Grupo inválido.')
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

export async function assertAlumnoDelGrupo(ctx: ContextoCaptura, alumnoId: number): Promise<void> {
  if (!Number.isInteger(alumnoId) || alumnoId <= 0) throw new Error('Alumno inválido.')
  const a = ctx.modulo.startsWith('primaria')
    ? await cargarAlumnoPrimaria(alumnoId)
    : ctx.modulo === 'kinder-es'
      ? await cargarAlumnoEs(alumnoId)
      : await cargarAlumnoEn(alumnoId)
  if (a.grado_ui !== ctx.grado || a.grupo_letra !== ctx.grupo) {
    throw prohibido('Ese alumno no es de tu grupo.')
  }
}

export function assertEditable(ctx: ContextoCaptura): void {
  if (ctx.publicada) throw prohibido('Este trimestre ya está publicado a papás; ya no se puede editar.')
  if (ctx.entrega.estado === 'enviada') {
    throw prohibido('Ya enviaste este grupo a dirección. Si hay que corregir, tu directora te lo regresa.')
  }
}
