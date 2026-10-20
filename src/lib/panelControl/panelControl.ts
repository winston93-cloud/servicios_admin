import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  estadoPorValor,
  type MedidorProceso,
  type PanelControlRespuesta,
  type SentidoMedidor,
} from '@/lib/panelControl/tipos'

type Metricas = {
  ahora: string
  pagos: {
    hoy: number
    esperado: number
    ultimo: string | null
    banorte: number
    openpay: number
    efectivo: number
    openpay_ok_24h: number
    openpay_fallas_24h: number
  }
  facturacion: { total: number; facturados: number }
  reportes: { validos: number; enviados: number; por_validar: number; hoy: number }
  talleres: {
    fecha: string | null
    clases: number
    con_lista: number
    maestro_falto: number
    alumnos: number
    faltas: number
  } | null
  open_house: { edicion: string | null; registros: number; con_kommo: number; ultimas_24h: number } | null
  base: { conexiones: number; max_conexiones: number; bytes: number }
}

/** Apps de producción en Vercel que se revisan. Fuera: las de prueba y el portal de Desayunos (`services`, apagado a propósito con 503). */
const APPS_PRODUCCION: { nombre: string; url: string }[] = [
  { nombre: 'Servicios Admin', url: 'https://servicios.winston93.edu.mx/login' },
  { nombre: 'Uniformes', url: 'https://uniformes-mu.vercel.app' },
  { nombre: 'Reloj checador', url: 'https://winston-registro.vercel.app' },
  { nombre: 'Becas renovación', url: 'https://becas-renovacion.vercel.app' },
  { nombre: 'Winston USA Program', url: 'https://winston-usa-program.vercel.app' },
  { nombre: 'AgendaW', url: 'https://agendaw.vercel.app' },
  { nombre: 'Open House', url: 'https://open-house-chi.vercel.app' },
  { nombre: 'Cheques', url: 'https://cheques-new.vercel.app' },
  { nombre: 'Caja chica', url: 'https://cchic.vercel.app' },
  { nombre: 'SSIW', url: 'https://ssiw.vercel.app' },
  { nombre: 'Contratos', url: 'https://contratos-chi.vercel.app' },
  { nombre: 'Prórrogas y ajustes', url: 'https://prorrogas-ajustes.vercel.app' },
]

const VERCEL_PROYECTO = 'servicios-admin'
const VERCEL_EQUIPO = 'mario-alejandro-galvan-escobedos-projects'

type PingApp = { nombre: string; ok: boolean; ms: number; status: number }

let cachePings: { en: number; datos: PingApp[] } | null = null

async function pingApps(): Promise<PingApp[]> {
  if (cachePings && Date.now() - cachePings.en < 25_000) return cachePings.datos
  const datos = await Promise.all(
    APPS_PRODUCCION.map(async ({ nombre, url }) => {
      const t = Date.now()
      try {
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        })
        return { nombre, ok: res.status < 500, ms: Date.now() - t, status: res.status }
      } catch {
        return { nombre, ok: false, ms: Date.now() - t, status: 0 }
      }
    })
  )
  cachePings = { en: Date.now(), datos }
  return datos
}

type DeploysVercel = { total: number; listos: number; error: number; ultimo: { en: number; estado: string } | null }

let cacheDeploys: { en: number; datos: DeploysVercel } | null = null

