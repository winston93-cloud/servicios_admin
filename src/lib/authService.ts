import { supabase } from './supabase'

export interface Usuario {
  usuario_id: number
  usuario_username: string
  usuario_password: string
  usuario_nombre: string
  usuario_app: string
  usuario_apm: string
  usuario_nombre_completo: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthUser {
  usuario_id: number
  usuario_username: string
  usuario_nombre_completo: string
}

// Función para realizar login
export async function loginUser(credentials: LoginCredentials): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('usuario_id, usuario_username, usuario_nombre, usuario_app, usuario_apm')
      .eq('usuario_username', credentials.username)
      .eq('usuario_password', credentials.password)
      .single()

    // Si hay un error pero es porque no encontró el registro, es credenciales incorrectas
    if (error && error.code !== 'PGRST116') {
      console.error('Error en login:', error)
      throw new Error('Error de conexión con la base de datos')
    }

    if (!data) {
      return null
    }

    // Crear nombre completo concatenando los campos
    const usuario_nombre_completo = `${data.usuario_nombre} ${data.usuario_app} ${data.usuario_apm}`.trim()

    return {
      usuario_id: data.usuario_id,
      usuario_username: data.usuario_username,
      usuario_nombre_completo
    }
  } catch (error) {
    console.error('Error en loginUser:', error)
    throw error // Re-lanzar el error para que lo maneje el componente
  }
}

// Función para verificar si hay una sesión activa
export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  
  try {
    const storedUser = localStorage.getItem('auth_user')
    return storedUser ? JSON.parse(storedUser) : null
  } catch (error) {
    console.error('Error al obtener usuario almacenado:', error)
    return null
  }
}

// Función para guardar usuario en localStorage
export function storeUser(user: AuthUser): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('auth_user', JSON.stringify(user))
  } catch (error) {
    console.error('Error al guardar usuario:', error)
  }
}

// Función para cerrar sesión
export function logoutUser(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem('auth_user')
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
  }
}
