import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  encodeRacSession,
  opcionesCookieRac,
  rolDesdePerfil,
  type RacRol,
  type RacSesion,
} from '@/lib/racAuth'
import type { RacNivelConfig, RacRolNivel } from '@/lib/rac/racNivelConfig'
import {
  encodeRacNivelSession,
  opcionesCookieRacNivel,
  rolDesdePerfilNivel,
  type RacSesionNivel,
} from '@/lib/rac/racAuthNivel'

export type RacGoogleAccountRef = {
  tipo: 'maestro' | 'usuario'
  id: number
}

export type RacGoogleCandidate = {
  tipo: 'maestro' | 'usuario'
  id: number
  role: string
  perfil: number
  nombre: string
  usuario: string
  etiquetaRol: string
}

function normEmail(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

function nombreDePartes(...parts: unknown[]): string {
  return parts
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function etiquetaRolSec(role: RacRol): string {
  if (role === 'maestro') return 'Maestro(a)'
  if (role === 'psicologia') return 'Psicología'
  if (role === 'prefectura') return 'Prefectura / Asistente'
  if (role === 'direccion') return 'Dirección'
  return 'Coordinación'
}

function etiquetaRolNivel(role: RacRolNivel, cfg: RacNivelConfig): string {
  if (role === 'maestro') return 'Maestro(a) / Teacher'
  if (role === 'psicologia') return 'Psicología'
  if (role === 'control_escolar') return cfg.etiquetaOperaciones
  if (role === 'direccion') return 'Dirección'
  return 'Coordinación'
}

function sameAccount(a: RacGoogleAccountRef, b: RacGoogleAccountRef): boolean {
  return a.tipo === b.tipo && Number(a.id) === Number(b.id)
}

/** Secundaria: maestros nivel 0|4 + cualquier staff activo con ese email. */
export async function candidatosRacSecundariaPorEmail(
  emailRaw: string
): Promise<RacGoogleCandidate[]> {
  const email = normEmail(emailRaw)
  if (!email) return []
  const db = createDbAdmin()
  const out: RacGoogleCandidate[] = []

  const { data: maestros } = await db
    .from('boleta_maestro')
    .select(
      'maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario, maestro_email, maestro_nivel'
    )
    .ilike('maestro_email', email)

  for (const m of maestros ?? []) {
    const nivel = Number(m.maestro_nivel ?? 0)
    if (nivel !== 0 && nivel !== 4) continue
    const usuario = String(m.maestro_usuario ?? '').trim()
    const nombre =
      nombreDePartes(m.maestro_nombre, m.maestro_app, m.maestro_apm) || usuario || email
    out.push({
      tipo: 'maestro',
      id: Number(m.maestro_id),
      role: 'maestro',
      perfil: 1,
      nombre,
      usuario,
      etiquetaRol: etiquetaRolSec('maestro'),
    })
  }

  const { data: admins } = await db
    .from('usuario')
    .select(
      'usuario_id, perfil_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_email, usuario_status'
    )
    .ilike('usuario_email', email)

  for (const a of admins ?? []) {
    if (Number(a.usuario_status ?? 1) === 0) continue
    const perfil = Number(a.perfil_id ?? 2)
    const role = rolDesdePerfil(perfil)
    const usuario = String(a.usuario_username ?? '').trim()
    const nombre =
      nombreDePartes(a.usuario_nombre, a.usuario_app, a.usuario_apm) || usuario || email
    out.push({
      tipo: 'usuario',
      id: Number(a.usuario_id),
      role,
      perfil,
      nombre,
      usuario,
      etiquetaRol: etiquetaRolSec(role),
    })
  }

  return out
}

/**
 * Primaria / Maternal-Kinder:
 * - maestros del nivel
 * - staff activo con perfil psicología (4), control escolar (5) o dirección (6)
 *   (asistentes de coordinación perfil 2 no entran por Google en estos paneles)
 */
export async function candidatosRacNivelPorEmail(
  cfg: RacNivelConfig,
  emailRaw: string
): Promise<RacGoogleCandidate[]> {
  const email = normEmail(emailRaw)
  if (!email) return []
  const db = createDbAdmin()
  const out: RacGoogleCandidate[] = []

  const { data: maestros } = await db
    .from('boleta_maestro')
    .select(
      'maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario, maestro_email, maestro_nivel'
    )
    .ilike('maestro_email', email)
    .in('maestro_nivel', cfg.nivelesEscolares)

  for (const m of maestros ?? []) {
    const usuario = String(m.maestro_usuario ?? '').trim()
    const nombre =
      nombreDePartes(m.maestro_nombre, m.maestro_app, m.maestro_apm) || usuario || email
    out.push({
      tipo: 'maestro',
      id: Number(m.maestro_id),
      role: 'maestro',
      perfil: 1,
      nombre,
      usuario,
      etiquetaRol: etiquetaRolNivel('maestro', cfg),
    })
  }

  const { data: admins } = await db
    .from('usuario')
    .select(
      'usuario_id, perfil_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_email, usuario_status'
    )
    .ilike('usuario_email', email)

  for (const a of admins ?? []) {
    if (Number(a.usuario_status ?? 1) === 0) continue
    const perfil = Number(a.perfil_id ?? 2)
    // Primaria/M-K: no asistentes (perfil 2) ni perfiles ajenos al panel.
    if (perfil !== 4 && perfil !== 5 && perfil !== 6) continue
    const role = rolDesdePerfilNivel(perfil, cfg)
    const usuario = String(a.usuario_username ?? '').trim()
    const nombre =
      nombreDePartes(a.usuario_nombre, a.usuario_app, a.usuario_apm) || usuario || email
    out.push({
      tipo: 'usuario',
      id: Number(a.usuario_id),
      role,
      perfil,
      nombre,
      usuario,
      etiquetaRol: etiquetaRolNivel(role, cfg),
    })
  }

  return out
}

export function sesionSecundariaDesdeCandidato(c: RacGoogleCandidate): RacSesion {
  return {
    role: c.role as RacRol,
    perfil: c.perfil,
    id: c.id,
    nombre: c.nombre,
    usuario: c.usuario,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  }
}

export function sesionNivelDesdeCandidato(
  cfg: RacNivelConfig,
  c: RacGoogleCandidate
): RacSesionNivel {
  return {
    role: c.role as RacRolNivel,
    perfil: c.perfil,
    id: c.id,
    nombre: c.nombre,
    usuario: c.usuario,
    exp: Date.now() + 12 * 60 * 60 * 1000,
    nivelSlug: cfg.slug,
  }
}

export function resolverCandidatoUnico(
  candidates: RacGoogleCandidate[],
  account?: RacGoogleAccountRef | null
):
  | { ok: true; candidate: RacGoogleCandidate }
  | { ok: false; code: 'none' | 'ambiguous'; candidates: RacGoogleCandidate[] } {
  if (!candidates.length) return { ok: false, code: 'none', candidates: [] }

  if (account) {
    const hit = candidates.find((c) => sameAccount(c, account))
    if (!hit) return { ok: false, code: 'none', candidates: [] }
    return { ok: true, candidate: hit }
  }

  if (candidates.length === 1) return { ok: true, candidate: candidates[0] }
  return { ok: false, code: 'ambiguous', candidates }
}

export function cookieRespuestaSecundaria(session: RacSesion) {
  const token = encodeRacSession(session)
  return opcionesCookieRac(token)
}

export function cookieRespuestaNivel(cfg: RacNivelConfig, session: RacSesionNivel) {
  const token = encodeRacNivelSession(cfg, session)
  return opcionesCookieRacNivel(cfg, token)
}
