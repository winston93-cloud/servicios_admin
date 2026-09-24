import { createDbAdmin } from '@/lib/insforgeAdmin'
import { modulosVisiblesDeUsuario, normalizarModulosDashboard } from '@/lib/dashboardAccesosEmpleados'

export type UsuarioRegistro = {
  usuario_id: number
  perfil_id: number | null
  usuario_app: string | null
  usuario_apm: string | null
  usuario_nombre: string | null
  usuario_username: string
  usuario_email: string | null
  usuario_password: string
  usuario_status: number | null
  usuario_alta: string | null
  nivel: number | null
  /** null = cuenta legada (accesos definidos en código). */
  dashboard_modulos: string[] | null
}

export type UsuarioInput = {
  perfil_id: number | null
  usuario_app: string
  usuario_apm: string
  usuario_nombre: string
  usuario_username: string
  usuario_email: string
  usuario_password: string
  usuario_status: number
  nivel: number
  dashboard_modulos: string[]
}

/** Datos de autorización que acompañan un cambio de accesos al dashboard. */
export type AccesoAutorizacion = {
  autorizado_por: string
  operado_por_id: number | null
  operado_por: string
}

export type UsuarioGuardarPayload = Partial<UsuarioInput> & Partial<AccesoAutorizacion>

export type AccesoBitacoraRegistro = {
  id: number
  usuario_id: number
  modulo_id: string
  accion: 'otorgado' | 'retirado'
  autorizado_por: string
  operado_por_id: number | null
  operado_por: string | null
  created_at: string
}

const SELECT_USUARIO =
  'usuario_id, perfil_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_email, usuario_password, usuario_status, usuario_alta, nivel, dashboard_modulos'

