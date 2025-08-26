import { supabase } from './supabase'
import { User, Session, AuthError } from '@supabase/supabase-js'

export interface Usuario {
  usuario_id: number
  perfil_id: number
  usuario_username: string
  usuario_password: string
  usuario_nombre: string
  usuario_app: string
  usuario_apm: string
  usuario_email: string
  usuario_status: number
  usuario_alta?: string
  nivel: number
  usuario_nombre_completo?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthUser {
  usuario_id: number
  usuario_username: string
  usuario_nombre_completo: string
  email?: string
}

// Dominio institucional permitido
const ALLOWED_DOMAIN = 'winston93.edu.mx'

// Función para verificar si el dominio del correo está permitido
function isAllowedDomain(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)
}

// Función para iniciar sesión con Google
export async function signInWithGoogle(): Promise<{ url: string | null; error: AuthError | null }> {
  try {
    // Determinar la URL de redirección basada en la URL actual
    const isVercel = window.location.hostname === 'desayunos.vercel.app'
    const redirectUrl = isVercel 
      ? 'https://desayunos.vercel.app/auth/callback'
      : `${window.location.origin}/auth/callback`

    // Debug logging
    console.log('🔍 Google OAuth Debug:')
    console.log('  - Hostname:', window.location.hostname)
    console.log('  - Origin:', window.location.origin)
    console.log('  - Is Vercel:', isVercel)
    console.log('  - Redirect URL:', redirectUrl)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          hd: ALLOWED_DOMAIN, // Restringe a usuarios del dominio específico
        }
      }
    })

    // Debug logging
    console.log('  - Supabase response URL:', data.url)
    console.log('  - Supabase error:', error)

    // Verificar que la URL de redirección sea la correcta
    if (data.url && !data.url.includes(redirectUrl)) {
      console.warn('⚠️ Supabase está ignorando redirectTo, forzando URL correcta')
      // Forzar la URL correcta si Supabase la ignora
      const correctedUrl = data.url.replace(
        /redirect_uri=[^&]+/,
        `redirect_uri=${encodeURIComponent(redirectUrl)}`
      )
      console.log('  - URL corregida:', correctedUrl)
      return { url: correctedUrl, error }
    }

    return { url: data.url, error }
  } catch (error) {
    console.error('Error en signInWithGoogle:', error)
    return { url: null, error: error as AuthError }
  }
}

// Función para manejar el callback de autenticación
export async function handleAuthCallback(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      return { user: null, error }
    }

    if (data.session?.user) {
      const user = data.session.user
      
      // Verificar que el correo sea del dominio permitido
      if (user.email && !isAllowedDomain(user.email)) {
        // Cerrar sesión si el dominio no está permitido
        await supabase.auth.signOut()
        return { 
          user: null, 
          error: { 
            message: `Solo se permiten correos del dominio ${ALLOWED_DOMAIN}`,
            status: 403
          } as AuthError 
        }
      }

      // Buscar o crear usuario en la tabla local
      await syncUserWithDatabase(user)
      
      return { user, error: null }
    }

    return { user: null, error: null }
  } catch (error) {
    console.error('Error en handleAuthCallback:', error)
    return { user: null, error: error as AuthError }
  }
}

// Función para sincronizar usuario de Google con la base de datos local
async function syncUserWithDatabase(googleUser: User): Promise<void> {
  if (!googleUser.email) return

  try {
    // Buscar si el usuario ya existe en la tabla local
    const { data: existingUser, error: searchError } = await supabase
      .from('usuario')
      .select('*')
      .eq('usuario_email', googleUser.email)
      .single()

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Error buscando usuario:', searchError)
      return
    }

    if (!existingUser) {
      console.log('Usuario no encontrado en BD local, pero continuando...')
      // No vamos a crear usuarios automáticamente por ahora
      // Solo log para debugging
    } else {
      console.log('Usuario encontrado en BD local:', existingUser)
    }
  } catch (error) {
    console.error('Error sincronizando usuario:', error)
    // Continuar sin fallar
  }
}

// Función para obtener el usuario actual de la sesión
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('Error obteniendo usuario actual:', error)
    return null
  }
}

// Función para obtener la sesión actual
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  } catch (error) {
    console.error('Error obteniendo sesión actual:', error)
    return null
  }
}

// Función para cerrar sesión
export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signOut()
    return { error }
  } catch (error) {
    console.error('Error cerrando sesión:', error)
    return { error: error as AuthError }
  }
}

// Función para escuchar cambios en la autenticación
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback)
}

// Función para obtener usuario de la base de datos local por email
export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('usuario_id, usuario_username, usuario_nombre, usuario_app, usuario_apm, usuario_email')
      .eq('usuario_email', email)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error obteniendo usuario por email:', error)
      return null
    }

    if (!data) {
      // Si no existe en la BD local, crear un usuario virtual con datos de Google
      console.log('Usuario no encontrado en BD local, creando usuario virtual')
      return {
        usuario_id: 0, // ID temporal
        usuario_username: email.split('@')[0],
        usuario_nombre_completo: email.split('@')[0], // Usar parte local del email
        email: email
      }
    }

    // Construir nombre completo de forma segura
    const nombreParts = [
      data.usuario_nombre || '',
      data.usuario_app || '',
      data.usuario_apm || ''
    ].filter(part => part && part.trim() !== '')
    
    const usuario_nombre_completo = nombreParts.length > 0 
      ? nombreParts.join(' ').trim()
      : data.usuario_username || email.split('@')[0]

    return {
      usuario_id: data.usuario_id,
      usuario_username: data.usuario_username,
      usuario_nombre_completo,
      email: data.usuario_email
    }
  } catch (error) {
    console.error('Error en getUserByEmail:', error)
    // En caso de error, crear usuario virtual
    return {
      usuario_id: 0,
      usuario_username: email.split('@')[0],
      usuario_nombre_completo: email.split('@')[0],
      email: email
    }
  }
}

// Función para mantener compatibilidad con el sistema anterior
export async function loginUser(credentials: LoginCredentials): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('usuario_id, usuario_username, usuario_password, usuario_nombre, usuario_app, usuario_apm')
      .eq('usuario_username', credentials.username)
      .eq('usuario_password', credentials.password)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error en login:', error)
      throw new Error('Error de conexión con la base de datos')
    }

    if (!data) {
      return null
    }

    const usuario_nombre_completo = `${data.usuario_nombre} ${data.usuario_app} ${data.usuario_apm}`.trim()

    return {
      usuario_id: data.usuario_id,
      usuario_username: data.usuario_username,
      usuario_nombre_completo
    }
  } catch (error) {
    console.error('Error en loginUser:', error)
    throw error
  }
}

// Funciones de localStorage para mantener compatibilidad
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

export function storeUser(user: AuthUser): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('auth_user', JSON.stringify(user))
  } catch (error) {
    console.error('Error al guardar usuario:', error)
  }
}

export function logoutUser(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem('auth_user')
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
  }
}
