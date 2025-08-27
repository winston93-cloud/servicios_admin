import { supabase } from './supabase'

export interface NuevaNotificacion {
  referencia: number
  asunto: string
  mensaje: string
  estatus?: number
}

export interface Notificacion extends NuevaNotificacion {
  id: number
}

export async function crearNotificacion(payload: NuevaNotificacion): Promise<{ data: Notificacion | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('notificaciones')
      .insert({
        referencia: payload.referencia,
        asunto: payload.asunto || null,
        mensaje: payload.mensaje || null,
        estatus: payload.estatus ?? 1
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creando notificación:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Notificacion, error: null }
  } catch (e: any) {
    console.error('Error inesperado creando notificación:', e)
    return { data: null, error: e?.message ?? 'Error desconocido' }
  }
}
