import { RAC_TIPOS } from '@/lib/racCatalogo'
import { fechaMxDeTimestamp } from '@/lib/rac/racFecha'

/** Reporte validado del ciclo, mínimo para armar el kardex. */
export type KardexReporte = {
  alumno_id: number
  reporte_tipo: number
  reporte_no: number
  reporte_ciclo: number
  materia_id: number
  reporte_registro: unknown
}

/** Renglón del kardex: una materia (académico) o un tipo de reporte (conductual). */
export type KardexRenglonDef = {
  clave: string
  etiqueta: string
  tipo: number
  /** Solo académico: materias que comparten escalón (kinder/primaria agrupan Español e Inglés). */
  materiaIds?: number[]
  /** Uniforme, vialidad y retardo arrancan en Reporte I: no tienen aviso. */
  conAviso: boolean
  /** Reportes antes de que el escalón vuelva a empezar (3; retardo de maternal/kinder 5). */
  maxReportes: number
}

export type KardexRenglon = {
  clave: string
  etiqueta: string
  /** Informes del ciclo (solo académico; null = no aplica). */
  informes: number | null
  /** `YYYY-MM-DD`, '' sin fecha, null = el tipo no tiene aviso. */
  aviso: string | null
  /** Fechas de Reporte I, II, III… de la última vuelta. */
  reportes: string[]
  /** 1 = primera vuelta. */
  vuelta: number
  /** Escalón más alto de la última vuelta: -1 nada, 0 aviso, 1–5 reporte. */
  escalon: number
}

export type KardexAlerta = 'sin' | 'baja' | 'media' | 'alta'

export type KardexAlumno = {
  alumno_id: number
  alumno_ref: string
  nombre: string
  grupoEtiqueta: string
  academico: KardexRenglon[]
  conductual: KardexRenglon[]
  totalReportes: number
  totalInformes: number
  alerta: KardexAlerta
  /** Lo que más pesa, ya redactado: «Reporte II · MATEMÁTICAS I». */
  destacados: string[]
}

export type KardexGrupo = {
  ciclo: number
  cicloEtiqueta: string
  nivelEtiqueta: string
  grupoEtiqueta: string
  /** `YYYY-MM-DD` (hora de México). */
  fechaCorte: string
  /** Columnas de reporte en la parte conductual (3, o 5 en maternal/kinder por retardo). */
  columnasConductual: number
  alumnos: KardexAlumno[]
}

export const KARDEX_TIPOS_REPORTE = [
  RAC_TIPOS.academico,
  RAC_TIPOS.conducta,
  RAC_TIPOS.uniforme,
  RAC_TIPOS.vialidad,
  RAC_TIPOS.informeAcademico,
  RAC_TIPOS.retardo,
] as const

export function renglonesConductual(opts?: { maternalKinder?: boolean }): KardexRenglonDef[] {
  return [
    { clave: 't2', etiqueta: 'CONDUCTA', tipo: RAC_TIPOS.conducta, conAviso: true, maxReportes: 3 },
    { clave: 't3', etiqueta: 'UNIFORME', tipo: RAC_TIPOS.uniforme, conAviso: false, maxReportes: 3 },
    { clave: 't4', etiqueta: 'VIALIDAD', tipo: RAC_TIPOS.vialidad, conAviso: false, maxReportes: 3 },
    {
      clave: 't6',
      etiqueta: 'RETARDO',
      tipo: RAC_TIPOS.retardo,
      conAviso: false,
      maxReportes: opts?.maternalKinder ? 5 : 3,
    },
  ]
}

const ORDINALES = ['', '1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va', '9na', '10ma']

/** «2da vuelta»; vacío en la primera (así viene en el formato de prefectura). */
export function etiquetaVuelta(vuelta: number): string {
  if (vuelta <= 1) return ''
  return `${ORDINALES[vuelta] ?? `${vuelta}a`} vuelta`
}

const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V']

