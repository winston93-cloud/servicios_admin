/**
 * Resuelve quién expidió un citatorio/reporte (perfil_id + usuario_id).
 * Maestro → boleta_maestro; staff → usuario.
 */
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { etiquetaDepartamentoRac } from '@/lib/racCatalogo'

function n(v: unknown, fallback = 0): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

function joinNombre(...parts: unknown[]): string {
  return parts
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function departamentoDePerfil(perfil: number, etiquetaPerfil5?: string): string {
  if (perfil === 5 && etiquetaPerfil5?.trim()) return etiquetaPerfil5.trim()
  return etiquetaDepartamentoRac(perfil)
}

export type RacEmisorRef = {
  perfil_id: number
  usuario_id: number
}

export type RacEmisorInfo = {
  perfilId: number
  usuarioId: number
  departamento: string
  nombre: string
  /** Ej. «Prefectura · Ana Pérez» */
  etiqueta: string
}

function claveEmisor(perfilId: number, usuarioId: number): string {
  return `${perfilId}:${usuarioId}`
}

/**
 * Batch: carga nombres de maestros (perfil 1) y usuarios (resto).
 */
export async function resolverEmisoresRac(
  refs: RacEmisorRef[],
  opts?: { etiquetaPerfil5?: string }
): Promise<Map<string, RacEmisorInfo>> {
  const out = new Map<string, RacEmisorInfo>()
  const unicos = new Map<string, RacEmisorRef>()
  for (const r of refs) {
    const perfilId = n(r.perfil_id)
    const usuarioId = n(r.usuario_id)
    if (!usuarioId) continue
    unicos.set(claveEmisor(perfilId, usuarioId), { perfil_id: perfilId, usuario_id: usuarioId })
  }
  if (!unicos.size) return out

  const maestroIds = [...unicos.values()]
    .filter((r) => r.perfil_id === 1)
    .map((r) => r.usuario_id)
  const staffIds = [...unicos.values()]
    .filter((r) => r.perfil_id !== 1)
    .map((r) => r.usuario_id)

  const db = createDbAdmin()
  const maestros = new Map<number, string>()
  const staff = new Map<number, string>()

  if (maestroIds.length) {
    const { data } = await db
      .from('boleta_maestro')
      .select('maestro_id, maestro_app, maestro_apm, maestro_nombre, maestro_usuario')
      .in('maestro_id', [...new Set(maestroIds)])
    for (const m of data ?? []) {
      const id = n(m.maestro_id)
      const nombre =
        joinNombre(m.maestro_nombre, m.maestro_app, m.maestro_apm) ||
        String(m.maestro_usuario ?? '').trim() ||
        `Maestro #${id}`
      maestros.set(id, nombre)
    }
  }

  if (staffIds.length) {
    const { data } = await db
      .from('usuario')
      .select('usuario_id, usuario_app, usuario_apm, usuario_nombre, usuario_username')
      .in('usuario_id', [...new Set(staffIds)])
    for (const u of data ?? []) {
      const id = n(u.usuario_id)
      const nombre =
        joinNombre(u.usuario_nombre, u.usuario_app, u.usuario_apm) ||
        String(u.usuario_username ?? '').trim() ||
        `Usuario #${id}`
      staff.set(id, nombre)
    }
  }

  for (const r of unicos.values()) {
    const departamento = departamentoDePerfil(r.perfil_id, opts?.etiquetaPerfil5)
    const nombre =
      r.perfil_id === 1
        ? maestros.get(r.usuario_id) ?? `Maestro #${r.usuario_id}`
        : staff.get(r.usuario_id) ?? `Usuario #${r.usuario_id}`
    out.set(claveEmisor(r.perfil_id, r.usuario_id), {
      perfilId: r.perfil_id,
      usuarioId: r.usuario_id,
      departamento,
      nombre,
      etiqueta: `${departamento} · ${nombre}`,
    })
  }

  return out
}

export function emisorDeMapa(
  mapa: Map<string, RacEmisorInfo>,
  perfilId: unknown,
  usuarioId: unknown
): RacEmisorInfo | null {
  return mapa.get(claveEmisor(n(perfilId), n(usuarioId))) ?? null
}
