/** Cuenta Banorte según nivel escolar (misma regla que OpenPay / legacy banorte). */
export type BanorteCuenta = 'winston' | 'educativo'

export const BANORTE_3DS_URL = 'https://via.banorte.com/secure3d/Solucion3DSecure.htm'
export const BANORTE_PAYW2_URL = 'https://via.pagosbanorte.com/payw2'

/**
 * Proxy opcional con IP fija (transitorio mientras exista el hosting viejo
 * o un VPS permanente). El sistema nuevo cobra directo desde Vercel por defecto.
 */
export const BANORTE_PAYW2_PROXY_URL_DEFAULT =
  'https://www.winston93.edu.mx/banorte/payw2_proxy.php'

/** Misma clave que el default en payw2_proxy.php */
export const BANORTE_PAYW2_PROXY_KEY_DEFAULT = 'WinstonBanortePayw2Proxy-2026-v1'

/**
 * Credenciales 1:1 con banorte/comercio.php (legacy que sí cobró).
 * Env las puede sobreescribir; el password lleva backslash literal.
 */
const LEGACY_PAYW: Record<
  BanorteCuenta,
  { merchantId: string; terminalId: string; user: string; password: string; nombreComercio: string }
> = {
  winston: {
    merchantId: '9352049',
    terminalId: '93520491',
    user: '12345',
    password: String.raw`w=4O0\Tv`,
    nombreComercio: 'INST WINSTON CHURCHILL',
  },
  educativo: {
    merchantId: '9439810',
    terminalId: '94398101',
    user: '12345',
    password: String.raw`w=4O0\Tv`,
    nombreComercio: 'INST WINSTON',
  },
}

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

/** Desescapa \\ en passwords de .env (p. ej. w=4O0\\Tv → w=4O0\Tv). */
function normalizarPasswordEnv(raw: string): string {
  if (!raw) return raw
  return raw.replace(/\\\\/g, '\\')
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
  // Portal unificado: pagos y colegiaturas viven dentro de inscripciones.
  return `${base}/portal-inscripciones`
}

/**
 * Credenciales Payw / 3DS: por defecto las del legacy (comercio.php) que sí cobran.
 * Solo si BANORTE_CREDS_FROM_ENV=1 se toman MERCHANT/USER/PASSWORD/TERMINAL de env
 * (útil si Banorte rota claves; el \ del password en Vercel suele romperse).
 */
function credencialesCuenta(cuenta: BanorteCuenta): BanorteCredencialesPayw2 {
  const legacy = LEGACY_PAYW[cuenta]
  const fromEnv = String(process.env.BANORTE_CREDS_FROM_ENV ?? '').trim() === '1'
  if (!fromEnv) {
    return {
      cuenta,
      merchantId: legacy.merchantId,
      terminalId: legacy.terminalId,
      user: legacy.user,
      password: legacy.password,
    }
  }
  const merchantId = leerEnv(cuenta, 'MERCHANT_ID') || legacy.merchantId
  const terminalId = leerEnv(cuenta, 'TERMINAL_ID') || legacy.terminalId
  const user = leerEnv(cuenta, 'USER') || legacy.user
  const password = normalizarPasswordEnv(leerEnv(cuenta, 'PASSWORD')) || legacy.password
  return { cuenta, merchantId, terminalId, user, password }
}

export function obtenerAfiliacion3ds(alumnoNivel: number): BanorteAfiliacion3ds {
  const cuenta = cuentaPorNivel(alumnoNivel)
  const cred = credencialesCuenta(cuenta)
  const nombreComercio = leerEnv(cuenta, 'NOMBRE_COMERCIO') || LEGACY_PAYW[cuenta].nombreComercio
  const ciudadComercio = leerEnv(cuenta, 'CIUDAD_COMERCIO') || 'CIUDAD MADERO'

  return {
    cuenta,
    idAfiliacion: cred.merchantId,
    nombreComercio,
    ciudadComercio,
    certificacion3d: leerEnv(cuenta, 'CERTIFICACION_3D') || '03',
  }
}

export function obtenerCredencialesPayw2(alumnoNivel: number): BanorteCredencialesPayw2 {
  return credencialesCuenta(cuentaPorNivel(alumnoNivel))
}

export function etiquetaCuentaBanorte(cuenta: BanorteCuenta): string {
  return cuenta === 'winston' ? 'Winston Churchill' : 'Instituto Educativo Winston'
}

/**
 * Cobro directo Vercel→Payworks por defecto (hosting Winston se da de baja).
 * Solo si BANORTE_PAYW2_USE_PROXY=1 se usa un proxy con IP fija (viejo hosting o VPS).
 */
export function usarProxyPayw2(): boolean {
  if (String(process.env.BANORTE_PAYW2_DIRECT ?? '').trim() === '1') return false
  const flag = String(process.env.BANORTE_PAYW2_USE_PROXY ?? '0').trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'on'
}

export function urlProxyPayw2(): string {
  return (
    String(process.env.BANORTE_PAYW2_PROXY_URL ?? '').trim() || BANORTE_PAYW2_PROXY_URL_DEFAULT
  )
}

export function claveProxyPayw2(): string {
  return (
    String(process.env.BANORTE_PAYW2_PROXY_KEY ?? '').trim() || BANORTE_PAYW2_PROXY_KEY_DEFAULT
  )
}

/**
 * Diagnóstico A/B: el form 2 posta al process_payment.php del hosting
 * (mismo curl legacy). Activar solo para prueba: BANORTE_FORM2_LEGACY_PROCESS=1
 */
export const BANORTE_LEGACY_PROCESS_URL_DEFAULT =
  'https://www.winston93.edu.mx/banorte/process_payment.php'

export function usarForm2LegacyProcess(): boolean {
  const flag = String(process.env.BANORTE_FORM2_LEGACY_PROCESS ?? '0').trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'on'
}

export function urlForm2Procesar(requestUrl: string, nivel: number): {
  actionUrl: string
  hiddens: Record<string, string>
  modo: 'vercel' | 'legacy_process'
} {
  if (!usarForm2LegacyProcess()) {
    return {
      actionUrl: new URL('/portal-pagos/banorte/procesar', requestUrl).toString(),
      hiddens: {},
      modo: 'vercel',
    }
  }

  const cred = obtenerCredencialesPayw2(nivel)
  return {
    actionUrl:
      String(process.env.BANORTE_LEGACY_PROCESS_URL ?? '').trim() ||
      BANORTE_LEGACY_PROCESS_URL_DEFAULT,
    hiddens: {
      MERCHANT_ID: cred.merchantId,
      USER: cred.user,
      PASSWORD: cred.password,
      TERMINAL_ID: cred.terminalId,
      CMD_TRANS: 'VENTA',
      MODE: 'PRD',
      ENTRY_MODE: 'MANUAL',
      RESPONSE_LANGUAGE: 'EN',
    },
    modo: 'legacy_process',
  }
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
