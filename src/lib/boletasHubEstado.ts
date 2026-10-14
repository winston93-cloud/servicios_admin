import { createBoletasDb } from './boletasInsforge'
import { cicloEscolarActualBoletas } from './boletasCiclo'
import { obtenerCapturaPeriodo } from './boletasCapturaPeriodo'
import { listarPublicaciones, publicacionAplica, type BoletaModulo, type BoletaPublicacion } from './boletasPortal'
import { gruposConAlumnosKinderEs } from './boletasKinderEsService'
import { gruposConAlumnos as gruposConAlumnosKinderEn } from './boletasKinderEnService'
import { gruposConAlumnosPrimaria } from './boletasPrimariaComun'
import { gruposConAlumnosSec, materiasActivasSec, MODULO_SECUNDARIA } from './boletasSecundariaService'

export type HubEstadoModulo = 'sin-entregas' | 'en-captura' | 'devuelta' | 'enviada' | 'publicada'

export type HubModulo = {
  modulo: BoletaModulo
  trimestre: number
  /** Solo secundaria: trimestre abierto a captura (0 = cerrada). */
  capturaAbierta: number | null
  enviadas: number
  devueltas: number
  /** Kinder/primaria: grupos. Secundaria: materia × grupo. */
  total: number
  publicados: number
  publicables: number
  estado: HubEstadoModulo
}

export type HubNivel = 'preescolar' | 'primaria' | 'secundaria'

export type HubEstado = {
  ciclo: number
  niveles: Record<HubNivel, { trimestre: number; modulos: HubModulo[] }>
}

type Grupo = { grado: number; grupo: string }
type Entrega = { modulo: string; trimestre: number; grado: number; grupo: string; materiaId: number; estado: string }

const MODULOS_NIVEL: Record<HubNivel, BoletaModulo[]> = {
  preescolar: ['kinder-es', 'kinder-en'],
  primaria: ['primaria-es', 'primaria-en'],
  secundaria: [MODULO_SECUNDARIA],
}

async function entregasDelCiclo(ciclo: number): Promise<Entrega[]> {
  const { data, error } = await createBoletasDb()
    .from('boleta_entrega')
    .select('modulo, trimestre, grado, grupo, materia_id, estado')
    .eq('ciclo', ciclo)
    .limit(5000)
  if (error) throw new Error(`Entregas de boletas: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    modulo: String(r.modulo),
    trimestre: Number(r.trimestre),
    grado: Number(r.grado),
    grupo: String(r.grupo ?? ''),
    materiaId: Number(r.materia_id ?? 0),
    estado: String(r.estado ?? ''),
  }))
}

/** Último trimestre con movimiento (entregas o publicación); 1 si el ciclo aún no empieza. */
function trimestreConMovimiento(modulos: BoletaModulo[], entregas: Entrega[], pubs: BoletaPublicacion[]): number {
  let t = 1
  for (const e of entregas) if (modulos.includes(e.modulo as BoletaModulo)) t = Math.max(t, e.trimestre)
  for (const p of pubs) if (modulos.includes(p.modulo)) t = Math.max(t, p.trimestre)
  return Math.min(t, 3)
}

function resumir(input: {
  modulo: BoletaModulo
  trimestre: number
  capturaAbierta: number | null
  unidades: string[]
  publicables: Grupo[]
  entregas: Entrega[]
  pubs: BoletaPublicacion[]
}): HubModulo {
  const { modulo, trimestre } = input
  const validas = new Set(input.unidades)
  let enviadas = 0
  let devueltas = 0
  for (const e of input.entregas) {
    if (e.modulo !== modulo || e.trimestre !== trimestre) continue
    if (!validas.has(`${e.materiaId}-${e.grado}-${e.grupo}`)) continue
    if (e.estado === 'enviada') enviadas++
    else if (e.estado === 'devuelta') devueltas++
  }
  const pubs = input.pubs.filter((p) => p.modulo === modulo && p.trimestre === trimestre)
  const publicados = input.publicables.filter((g) => pubs.some((p) => publicacionAplica(p, g))).length
  const total = validas.size
  const publicables = input.publicables.length
  let estado: HubEstadoModulo = 'sin-entregas'
  if (publicables > 0 && publicados === publicables) estado = 'publicada'
  else if (devueltas > 0) estado = 'devuelta'
  else if (total > 0 && enviadas === total) estado = 'enviada'
  else if (enviadas > 0) estado = 'en-captura'
  return { modulo, trimestre, capturaAbierta: input.capturaAbierta, enviadas, devueltas, total, publicados, publicables, estado }
}

const porGrupo = (gs: Grupo[]) => gs.map((g) => `0-${g.grado}-${g.grupo}`)

/** Avance del trimestre en curso por nivel: entregas a dirección y publicación a papás (ciclo actual). */
export async function estadoHubBoletas(ciclo = cicloEscolarActualBoletas()): Promise<HubEstado> {
  const [entregas, pubs, kEs, kEn, prim, sec, materias, periodoSec] = await Promise.all([
    entregasDelCiclo(ciclo),
    listarPublicaciones(ciclo),
    gruposConAlumnosKinderEs(ciclo),
    gruposConAlumnosKinderEn(ciclo),
    gruposConAlumnosPrimaria(ciclo),
    gruposConAlumnosSec(ciclo),
    materiasActivasSec(),
    obtenerCapturaPeriodo(ciclo, MODULO_SECUNDARIA),
  ])

  const tPre = trimestreConMovimiento(MODULOS_NIVEL.preescolar, entregas, pubs)
  const tPri = trimestreConMovimiento(MODULOS_NIVEL.primaria, entregas, pubs)
  const abierto = periodoSec.trimestre
  const tSec = abierto || trimestreConMovimiento(MODULOS_NIVEL.secundaria, entregas, pubs)
  const base = { entregas, pubs, capturaAbierta: null }

  const unidadesSec = sec.flatMap((g) =>
    materias.filter((m) => m.grado === g.grado).map((m) => `${m.id}-${g.grado}-${g.grupo}`)
  )

  return {
    ciclo,
    niveles: {
      preescolar: {
        trimestre: tPre,
        modulos: [
          resumir({ ...base, modulo: 'kinder-es', trimestre: tPre, unidades: porGrupo(kEs), publicables: kEs }),
          resumir({
            ...base,
            modulo: 'kinder-en',
            trimestre: tPre,
            unidades: porGrupo(kEn),
            publicables: kEn.filter((g) => g.grado > 0),
          }),
        ],
      },
      primaria: {
        trimestre: tPri,
        modulos: (['primaria-es', 'primaria-en'] as const).map((modulo) =>
          resumir({ ...base, modulo, trimestre: tPri, unidades: porGrupo(prim), publicables: prim })
        ),
      },
      secundaria: {
        trimestre: tSec,
        modulos: [
          resumir({
            ...base,
            modulo: MODULO_SECUNDARIA,
            trimestre: tSec,
            capturaAbierta: abierto,
            unidades: unidadesSec,
            publicables: sec,
          }),
        ],
      },
    },
  }
}
