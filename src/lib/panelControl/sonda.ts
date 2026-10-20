import { createDbAdmin } from '@/lib/insforgeAdmin'

/** Piezas de infraestructura que anotan sus operaciones para el panel de control. */
export type PiezaSonda =
  | 'banorte'
  | 'openpay-api'
  | 'pac'
  | 'storage-cfdi'
  | 'correo'
  | 'google-calendar'

/** Tareas programadas con latido. */
export type TareaLatido = 'cron-talleres-minimo' | 'cron-recordatorio-liberacion-docs'

/** Anota la operación con tope de 1.5 s; nunca lanza ni detiene la operación medida. */
export async function registrarSonda(pieza: PiezaSonda, ok: boolean, ms: number, detalle?: string): Promise<void> {
  try {
    await Promise.race([
      createDbAdmin()
        .from('panel_sonda_evento')
        .insert([{ pieza, ok, ms: Math.max(0, Math.round(ms)), detalle: detalle?.slice(0, 300) ?? null }]),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
  } catch {
    // La anotación nunca debe afectar el cobro, el timbrado ni el correo.
  }
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
    await registrarSonda(pieza, !esFalloHttp(res.status), Date.now() - t, esFalloHttp(res.status) ? `HTTP ${res.status}` : undefined)
    return res
  } catch (e) {
    await registrarSonda(pieza, false, Date.now() - t, e instanceof Error ? e.message : String(e))
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
    await registrarSonda(pieza, true, Date.now() - t)
    return r
  } catch (e) {
    const fallo = esFallo(e)
    await registrarSonda(pieza, !fallo, Date.now() - t, fallo ? (e instanceof Error ? e.message : String(e)) : undefined)
    throw e
  }
}

export async function registrarLatido(tarea: TareaLatido, ok: boolean, ms: number, detalle?: string) {
  const ahora = new Date().toISOString()
  try {
    await createDbAdmin()
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
  } catch {
    // El latido nunca debe tumbar la tarea.
  }
}
