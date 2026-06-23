import { createAdminClient } from '@insforge/sdk'
import type { InsForgeClient } from '@insforge/sdk'

let desayunosAdmin: InsForgeClient | null = null

function getDesayunosAdmin(): InsForgeClient {
  if (desayunosAdmin) return desayunosAdmin
  const baseUrl =
    process.env.INSFORGE_DESAYUNOS_URL ?? process.env.NEXT_PUBLIC_INSFORGE_DESAYUNOS_URL
  const apiKey = process.env.INSFORGE_DESAYUNOS_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error(
      'Faltan INSFORGE_DESAYUNOS_URL e INSFORGE_DESAYUNOS_API_KEY (proyecto Desayunos).'
    )
  }
  desayunosAdmin = createAdminClient({ baseUrl, apiKey })
  return desayunosAdmin
}

export interface NuevaNotificacion {
  referencia: number
  asunto: string
  mensaje: string
  estatus?: number
}

export interface Notificacion extends NuevaNotificacion {
  id: number
}

export async function crearNotificacion(
  payload: NuevaNotificacion
): Promise<{ data: Notificacion | null; error: string | null }> {
  try {
    const { data, error } = await getDesayunosAdmin()
      .database.from('notificaciones')
      .insert([
        {
          referencia: payload.referencia,
          asunto: payload.asunto || null,
          mensaje: payload.mensaje || null,
          estatus: payload.estatus ?? 1,
        },
      ])
      .select('*')
      .single()

    if (error) {
      console.error('Error creando notificación:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Notificacion, error: null }
  } catch (e: unknown) {
    console.error('Error inesperado creando notificación:', e)
    const errorMessage = e instanceof Error ? e.message : 'Error desconocido'
    return { data: null, error: errorMessage }
  }
}
