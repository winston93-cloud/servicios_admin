/** usuario_id con acceso a la bóveda (laura, mario). La tarjeta del dashboard usa la misma lista. */
export const ACCESOS_USUARIOS_PERMITIDOS: readonly number[] = [2, 17]

export const CATEGORIAS_ACCESO = [
  { id: 'equipo', etiqueta: 'Computadoras y equipos', corta: 'Equipos' },
  { id: 'correo', etiqueta: 'Correos', corta: 'Correos' },
  { id: 'sistema', etiqueta: 'Sistemas y páginas web', corta: 'Sistemas' },
  { id: 'servidor', etiqueta: 'Servidores y hosting', corta: 'Servidores' },
  { id: 'banco', etiqueta: 'Bancos y pagos', corta: 'Bancos' },
  { id: 'wifi', etiqueta: 'Wi-Fi e internet', corta: 'Wi-Fi' },
  { id: 'redes', etiqueta: 'Redes sociales', corta: 'Redes' },
  { id: 'otro', etiqueta: 'Otros', corta: 'Otros' },
] as const

export type CategoriaAcceso = (typeof CATEGORIAS_ACCESO)[number]['id']

export function esCategoriaAcceso(v: unknown): v is CategoriaAcceso {
  return CATEGORIAS_ACCESO.some((c) => c.id === v)
}

export function etiquetaCategoria(id: string): string {
  return CATEGORIAS_ACCESO.find((c) => c.id === id)?.etiqueta ?? 'Otros'
}

/** Lo que viaja al navegador en la lista: nunca incluye la contraseña. */
export type AccesoAutorizado = {
  id: number
  plataforma: string
  categoria: CategoriaAcceso
  usuario: string
  tiene_password: boolean
  url: string | null
  responsable: string | null
  notas: string | null
  creado_por: string | null
  actualizado_por: string | null
  created_at: string
  updated_at: string
}

export type AccesoBitacora = {
  id: number
  acceso_id: number | null
  plataforma: string | null
  accion: AccionBitacora
  usuario_nombre: string | null
  created_at: string
}

export type AccionBitacora = 'crear' | 'editar' | 'eliminar' | 'ver' | 'copiar' | 'abrir' | 'intento_fallido'

export const ETIQUETA_ACCION: Record<AccionBitacora, string> = {
  crear: 'Registró',
  editar: 'Editó',
  eliminar: 'Eliminó',
  ver: 'Vio la contraseña de',
  copiar: 'Copió la contraseña de',
  abrir: 'Abrió la bóveda',
  intento_fallido: 'Intento fallido de abrir la bóveda',
}

export type EstadoBoveda = { abierta: false } | { abierta: true; nombre: string; expira: number }
