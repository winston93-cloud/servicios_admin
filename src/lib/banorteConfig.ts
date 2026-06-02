/** Cuenta Banorte según nivel escolar (misma regla que OpenPay / legacy banorte). */
export type BanorteCuenta = 'winston' | 'educativo'

export const BANORTE_3DS_URL = 'https://via.banorte.com/secure3d/Solucion3DSecure.htm'
export const BANORTE_PAYW2_URL = 'https://via.pagosbanorte.com/payw2'

export interface BanorteAfiliacion3ds {
  cuenta: BanorteCuenta
  idAfiliacion: string
  nombreComercio: string
  ciudadComercio: string
  certificacion3d: string
}

export interface BanorteCredencialesPayw2 {
  cuenta: BanorteCuenta
  merchantId: string
  terminalId: string
  user: string
  password: string
}

function cuentaPorNivel(alumnoNivel: number): BanorteCuenta {
  return alumnoNivel >= 3 ? 'winston' : 'educativo'
}

function leerEnv(cuenta: BanorteCuenta, campo: string): string {
  const prefix = cuenta === 'winston' ? 'BANORTE_WINSTON' : 'BANORTE_EDUCATIVO'
  return String(process.env[`${prefix}_${campo}`] ?? '').trim()
}

export function urlRespuestaBanorteComercio(): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
  const origin = base.startsWith('http') ? base : `https://${base}`
  return `${origin}/portal-pagos/banorte/comercio`
}

export function urlPortalPagosAlumno(): string {
  const base = (
    process.env.NEXT_PUBLIC_PORTAL_PAGOS_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://servicios-admin.vercel.app'
  ).replace(/\/$/, '')
  return `${base}/portal-pagos`
}

export function obtenerAfiliacion3ds(alumnoNivel: number): BanorteAfiliacion3ds {
  const cuenta = cuentaPorNivel(alumnoNivel)
  const idAfiliacion = leerEnv(cuenta, 'MERCHANT_ID')
  const nombreComercio = leerEnv(cuenta, 'NOMBRE_COMERCIO')
  const ciudadComercio = leerEnv(cuenta, 'CIUDAD_COMERCIO') || 'CIUDAD MADERO'

  if (!idAfiliacion || !nombreComercio) {
    throw new Error(
      `Faltan variables Banorte 3DS para ${cuenta} (MERCHANT_ID, NOMBRE_COMERCIO).`
    )
  }

  return {
    cuenta,
    idAfiliacion,
    nombreComercio,
    ciudadComercio,
    certificacion3d: leerEnv(cuenta, 'CERTIFICACION_3D') || '03',
  }
}

export function obtenerCredencialesPayw2(alumnoNivel: number): BanorteCredencialesPayw2 {
  const cuenta = cuentaPorNivel(alumnoNivel)
  const merchantId = leerEnv(cuenta, 'MERCHANT_ID')
  const terminalId = leerEnv(cuenta, 'TERMINAL_ID')
  const user = leerEnv(cuenta, 'USER')
  const password = leerEnv(cuenta, 'PASSWORD')

  if (!merchantId || !terminalId || !user || !password) {
    throw new Error(
      `Faltan credenciales Banorte Payworks para ${cuenta} (MERCHANT_ID, TERMINAL_ID, USER, PASSWORD).`
    )
  }

  return { cuenta, merchantId, terminalId, user, password }
}

export function etiquetaCuentaBanorte(cuenta: BanorteCuenta): string {
  return cuenta === 'winston' ? 'Winston Churchill' : 'Instituto Educativo Winston'
}

/** Años de vencimiento (dos dígitos) para el select del formulario 3DS. */
export function opcionesAnioExpiracion(): string[] {
  const actual = new Date().getFullYear() % 100
  const años: string[] = []
  for (let y = actual; y <= actual + 12; y++) {
    años.push(String(y).padStart(2, '0'))
  }
  return años
}
