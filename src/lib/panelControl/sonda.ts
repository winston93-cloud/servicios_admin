import { createDbAdmin } from '@/lib/insforgeAdmin'

/** Piezas de infraestructura que anotan sus operaciones para el panel de control. */
export type PiezaSonda =
  | 'banorte'
  | 'openpay-api'
  | 'pac'
  | 'storage-cfdi'
  | 'correo'
  | 'google-calendar'
  | 'google-classroom'

/** Tareas programadas con latido. */
export type TareaLatido = 'cron-talleres-minimo' | 'cron-recordatorio-liberacion-docs'

const TOPE_ANOTACION_MS = 1500
const PAUSA_TRAS_FALLO_MS = 5 * 60 * 1000
let pausadoHasta = 0

function apagado(): boolean {
  return process.env.PANEL_CONTROL_SONDAS === 'off' || Date.now() < pausadoHasta
}

/**
 * Corre la anotación fuera del camino de la operación: nadie la espera. En Vercel se cuelga de
 * `waitUntil` del request para que termine después de responder; si falla o tarda, se pausa 5 min.
 */
function enSegundoPlano(tarea: () => PromiseLike<unknown>): void {
  if (apagado()) return
  const p = Promise.race([
    Promise.resolve().then(tarea),
    new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('tope')), TOPE_ANOTACION_MS)),
  ]).then(
    (r) => {
      if (r && typeof r === 'object' && 'error' in r && r.error) pausadoHasta = Date.now() + PAUSA_TRAS_FALLO_MS
    },
    () => {
      pausadoHasta = Date.now() + PAUSA_TRAS_FALLO_MS
    }
  )
  try {
    const ctx = (globalThis as { [k: symbol]: { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined })[
      Symbol.for('@vercel/request-context')
    ]
    ctx?.get?.()?.waitUntil?.(p)
  } catch {}
}

/** Anota la operación en segundo plano; nunca lanza, no espera y no detiene la operación medida. */
export function registrarSonda(pieza: PiezaSonda, ok: boolean, ms: number, detalle?: string): void {
  enSegundoPlano(() =>
    createDbAdmin()
      .from('panel_sonda_evento')
      .insert([{ pieza, ok, ms: Math.max(0, Math.round(ms)), detalle: detalle?.slice(0, 300) ?? null }])
  )
}

/**
 * Fallo de infraestructura: sin respuesta, 5xx o credenciales rechazadas. Un 4xx por datos es del tercero.
 */
export function esFalloHttp(status: number): boolean {
  return status >= 500 || status === 401 || status === 403 || status === 0
}

/** `fetch` que anota la operación en la pieza. Respeta el resultado y los errores originales. */
export async function fetchConSonda(pieza: PiezaSonda, input: string, init?: RequestInit): Promise<Response> {
  const t = Date.now()
  try {
    const res = await fetch(input, init)
    registrarSonda(pieza, !esFalloHttp(res.status), Date.now() - t, esFalloHttp(res.status) ? `HTTP ${res.status}` : undefined)
    return res
  } catch (e) {
    registrarSonda(pieza, false, Date.now() - t, e instanceof Error ? e.message : String(e))
    throw e
  }
}

/** Mide una operación que no es `fetch` (SMTP, SDK de Google). `esFallo` decide si un error es del sistema. */
export async function medirConSonda<T>(
  pieza: PiezaSonda,
  operacion: () => Promise<T>,
  esFallo: (e: unknown) => boolean = () => true
): Promise<T> {
  const t = Date.now()
  try {
    const r = await operacion()
    registrarSonda(pieza, true, Date.now() - t)
    return r
  } catch (e) {
    let fallo = true
    try {
      fallo = esFallo(e)
    } catch {}
    registrarSonda(pieza, !fallo, Date.now() - t, fallo ? (e instanceof Error ? e.message : String(e)) : undefined)
    throw e
  }
}

/** Latido de una tarea programada, en segundo plano. */
export function registrarLatido(tarea: TareaLatido, ok: boolean, ms: number, detalle?: string): void {
  const ahora = new Date().toISOString()
  enSegundoPlano(() =>
    createDbAdmin()
      .from('panel_latido')
      .upsert(
        [
          {
            tarea,
            ultimo_intento: ahora,
            ok,
            ms: Math.round(ms),
            detalle: detalle?.slice(0, 300) ?? null,
            ...(ok ? { ultimo_ok: ahora } : {}),
          },
        ],
        { onConflict: 'tarea' }
      )
  )
}
