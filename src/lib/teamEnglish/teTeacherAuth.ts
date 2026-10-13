import { BOLETAS_AUTH_COOKIE, cookieBoletasDesdeHeader, decodeBoletasSession, encodeBoletasSession, type BoletasSession } from '@/lib/boletasAuth'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { TeError, equipo, nivelesPermitidos } from './teService'
import type { TeNivel, TeTeacher } from './teTypes'

/**
 * Cookie propia de la simulación: no es la de boletas, así que quien simula a una teacher
 * no queda con acceso a la captura de calificaciones.
 */
export const TE_SIM_COOKIE = 'te_teacher_sim'
const SIM_HORAS = 4

export type SesionTeacher = { id: number; nombre: string; simuladoPor: string | null }

type SesionSim = BoletasSession & { simulado_por?: string }

function leerCookie(cookieHeader: string | null, nombre: string): string | null {
  const m = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]*)`))
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

export function sesionTeacherDeRequest(request: Request): SesionTeacher | null {
  const cookieHeader = request.headers.get('cookie')
  const sim = decodeBoletasSession(leerCookie(cookieHeader, TE_SIM_COOKIE)) as SesionSim | null
  if (sim?.role === 'maestro' && sim.simulado_por) return { id: sim.id, nombre: sim.nombre, simuladoPor: sim.simulado_por }
  const s = cookieBoletasDesdeHeader(cookieHeader)
  if (s?.role === 'maestro') return { id: s.id, nombre: s.nombre, simuladoPor: null }
  return null
}

export function requireSesionTeacher(request: Request): SesionTeacher {
  const s = sesionTeacherDeRequest(request)
  if (!s) throw new TeError('Inicia sesión con tu usuario de teacher.', 401)
  return s
}

/** Quién sube: la teacher, o «Mario (vista previa)» cuando se simula. */
export function quienSube(s: SesionTeacher): string {
  return s.simuladoPor ? `${s.simuladoPor} (vista previa)` : s.nombre
}

export function cookieSimulacion(t: TeTeacher, simuladoPor: string) {
  const sesion: Omit<SesionSim, 'exp'> & { exp: number } = {
    role: 'maestro',
    id: t.maestro_id,
    nombre: t.nombre,
    usuario: t.usuario ?? String(t.maestro_id),
    simulado_por: simuladoPor,
    exp: Date.now() + SIM_HORAS * 60 * 60 * 1000,
  }
  return {
    name: TE_SIM_COOKIE,
    value: encodeBoletasSession(sesion),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SIM_HORAS * 60 * 60,
  }
}

/** Al salir de una simulación no se toca la sesión de boletas que la directora pueda tener abierta. */
export function cookiesSalida(actual: SesionTeacher | null) {
  const nombres = actual?.simuladoPor ? [TE_SIM_COOKIE] : [BOLETAS_AUTH_COOKIE, TE_SIM_COOKIE]
  return nombres.map((name) => ({ name, value: '', path: '/', maxAge: 0 }))
}

/** Personal con acceso a Team English (coording, laura, mario) que puede simular a una teacher. */
export async function simuladorPorEmail(email: string): Promise<{ nombre: string; niveles: TeNivel[] } | null> {
  const { data, error } = await createDbAdmin()
    .from('usuario')
    .select('usuario_id, usuario_nombre, usuario_username, usuario_status')
    .ilike('usuario_email', email.trim())
  if (error) throw new Error(`Usuario: ${error.message}`)
  for (const u of (data ?? []) as Record<string, unknown>[]) {
    if (Number(u.usuario_status ?? 1) === 0) continue
    const niveles = nivelesPermitidos(Number(u.usuario_id))
    if (niveles.length) return { nombre: String(u.usuario_nombre || u.usuario_username || 'Dirección').trim(), niveles }
  }
  return null
}

/** Teacher activa del equipo cuyo correo de boletas coincide con el de Google. */
export async function teacherPorEmail(email: string): Promise<TeTeacher | null> {
  const e = email.trim().toLowerCase()
  for (const nivel of [3] as TeNivel[]) {
    const t = (await equipo(nivel, false)).find((x) => (x.email ?? '').trim().toLowerCase() === e)
    if (t) return t
  }
  return null
}
