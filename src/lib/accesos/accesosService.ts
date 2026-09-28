import { createDbAdmin } from '@/lib/insforgeAdmin'
import { AccesosError, cifrarPassword, descifrarPassword } from '@/lib/accesos/accesosAuth'
import {
  esCategoriaAcceso,
  type AccesoAutorizado,
  type AccesoBitacora,
  type AccionBitacora,
} from '@/lib/accesos/accesosTypes'

const COLUMNAS =
  'id, plataforma, categoria, usuario, password_cifrado, url, responsable, notas, creado_por, actualizado_por, created_at, updated_at'

type Fila = Omit<AccesoAutorizado, 'tiene_password'> & { password_cifrado: string | null }

function aPublico(f: Fila): AccesoAutorizado {
  const { password_cifrado, ...resto } = f
  return { ...resto, categoria: esCategoriaAcceso(f.categoria) ? f.categoria : 'otro', tiene_password: !!password_cifrado }
}

const texto = (v: unknown, max: number) => {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, max) : null
}

export async function registrarBitacora(
  accion: AccionBitacora,
  quien: { uid: number; nombre: string },
  acceso?: { id: number; plataforma: string } | null
) {
  const { error } = await createDbAdmin()
    .from('acceso_autorizado_bitacora')
    .insert([
      {
        accion,
        acceso_id: acceso?.id ?? null,
        plataforma: acceso?.plataforma ?? null,
        usuario_id: quien.uid,
        usuario_nombre: quien.nombre,
      },
    ])
  if (error) console.error('accesos bitácora:', error)
}

export async function listarAccesos(): Promise<AccesoAutorizado[]> {
  const { data, error } = await createDbAdmin()
    .from('acceso_autorizado')
    .select(COLUMNAS)
    .order('plataforma', { ascending: true })
  if (error) throw new AccesosError('No se pudieron cargar los accesos.', 500)
  return ((data ?? []) as Fila[]).map(aPublico)
}

async function obtenerFila(id: number): Promise<Fila> {
  const { data, error } = await createDbAdmin().from('acceso_autorizado').select(COLUMNAS).eq('id', id).maybeSingle()
  if (error) throw new AccesosError('No se pudo consultar el acceso.', 500)
  if (!data) throw new AccesosError('Ese acceso ya no existe.', 404)
  return data as Fila
}

export type AccesoInput = {
  id?: number
  plataforma?: unknown
  categoria?: unknown
  usuario?: unknown
  password?: unknown
  quitar_password?: unknown
  url?: unknown
  responsable?: unknown
  notas?: unknown
}

/** Crea o edita. `password` vacío en edición conserva la anterior; `quitar_password` la borra. */
export async function guardarAcceso(input: AccesoInput, quien: { uid: number; nombre: string }): Promise<AccesoAutorizado> {
  const plataforma = texto(input.plataforma, 160)
  if (!plataforma) throw new AccesosError('Escribe el nombre de la plataforma o equipo.')
  const categoria = esCategoriaAcceso(input.categoria) ? input.categoria : 'otro'
  const password = typeof input.password === 'string' ? input.password : ''
  if (password.length > 500) throw new AccesosError('La contraseña es demasiado larga.')

  const campos: Record<string, unknown> = {
    plataforma,
    categoria,
    usuario: texto(input.usuario, 200) ?? '',
    url: texto(input.url, 500),
    responsable: texto(input.responsable, 160),
    notas: texto(input.notas, 2000),
    actualizado_por: quien.nombre,
    updated_at: new Date().toISOString(),
  }
  if (password) campos.password_cifrado = cifrarPassword(password)
  else if (input.quitar_password === true) campos.password_cifrado = null

  const db = createDbAdmin()
  const id = Number(input.id) || 0
  if (id) {
    await obtenerFila(id)
    const { data, error } = await db.from('acceso_autorizado').update(campos).eq('id', id).select(COLUMNAS).single()
    if (error) throw new AccesosError('No se pudo guardar el acceso.', 500)
    await registrarBitacora('editar', quien, { id, plataforma })
    return aPublico(data as Fila)
  }
  const { data, error } = await db
    .from('acceso_autorizado')
    .insert([{ ...campos, creado_por: quien.nombre }])
    .select(COLUMNAS)
    .single()
  if (error) throw new AccesosError('No se pudo registrar el acceso.', 500)
  const fila = data as Fila
  await registrarBitacora('crear', quien, { id: fila.id, plataforma })
  return aPublico(fila)
}

export async function eliminarAcceso(id: number, quien: { uid: number; nombre: string }) {
  const fila = await obtenerFila(id)
  const { error } = await createDbAdmin().from('acceso_autorizado').delete().eq('id', id)
  if (error) throw new AccesosError('No se pudo eliminar el acceso.', 500)
  await registrarBitacora('eliminar', quien, { id, plataforma: fila.plataforma })
}

export async function revelarPassword(
  id: number,
  motivo: 'ver' | 'copiar',
  quien: { uid: number; nombre: string }
): Promise<string> {
  const fila = await obtenerFila(id)
  if (!fila.password_cifrado) throw new AccesosError('Este acceso no tiene contraseña registrada.', 404)
  const password = descifrarPassword(fila.password_cifrado)
  await registrarBitacora(motivo, quien, { id, plataforma: fila.plataforma })
  return password
}

export async function listarBitacora(limite = 200): Promise<AccesoBitacora[]> {
  const { data, error } = await createDbAdmin()
    .from('acceso_autorizado_bitacora')
    .select('id, acceso_id, plataforma, accion, usuario_nombre, created_at')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw new AccesosError('No se pudo cargar la bitácora.', 500)
  return (data ?? []) as AccesoBitacora[]
}
