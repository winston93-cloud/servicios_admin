import type { BoletaModulo } from './boletasPortal'

/**
 * Cuentas institucionales con acceso Google a boletas
 * (equivalente a dirección/admin, igual que entrar con su usuario del dashboard).
 */
export type BoletasDirectoraGoogle = {
  email: string
  nombre: string
  /** Prefijo de sesión (usuario sintético). */
  usuario: string
  /** ID estable de sesión admin (no colisiona con maestros reales). */
  id: number
  /** Módulos que supervisa en el portal de captura de maestras. Sin lista = todos. */
  supervisa?: BoletaModulo[]
}

export const BOLETAS_DIRECTORAS_GOOGLE: BoletasDirectoraGoogle[] = [
  {
    email: 'dg@winston93.edu.mx',
    nombre: 'Dirección General',
    usuario: 'dg',
    id: 900001,
  },
  {
    email: 'sistemas.desarrollo@winston93.edu.mx',
    nombre: 'Sistemas Desarrollo',
    usuario: 'sistemas.desarrollo',
    id: 900002,
  },
  {
    email: 'direccion.kinder@winston93.edu.mx',
    nombre: 'Dirección de Kinder',
    usuario: 'direccion.kinder',
    id: 900003,
    supervisa: ['kinder-es'],
  },
  {
    email: 'englishcoord.educativo@winston93.edu.mx',
    nombre: 'English Coordination',
    usuario: 'englishcoord.educativo',
    id: 900004,
    supervisa: ['kinder-en'],
  },
  {
    email: 'direccion.primaria@winston93.edu.mx',
    nombre: 'Dirección de Primaria',
    usuario: 'direccion.primaria',
    id: 900005,
    supervisa: ['primaria-es'],
  },
  {
    email: 'coordinacioninglesprimaria@winston93.edu.mx',
    nombre: 'English Coordination Primaria',
    usuario: 'coordinacioninglesprimaria',
    id: 900006,
    supervisa: ['primaria-en'],
  },
  {
    email: 'direccion.secundaria@winston93.edu.mx',
    nombre: 'Dirección de Secundaria',
    usuario: 'direccion.secundaria',
    id: 900007,
    supervisa: ['secundaria'],
  },
  {
    email: 'asistente.secundaria@winston93.edu.mx',
    nombre: 'Asistente de Dirección de Secundaria',
    usuario: 'asistente.secundaria',
    id: 900008,
    supervisa: ['secundaria'],
  },
]

export function boletasDirectoraPorEmail(emailRaw: string): BoletasDirectoraGoogle | null {
  const email = emailRaw.trim().toLowerCase()
  return BOLETAS_DIRECTORAS_GOOGLE.find((d) => d.email === email) ?? null
}