export function etiquetaEscalonKardex(escalon: number): string {
  if (escalon < 0) return ''
  if (escalon === 0) return 'Aviso'
  return `Reporte ${ROMANOS[escalon] ?? escalon}`
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`. */
export function fechaKardex(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

function renglonVacio(def: KardexRenglonDef): KardexRenglon {
  return {
    clave: def.clave,
    etiqueta: def.etiqueta,
    informes: def.tipo === RAC_TIPOS.academico ? 0 : null,
    aviso: def.conAviso ? '' : null,
    reportes: Array.from({ length: def.maxReportes }, () => ''),
    vuelta: 1,
    escalon: -1,
  }
}

function armarRenglon(def: KardexRenglonDef, reportes: KardexReporte[]): KardexRenglon {
  const r = renglonVacio(def)
  const ids = def.materiaIds ? new Set(def.materiaIds) : null
  const enMateria = (x: KardexReporte) => !ids || ids.has(x.materia_id)

  if (r.informes !== null) {
    r.informes = reportes.filter((x) => x.reporte_tipo === RAC_TIPOS.informeAcademico && enMateria(x)).length
  }

  const escalon = reportes.filter((x) => x.reporte_tipo === def.tipo && enMateria(x))
  if (!escalon.length) return r
  const ultimaVuelta = escalon.reduce((acc, x) => Math.max(acc, x.reporte_ciclo), 0)
  r.vuelta = ultimaVuelta + 1
  for (const x of escalon) {
    if (x.reporte_ciclo !== ultimaVuelta) continue
    const fecha = fechaMxDeTimestamp(x.reporte_registro)
    const no = x.reporte_no
    if (no <= 0) {
      if (r.aviso !== null && fecha > r.aviso) r.aviso = fecha
    } else if (no <= r.reportes.length && fecha > r.reportes[no - 1]) {
      r.reportes[no - 1] = fecha
    }
    r.escalon = Math.max(r.escalon, no <= 0 ? 0 : no)
  }
  return r
}

function alertaDeRenglon(r: KardexRenglon): KardexAlerta {
  if (r.vuelta >= 2 || r.escalon >= 3) return 'alta'
  if (r.escalon === 2) return 'media'
  if (r.escalon >= 0) return 'baja'
  return 'sin'
}

const PESO_ALERTA: Record<KardexAlerta, number> = { sin: 0, baja: 1, media: 2, alta: 3 }

export function pesoAlerta(a: KardexAlerta): number {
  return PESO_ALERTA[a]
}

export function construirKardexAlumno(opts: {
  alumno: { alumno_id: number; alumno_ref: string; nombre: string; grupoEtiqueta: string }
  academico: KardexRenglonDef[]
  conductual: KardexRenglonDef[]
  reportes: KardexReporte[]
}): KardexAlumno {
  const propios = opts.reportes.filter((x) => x.alumno_id === opts.alumno.alumno_id)
  const academico = opts.academico.map((d) => armarRenglon(d, propios))
  const conductual = opts.conductual.map((d) => armarRenglon(d, propios))

  let alerta: KardexAlerta = 'sin'
  const destacados: { texto: string; peso: number; escalon: number }[] = []
  for (const r of [...academico, ...conductual]) {
    const a = alertaDeRenglon(r)
    if (PESO_ALERTA[a] > PESO_ALERTA[alerta]) alerta = a
    if (PESO_ALERTA[a] >= PESO_ALERTA.media) {
      const vuelta = etiquetaVuelta(r.vuelta)
      destacados.push({
        texto: `${etiquetaEscalonKardex(r.escalon) || 'Sin reportes'} · ${r.etiqueta}${vuelta ? ` (${vuelta})` : ''}`,
        peso: PESO_ALERTA[a],
        escalon: r.escalon,
      })
    }
  }
  destacados.sort((a, b) => b.peso - a.peso || b.escalon - a.escalon)

  return {
    ...opts.alumno,
    academico,
    conductual,
    totalReportes: propios.filter((x) => x.reporte_tipo !== RAC_TIPOS.informeAcademico).length,
    totalInformes: propios.filter((x) => x.reporte_tipo === RAC_TIPOS.informeAcademico).length,
    alerta,
    destacados: destacados.map((d) => d.texto),
  }
}