function ahoraMysql(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function normalizarInput(raw: Partial<UsuarioInput>): UsuarioInput {
  const username = String(raw.usuario_username ?? '').trim()
  const password = String(raw.usuario_password ?? '').trim()
  if (!username) throw new Error('El usuario (username) es obligatorio')
  if (!password) throw new Error('La clave es obligatoria')
  if (username.length > 20) throw new Error('El username no puede pasar de 20 caracteres')
  const modulos = normalizarModulosDashboard(raw.dashboard_modulos)
  if (!modulos.length) {
    throw new Error('Selecciona al menos un sistema del dashboard al que tendrá acceso')
  }

  const perfilRaw = raw.perfil_id
  let perfil: number | null = null
  if (perfilRaw != null && String(perfilRaw).trim() !== '') {
    const n = Number(perfilRaw)
    if (Number.isFinite(n)) perfil = n
  }

  return {
    perfil_id: perfil,
    usuario_app: String(raw.usuario_app ?? '').trim().slice(0, 50),
    usuario_apm: String(raw.usuario_apm ?? '').trim().slice(0, 50),
    usuario_nombre: String(raw.usuario_nombre ?? '').trim().slice(0, 50),
    usuario_username: username.slice(0, 20),
    usuario_email: String(raw.usuario_email ?? '').trim().slice(0, 100),
    usuario_password: password.slice(0, 255),
    usuario_status: Number(raw.usuario_status) === 0 ? 0 : 1,
    nivel: Number.isFinite(Number(raw.nivel)) ? Number(raw.nivel) : 0,
    dashboard_modulos: modulos,
  }
}

/** Accesos guardados en BD para el dashboard (null = usar mapa legado). */
export async function obtenerModulosDashboardUsuario(usuarioId: number): Promise<string[] | null> {
  if (!Number.isFinite(usuarioId) || usuarioId <= 0) return null
  const db = createDbAdmin()
  const { data, error } = await db
    .from('usuario')
    .select('dashboard_modulos')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const raw = (data as { dashboard_modulos?: unknown } | null)?.dashboard_modulos
  return Array.isArray(raw) ? raw.map(String) : null
}

/** Cliente: accesos del dashboard para la sesión actual. */
export async function fetchModulosDashboardUsuario(usuarioId: number): Promise<string[] | null> {
  const res = await fetch(`/api/dashboard-modulos?usuario_id=${usuarioId}`, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar los accesos')
  return Array.isArray(json.modulos) ? (json.modulos as string[]) : null
}

export async function listarUsuariosAdmin(): Promise<UsuarioRegistro[]> {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('usuario')
    .select(SELECT_USUARIO)
    .order('usuario_id', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as UsuarioRegistro[]
}

function normalizarAutorizacion(raw: Partial<AccesoAutorizacion>): AccesoAutorizacion {
  const operadoId = Number(raw.operado_por_id)
  return {
    autorizado_por: String(raw.autorizado_por ?? '').trim().slice(0, 160),
    operado_por_id: Number.isFinite(operadoId) && operadoId > 0 ? operadoId : null,
    operado_por: String(raw.operado_por ?? '').trim().slice(0, 160),
  }
}

function diffAccesos(antes: readonly string[], despues: readonly string[]) {
  const a = new Set(antes)
  const d = new Set(despues)
  return {
    otorgados: despues.filter((id) => !a.has(id)),
    retirados: antes.filter((id) => !d.has(id)),
  }
}

function exigirAutorizacion(
  cambios: { otorgados: string[]; retirados: string[] },
  aut: AccesoAutorizacion
) {
  if (!cambios.otorgados.length && !cambios.retirados.length) return
  if (!aut.autorizado_por) {
    throw new Error('Indica quién autorizó el cambio de accesos a sistemas')
  }
  if (!aut.operado_por) {
    throw new Error('No se identificó al usuario que opera el cambio; vuelve a iniciar sesión')
  }
}

async function registrarBitacoraAccesos(
  usuarioId: number,
  cambios: { otorgados: string[]; retirados: string[] },
  aut: AccesoAutorizacion
) {
  const filas = [
    ...cambios.otorgados.map((modulo_id) => ({ modulo_id, accion: 'otorgado' })),
    ...cambios.retirados.map((modulo_id) => ({ modulo_id, accion: 'retirado' })),
  ].map((f) => ({ ...f, usuario_id: usuarioId, ...aut }))
  if (!filas.length) return
  const { error } = await createDbAdmin().from('usuario_acceso_bitacora').insert(filas)
  if (error) throw new Error(`Accesos guardados, pero falló la bitácora: ${error.message}`)
}

export async function listarBitacoraAccesos(usuarioId: number): Promise<AccesoBitacoraRegistro[]> {
  if (!Number.isFinite(usuarioId) || usuarioId <= 0) throw new Error('ID de usuario inválido')
  const { data, error } = await createDbAdmin()
    .from('usuario_acceso_bitacora')
    .select('id, usuario_id, modulo_id, accion, autorizado_por, operado_por_id, operado_por, created_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw new Error(error.message)
  return (data ?? []) as AccesoBitacoraRegistro[]
}

export async function crearUsuarioAdmin(raw: UsuarioGuardarPayload): Promise<UsuarioRegistro> {
  const input = normalizarInput(raw)
  const aut = normalizarAutorizacion(raw)
  const cambios = diffAccesos([], input.dashboard_modulos)
  exigirAutorizacion(cambios, aut)
  const db = createDbAdmin()

  const { data: existente } = await db
    .from('usuario')
    .select('usuario_id')
    .eq('usuario_username', input.usuario_username)
    .maybeSingle()

  if (existente) {
    throw new Error(`Ya existe el usuario «${input.usuario_username}»`)
  }

  const { data, error } = await db
    .from('usuario')
    .insert({
      ...input,
      usuario_alta: ahoraMysql(),
    })
    .select(SELECT_USUARIO)
    .single()

  if (error) throw new Error(error.message)
  const creado = data as UsuarioRegistro
  await registrarBitacoraAccesos(creado.usuario_id, cambios, aut)
  return creado
}

export async function actualizarUsuarioAdmin(
  usuarioId: number,
  raw: UsuarioGuardarPayload
): Promise<UsuarioRegistro> {
  if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
    throw new Error('ID de usuario inválido')
  }
  const input = normalizarInput(raw)
  const aut = normalizarAutorizacion(raw)
  const previos = await obtenerModulosDashboardUsuario(usuarioId)
  const cambios = diffAccesos(modulosVisiblesDeUsuario(usuarioId, previos), input.dashboard_modulos)
  exigirAutorizacion(cambios, aut)
  const db = createDbAdmin()

  const { data: choque } = await db
    .from('usuario')
    .select('usuario_id')
    .eq('usuario_username', input.usuario_username)
    .neq('usuario_id', usuarioId)
    .maybeSingle()

  if (choque) {
    throw new Error(`Ya existe el usuario «${input.usuario_username}»`)
  }

  const { data, error } = await db
    .from('usuario')
    .update(input)
    .eq('usuario_id', usuarioId)
    .select(SELECT_USUARIO)
    .single()

  if (error) throw new Error(error.message)
  await registrarBitacoraAccesos(usuarioId, cambios, aut)
  return data as UsuarioRegistro
}

export async function eliminarUsuarioAdmin(usuarioId: number): Promise<void> {
  if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
    throw new Error('ID de usuario inválido')
  }
  const db = createDbAdmin()
  const { error } = await db.from('usuario').delete().eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message)
}

/** Cliente: listado vía API. */
export async function fetchUsuariosCatalogo(): Promise<UsuarioRegistro[]> {
  const res = await fetch('/api/usuarios')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar usuarios')
  return (json.usuarios ?? []) as UsuarioRegistro[]
}

export async function fetchBitacoraAccesos(usuarioId: number): Promise<AccesoBitacoraRegistro[]> {
  const res = await fetch(`/api/usuarios?bitacora=${usuarioId}`, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar el historial de accesos')
  return (json.bitacora ?? []) as AccesoBitacoraRegistro[]
}

export async function fetchCrearUsuario(
  input: UsuarioGuardarPayload
): Promise<UsuarioRegistro> {
  const res = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'No se pudo crear')
  return json.usuario as UsuarioRegistro
}

export async function fetchActualizarUsuario(
  usuarioId: number,
  input: UsuarioGuardarPayload
): Promise<UsuarioRegistro> {
  const res = await fetch('/api/usuarios', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId, ...input }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'No se pudo actualizar')
  return json.usuario as UsuarioRegistro
}

export async function fetchEliminarUsuario(usuarioId: number): Promise<void> {
  const res = await fetch(`/api/usuarios?id=${usuarioId}`, { method: 'DELETE' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'No se pudo eliminar')
}

export function nombreCompletoUsuario(u: Pick<
  UsuarioRegistro,
  'usuario_nombre' | 'usuario_app' | 'usuario_apm'
>): string {
  return [u.usuario_nombre, u.usuario_app, u.usuario_apm]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}
