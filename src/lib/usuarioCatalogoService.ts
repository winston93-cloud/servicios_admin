import { createDbAdmin } from '@/lib/insforgeAdmin'

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
}

const SELECT_USUARIO =
  'usuario_id, perfil_id, usuario_app, usuario_apm, usuario_nombre, usuario_username, usuario_email, usuario_password, usuario_status, usuario_alta, nivel'

function ahoraMysql(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function normalizarInput(raw: Partial<UsuarioInput>): UsuarioInput {
  const username = String(raw.usuario_username ?? '').trim()
  const password = String(raw.usuario_password ?? '').trim()
  if (!username) throw new Error('El usuario (username) es obligatorio')
  if (!password) throw new Error('La clave es obligatoria')
  if (username.length > 20) throw new Error('El username no puede pasar de 20 caracteres')

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
  }
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

export async function crearUsuarioAdmin(raw: Partial<UsuarioInput>): Promise<UsuarioRegistro> {
  const input = normalizarInput(raw)
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
  return data as UsuarioRegistro
}

export async function actualizarUsuarioAdmin(
  usuarioId: number,
  raw: Partial<UsuarioInput>
): Promise<UsuarioRegistro> {
  if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
    throw new Error('ID de usuario inválido')
  }
  const input = normalizarInput(raw)
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

export async function fetchCrearUsuario(
  input: Partial<UsuarioInput>
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
  input: Partial<UsuarioInput>
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