async function deploysVercel(): Promise<DeploysVercel | null> {
  const token = process.env.VERCEL_API_TOKEN?.trim()
  if (!token) return null
  if (cacheDeploys && Date.now() - cacheDeploys.en < 60_000) return cacheDeploys.datos
  const desde = Date.now() - 7 * 24 * 3600 * 1000
  const params = new URLSearchParams({
    app: VERCEL_PROYECTO,
    target: 'production',
    since: String(desde),
    limit: '100',
    slug: process.env.VERCEL_TEAM_SLUG?.trim() || VERCEL_EQUIPO,
  })
  const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Vercel respondió ${res.status}`)
  const json = (await res.json()) as {
    deployments?: { state?: string; readyState?: string; created?: number; createdAt?: number }[]
  }
  const lista = (json.deployments ?? []).map((d) => ({
    estado: String(d.state ?? d.readyState ?? '').toUpperCase(),
    en: Number(d.created ?? d.createdAt ?? 0),
  }))
  const datos: DeploysVercel = {
    total: lista.length,
    listos: lista.filter((d) => d.estado === 'READY').length,
    error: lista.filter((d) => d.estado === 'ERROR').length,
    ultimo: lista.sort((a, b) => b.en - a.en)[0] ?? null,
  }
  cacheDeploys = { en: Date.now(), datos }
  return datos
}

function pct(parte: number, total: number): number {
  return Math.max(0, Math.min(100, Math.round((parte / total) * 100)))
}

function medidor(
  base: Omit<MedidorProceso, 'estado'> & { estado?: MedidorProceso['estado'] }
): MedidorProceso {
  return { ...base, estado: base.estado ?? estadoPorValor(base.valor, base.sentido, base.umbrales) }
}

function hora(isoLocal: string | null): string {
  if (!isoLocal) return '—'
  return isoLocal.slice(11, 16)
}

function fechaCorta(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

function hace(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000)
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}

function sinLectura(id: string, nombre: string, mide: string, sentido: SentidoMedidor, umbrales: [number, number], motivo: string): MedidorProceso {
  return { id, nombre, mide, valor: null, sentido, umbrales, estado: 'alarma', detalle: [], motivo }
}

export async function leerPanelControl(): Promise<PanelControlRespuesta> {
  const t0 = Date.now()
  const [rpc, pings, deploys] = await Promise.allSettled([
    createDbAdmin().rpc('panel_control_metricas'),
    pingApps(),
    deploysVercel(),
  ])
  const latenciaBase = Date.now() - t0

  let m: Metricas | null = null
  let errorBase: string | null = null
  if (rpc.status === 'fulfilled' && !rpc.value.error && rpc.value.data) {
    m = rpc.value.data as Metricas
  } else {
    errorBase =
      rpc.status === 'rejected'
        ? String((rpc.reason as Error)?.message ?? rpc.reason)
        : rpc.value.error?.message ?? 'Sin datos'
  }

  const medidores: MedidorProceso[] = []
  const sinBase = 'Sin respuesta de la base de datos'

  if (m) {
    const p = m.pagos
    const pocoEsperado = p.esperado < 3
    const valor = pocoEsperado ? 100 : pct(p.hoy, p.esperado)
    const fallas = Number(p.openpay_fallas_24h) || 0
    medidores.push(
      medidor({
        id: 'pagos',
        nombre: 'Pagos',
        mide: 'Pagos de hoy contra lo normal a esta hora',
        valor,
        sentido: 'alto-bueno',
        umbrales: [30, 70],
        lectura: `${p.hoy}`,
        detalle: [
          `Hoy ${p.hoy} pagos · lo normal a esta hora: ${p.esperado}${pocoEsperado ? ' (horario tranquilo)' : ''}`,
          `Banorte ${p.banorte} · Openpay ${p.openpay} · Efectivo ${p.efectivo}`,
          `Último pago ${hora(p.ultimo)} · Openpay 24 h: ${p.openpay_ok_24h} ok, ${fallas} fallas`,
        ],
        ...(fallas > 0 ? { estado: 'alarma' as const, motivo: `${fallas} avisos de Openpay fallaron en 24 h` } : {}),
      })
    )

    const f = m.facturacion
    medidores.push(
      medidor({
        id: 'facturacion',
        nombre: 'Facturación CFDI',
        mide: 'Pagos de los últimos 7 días ya facturados',
        valor: f.total ? pct(f.facturados, f.total) : 100,
        sentido: 'alto-bueno',
        umbrales: [80, 90],
        detalle: [`${f.facturados} de ${f.total} pagos facturados`, `${f.total - f.facturados} sin factura`],
      })
    )

    const r = m.reportes
    const porEnviar = r.validos + r.por_validar
    medidores.push(
      medidor({
        id: 'reportes',
        nombre: 'Reportes RAC',
        mide: 'Reportes válidos ya enviados a papás (7 días)',
        valor: porEnviar ? pct(r.enviados, porEnviar) : 100,
        sentido: 'alto-bueno',
        umbrales: [80, 95],
        detalle: [
          `${r.enviados} de ${r.validos} válidos enviados`,
          `${r.por_validar} por validar · ${r.hoy} levantados hoy`,
        ],
      })
    )

    const t = m.talleres
    if (t?.fecha) {
      medidores.push(
        medidor({
          id: 'talleres',
          nombre: 'Talleres',
          mide: 'Asistencia del último día con clases',
          valor: t.alumnos ? pct(t.alumnos - t.faltas, t.alumnos) : null,
          sentido: 'alto-bueno',
          umbrales: [60, 80],
          detalle: [
            `${fechaCorta(t.fecha)}: ${t.clases} clases, lista en ${t.con_lista}`,
            `Asistieron ${t.alumnos - t.faltas} de ${t.alumnos}${t.maestro_falto ? ` · faltó maestro en ${t.maestro_falto}` : ''}`,
          ],
        })
      )
    } else {
      medidores.push(
        medidor({
          id: 'talleres',
          nombre: 'Talleres',
          mide: 'Asistencia del último día con clases',
          valor: null,
          sentido: 'alto-bueno',
          umbrales: [60, 80],
          detalle: ['Sin listas registradas'],
        })
      )
    }

    const o = m.open_house
    medidores.push(
      medidor({
        id: 'open-house',
        nombre: 'Open House',
        mide: 'Registros con su lead en Kommo',
        valor: o?.registros ? pct(o.con_kommo, o.registros) : null,
        sentido: 'alto-bueno',
        umbrales: [90, 98],
        detalle: o?.edicion
          ? [`Edición ${o.edicion}: ${o.registros} registros`, `${o.con_kommo} en Kommo · ${o.ultimas_24h} nuevos en 24 h`]
          : ['Sin edición activa'],
      })
    )

    const b = m.base
    const usoBase = b.max_conexiones ? pct(b.conexiones, b.max_conexiones) : null
    const lenta = latenciaBase > 3000
    medidores.push(
      medidor({
        id: 'insforge',
        nombre: 'InsForge',
        mide: 'Uso de conexiones de la base de datos',
        valor: usoBase,
        sentido: 'bajo-bueno',
        umbrales: [60, 85],
        detalle: [
          `${b.conexiones} de ${b.max_conexiones} conexiones`,
          `Respuesta ${latenciaBase} ms · base ${Math.round(b.bytes / 1024 / 1024)} MB`,
        ],
        ...(lenta && estadoPorValor(usoBase, 'bajo-bueno', [60, 85]) === 'normal'
          ? { estado: 'precaucion' as const, motivo: 'Respuesta lenta de la base' }
          : {}),
      })
    )
  } else {
    const motivo = `${sinBase}: ${errorBase}`
    medidores.push(
      sinLectura('pagos', 'Pagos', 'Pagos de hoy contra lo normal a esta hora', 'alto-bueno', [30, 70], motivo),
      sinLectura('facturacion', 'Facturación CFDI', 'Pagos de los últimos 7 días ya facturados', 'alto-bueno', [80, 90], motivo),
      sinLectura('reportes', 'Reportes RAC', 'Reportes válidos ya enviados a papás (7 días)', 'alto-bueno', [80, 95], motivo),
      sinLectura('talleres', 'Talleres', 'Asistencia del último día con clases', 'alto-bueno', [60, 80], motivo),
      sinLectura('open-house', 'Open House', 'Registros con su lead en Kommo', 'alto-bueno', [90, 98], motivo),
      { ...sinLectura('insforge', 'InsForge', 'Uso de conexiones de la base de datos', 'bajo-bueno', [60, 85], motivo), valor: 100 }
    )
  }

  if (pings.status === 'fulfilled') {
    const arriba = pings.value.filter((a) => a.ok)
    const caidas = pings.value.filter((a) => !a.ok)
    const lenta = [...pings.value].sort((a, b) => b.ms - a.ms)[0]
    medidores.push(
      medidor({
        id: 'vercel',
        nombre: 'Vercel',
        mide: 'Apps de producción respondiendo',
        valor: pct(arriba.length, pings.value.length),
        sentido: 'alto-bueno',
        umbrales: [85, 99],
        detalle: [
          `${arriba.length} de ${pings.value.length} apps responden`,
          caidas.length
            ? `Sin respuesta: ${caidas.map((a) => a.nombre).join(', ')}`
            : lenta
              ? `La más lenta: ${lenta.nombre} (${lenta.ms} ms)`
              : '',
        ].filter(Boolean),
      })
    )
  } else {
    medidores.push(
      sinLectura('vercel', 'Vercel', 'Apps de producción respondiendo', 'alto-bueno', [85, 99], 'No se pudieron revisar las apps')
    )
  }

  const nombreDev = 'Desarrollo'
  const mideDev = 'Deploys de producción sin error (7 días)'
  if (deploys.status === 'fulfilled' && deploys.value) {
    const d = deploys.value
    const terminados = d.listos + d.error
    medidores.push(
      medidor({
        id: 'desarrollo',
        nombre: nombreDev,
        mide: mideDev,
        valor: terminados ? pct(d.listos, terminados) : 100,
        sentido: 'alto-bueno',
        umbrales: [70, 90],
        detalle: [
          `${d.total} deploys · ${d.error} con error`,
          d.ultimo ? `Último ${hace(d.ultimo.en)} · ${d.ultimo.estado === 'READY' ? 'Ready' : d.ultimo.estado.toLowerCase()}` : '',
        ].filter(Boolean),
        ...(d.ultimo?.estado === 'ERROR' ? { estado: 'alarma' as const, motivo: 'El último deploy falló' } : {}),
      })
    )
  } else {
    medidores.push({
      id: 'desarrollo',
      nombre: nombreDev,
      mide: mideDev,
      valor: null,
      sentido: 'alto-bueno',
      umbrales: [70, 90],
      estado: 'sin-dato',
      detalle: [
        deploys.status === 'rejected'
          ? `Vercel no respondió: ${String((deploys.reason as Error)?.message ?? '')}`
          : 'Falta el token de lectura de Vercel',
      ],
    })
  }

  return { leidoEn: new Date().toISOString(), medidores }
}
