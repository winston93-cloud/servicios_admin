/**
 * 2026-09-21 - Login Google del portal admin: match por usuario_email en Winston.
 */
import { createDbAdmin } from '@/lib/insforgeAdmin'
import type { AuthSession } from '@/lib/portalAuthService'

export type PortalGoogleCandidate = {
  tipo: 'usuario'
  id: number
  role: string
  perfil: number
  nombre: string
  usuario: string
  etiquetaRol: string
}

function nombreDePartes(
  nombre: string | null | undefined,
  app: string | null | undefined,
  apm: string | null | undefined
): string {
  return `${nombre ?? ''} ${app ?? ''} ${apm ?? ''}`.trim()
}

export type PortalGoogleUsuarioRow = {
  usuario_id: number
  usuario_username: string
  displayName: string
}

/** Usuarios activos con ese correo institucional (puede haber más de uno). */
export async function listarUsuariosPortalPorEmail(
  email: string
): Promise<PortalGoogleUsuarioRow[]> {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('usuario')
    .select(
      'usuario_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_email, usuario_status'
    )
    .ilike('usuario_email', email)

  if (error) {
    console.error('listarUsuariosPortalPorEmail:', error)
    throw new Error('Error de conexión con la base de datos')
  }

  return (data ?? [])
    .filter((row) => Number(row.usuario_status ?? 1) !== 0)
    .map((row) => {
      const usuario_username = String(row.usuario_username ?? '').trim()
      const displayName =
        nombreDePartes(row.usuario_nombre, row.usuario_app, row.usuario_apm) ||
        usuario_username ||
        email
      return {
        usuario_id: Number(row.usuario_id),
        usuario_username,
        displayName,
      }
    })
    .filter((u) => Number.isFinite(u.usuario_id) && u.usuario_id > 0 && u.usuario_username)
}

export function sessionDesdeUsuarioPortal(u: PortalGoogleUsuarioRow): AuthSession {
  return {
    role: 'usuario',
    displayName: u.displayName,
    usuario_id: u.usuario_id,
    usuario_username: u.usuario_username,
  }
}

export function candidatosPortalDesdeUsuarios(
  rows: PortalGoogleUsuarioRow[]
): PortalGoogleCandidate[] {
  return rows.map((u) => ({
    tipo: 'usuario' as const,
    id: u.usuario_id,
    role: 'usuario',
    perfil: 0,
    nombre: u.displayName,
    usuario: u.usuario_username,
    etiquetaRol: 'Personal administrativo',
  }))
}
