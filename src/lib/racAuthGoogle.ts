import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  encodeRacSession,
  opcionesCookieRac,
  type RacRol,
  type RacSesion,
} from '@/lib/racAuth'
import type { RacNivelConfig, RacRolNivel } from '@/lib/rac/racNivelConfig'
import {
  encodeRacNivelSession,
  opcionesCookieRacNivel,
  type RacSesionNivel,
} from '@/lib/rac/racAuthNivel'
import {
  normRacEmail,
  staffAllowEntriesParaPanel,
  type RacStaffPanel,
} from '@/lib/racStaffAllowlist'

export type RacGoogleAccountRef = {
  tipo: 'maestro' | 'usuario'
  id: number
  /** Necesario cuando el mismo usuario tiene varios roles (QA Sistemas). */
  role?: string
  perfil?: number
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

function nombreDePartes(...parts: unknown[]): string {
  return parts
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function sameAccount(a: RacGoogleAccountRef, b: RacGoogleAccountRef): boolean {
  if (a.tipo !== b.tipo || Number(a.id) !== Number(b.id)) return false
  if (a.role != null || b.role != null) return String(a.role) === String(b.role)
  return true
}

async function resolverUsuarioPorEmail(email: string): Promise<{
  usuario_id: number
  usuario_username: string
  nombre: string
} | null> {
  const db = createDbAdmin()
  const { data: admins } = await db
    .from('usuario')
    .select(
      'usuario_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_email, usuario_status'
    )
    .ilike('usuario_email', email)

  const a = (admins ?? []).find((row) => Number(row.usuario_status ?? 1) !== 0)
  if (!a) return null

  const usuario = String(a.usuario_username ?? '').trim()
  const nombre =
    nombreDePartes(a.usuario_nombre, a.usuario_app, a.usuario_apm) || usuario || email
  return { usuario_id: Number(a.usuario_id), usuario_username: usuario, nombre }
}

async function candidatosStaffPorAllowlist(
  panel: RacStaffPanel,
  emailRaw: string
): Promise<RacGoogleCandidate[]> {
  const email = normRacEmail(emailRaw)
  const entries = staffAllowEntriesParaPanel(panel, email)
  if (!entries.length) return []

  const user = await resolverUsuarioPorEmail(email)
  if (!user) return []

  return entries.map((entry) => {
    let role: string = entry.role
    if (panel !== 'secundaria' && role === 'prefectura') role = 'control_escolar'
    return {
      tipo: 'usuario' as const,
      id: user.usuario_id,
      role,
      perfil: entry.perfil,
      nombre: user.nombre,
      usuario: user.usuario_username,
      etiquetaRol: entry.etiqueta,
    }
  })
}

/** Secundaria: maestros nivel 0|4 + staff allowlist oficial. */
export async function candidatosRacSecundariaPorEmail(
  emailRaw: string
): Promise<RacGoogleCandidate[]> {
  const email = normRacEmail(emailRaw)
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
      etiquetaRol: 'Maestro(a)',
    })
  }

  out.push(...(await candidatosStaffPorAllowlist('secundaria', email)))
  return out
}

/** Primaria / Maternal-Kinder: maestros del nivel + staff allowlist del panel. */
export async function candidatosRacNivelPorEmail(
  cfg: RacNivelConfig,
  emailRaw: string
): Promise<RacGoogleCandidate[]> {
  const email = normRacEmail(emailRaw)
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
      etiquetaRol: 'Maestro(a) / Teacher',
    })
  }

  out.push(...(await candidatosStaffPorAllowlist(cfg.slug as RacStaffPanel, email)))
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
    const hit = candidates.find((c) =>
      sameAccount(c, {
        tipo: account.tipo,
        id: account.id,
        role: account.role,
        perfil: account.perfil,
      })
    )
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
