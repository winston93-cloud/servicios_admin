/**
 * Quién puede liberar trámites administrativos en Control Escolar.
 */
export const CE_LIBERAR_USUARIOS = ['laura', 'juanita', 'mario'] as const

export function normalizarUsuarioCe(username: string): string {
  return String(username ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

export function puedeLiberarTramiteAdministrativo(username: string): boolean {
  const u = normalizarUsuarioCe(username)
  if (!u) return false
  return (CE_LIBERAR_USUARIOS as readonly string[]).includes(u)
}
