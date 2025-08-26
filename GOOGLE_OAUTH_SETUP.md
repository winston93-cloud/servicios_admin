# Configuración de Google OAuth en Supabase

## Descripción

Este proyecto ahora incluye autenticación con Google OAuth, lo que permite a los usuarios del dominio institucional `winston93.edu.mx` iniciar sesión de forma segura usando sus cuentas de Google.

## Ventajas de la implementación

1. **Seguridad mejorada**: No se almacenan contraseñas en texto plano
2. **Acceso restringido**: Solo usuarios del dominio `winston93.edu.mx` pueden autenticarse
3. **Sincronización automática**: Los usuarios se crean automáticamente en la base de datos local
4. **Compatibilidad**: Mantiene el sistema de autenticación anterior como respaldo

## Configuración en Supabase

### 1. Habilitar Google OAuth

1. Ve a tu proyecto de Supabase
2. Navega a **Authentication** > **Providers**
3. Busca **Google** y habilítalo
4. Haz clic en **Configure**

### 2. Configurar credenciales de Google

1. Ve a la [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google+ 
4. Ve a **Credentials** > **Create Credentials** > **OAuth 2.0 Client IDs**
5. Configura la aplicación:
   - **Application type**: Web application
   - **Name**: Winston Churchill Sistema (o el nombre que prefieras)
   - **Authorized redirect URIs**: 
     - `https://[TU_PROYECTO].supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (para desarrollo)

### 3. Obtener credenciales

1. Copia el **Client ID** y **Client Secret** generados
2. Pégalos en Supabase en la sección de configuración de Google
3. Guarda la configuración

### 4. Configurar restricciones de dominio (Opcional)

Para mayor seguridad, puedes configurar restricciones adicionales:

1. En Google Cloud Console, ve a **OAuth consent screen**
2. En **Test users**, agrega solo los correos del dominio `winston93.edu.mx`
3. O configura restricciones de dominio en **Authorized domains**

## Configuración en el proyecto

### Variables de entorno

Asegúrate de que tu archivo `.env.local` contenga:

```bash
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

### Estructura de la base de datos

La tabla `usuario` debe tener el campo `correo_electronico_del_usuario` para almacenar los correos de Google.

## Flujo de autenticación

1. **Usuario hace clic en "Iniciar sesión con Google"**
2. **Redirección a Google**: Se envía al usuario a la página de consentimiento de Google
3. **Autorización**: Usuario autoriza la aplicación
4. **Callback**: Google redirige de vuelta a `/auth/callback`
5. **Verificación de dominio**: Se verifica que el correo sea de `winston93.edu.mx`
6. **Sincronización**: Se busca o crea el usuario en la base de datos local
7. **Redirección**: Usuario es enviado al dashboard

## Funcionalidades implementadas

### Nuevas funciones en `authService.ts`

- `signInWithGoogle()`: Inicia el flujo de OAuth
- `handleAuthCallback()`: Maneja el callback de autenticación
- `syncUserWithDatabase()`: Sincroniza usuario de Google con BD local
- `getCurrentUser()`: Obtiene usuario actual de Supabase
- `getCurrentSession()`: Obtiene sesión actual
- `signOut()`: Cierra sesión de Google

### Páginas nuevas

- `/auth/callback`: Maneja el callback de OAuth
- Login actualizado con botón de Google

### Contexto de autenticación actualizado

- Soporte para usuarios de Google y sistema anterior
- Estado de autenticación unificado
- Escucha cambios en el estado de autenticación

## Seguridad

### Restricciones implementadas

1. **Dominio restringido**: Solo `winston93.edu.mx`
2. **Verificación en callback**: Doble verificación del dominio
3. **Sesiones seguras**: Manejo de sesiones a través de Supabase
4. **Logout automático**: Si el dominio no es válido

### Consideraciones adicionales

- Los usuarios se crean automáticamente en la BD local
- Se mantiene compatibilidad con el sistema anterior
- Las contraseñas no se almacenan para usuarios de Google

## Troubleshooting

### Problemas comunes

1. **Error de redirección**: Verifica las URIs autorizadas en Google Cloud Console
2. **Dominio no permitido**: Asegúrate de que el correo sea de `winston93.edu.mx`
3. **Error de callback**: Verifica que la ruta `/auth/callback` esté configurada

### Logs y debugging

- Revisa la consola del navegador para errores
- Verifica los logs de Supabase en la sección de Authentication
- Usa las herramientas de desarrollo de Google OAuth

## Mantenimiento

### Actualizaciones

- Mantén actualizadas las dependencias de Supabase
- Revisa regularmente los permisos de OAuth en Google Cloud Console
- Monitorea el uso de la API de Google

### Backup y recuperación

- El sistema mantiene compatibilidad con autenticación manual
- Los usuarios pueden alternar entre ambos métodos
- Los datos se sincronizan automáticamente

## Soporte

Para problemas técnicos:
1. Revisa los logs de la aplicación
2. Verifica la configuración de Supabase
3. Confirma las credenciales de Google
4. Consulta la documentación de Supabase y Google OAuth
