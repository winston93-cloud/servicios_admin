import type {
  PosBusqueda,
  PosExterno,
  PosExternoInput,
  PosPago,
  PosProducto,
  PosProductoInput,
  PosReporteContable,
  PosVentaRequest,
  PosVentaResultado,
} from './posTipos'

export class PosSesionExpirada extends Error {}

export const EVENTO_SESION_POS_EXPIRADA = 'pos:sesion-expirada'

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/pos/${ruta}`, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_SESION_POS_EXPIRADA))
    throw new PosSesionExpirada(data.error || 'Sesión de caja expirada.')
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const posApi = {
  buscar: (q: string, signal?: AbortSignal) => pedir<PosBusqueda>(`buscar?q=${encodeURIComponent(q)}`, { signal }),
  productos: (todos = false) =>
    pedir<{ productos: PosProducto[] }>(`productos${todos ? '?todos=1' : ''}`).then((r) => r.productos),
  guardarProducto: (p: PosProductoInput) =>
    pedir<{ producto: PosProducto }>('productos', post(p)).then((r) => r.producto),
  externos: () => pedir<{ externos: PosExterno[] }>('externos').then((r) => r.externos),
  guardarExterno: (e: PosExternoInput) =>
    pedir<{ externo: PosExterno }>('externos', post(e)).then((r) => r.externo),
  eliminarExterno: (id: number) => pedir<{ ok: true }>(`externos?id=${id}`, { method: 'DELETE' }),
  dia: (fecha: string) => pedir<{ pagos: PosPago[] }>(`dia?fecha=${fecha}`).then((r) => r.pagos),
  historial: (ref: string, signal?: AbortSignal) =>
    pedir<{ pagos: PosPago[] }>(`historial?ref=${encodeURIComponent(ref)}`, { signal }).then((r) => r.pagos),
  venta: (v: PosVentaRequest) => pedir<PosVentaResultado>('venta', post(v)),
  entrega: (ids: number[], entregado: boolean) => pedir<{ ok: true }>('entrega', post({ ids, entregado })),
  cancelar: (ids: number[]) => pedir<{ canceladas: number }>('cancelar', post({ ids })).then((r) => r.canceladas),
  contable: (inicio: string, fin: string) =>
    pedir<PosReporteContable>(`contable?inicio=${inicio}&fin=${fin}`),
}
