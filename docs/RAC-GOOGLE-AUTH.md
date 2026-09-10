# Google Auth en Reportes (RAC)

Login con Google en los 3 paneles de `/reportes-conducta` (maternal-kinder, primaria, secundaria), conviviendo con usuario/contraseña.

## Cómo funciona

1. El docente/staff elige **Continuar con Google** (cuenta `@winston93.edu.mx`).
2. El servidor verifica el `id_token` y busca el correo en:
   - `boleta_maestro.maestro_email` (maestros del nivel)
   - `usuario.usuario_email` (psicología, dirección, prefectura/asistente, control escolar)
3. Se emite la **misma cookie HMAC** que el login por contraseña → mismos permisos.
4. Si el correo está en **varias cuentas** (p. ej. `idiomas@…`), se muestra un **selector**.

En primaria / maternal-kinder, por Google **no** entran asistentes de coordinación (perfil 2); sí maestros, psicología, control escolar y dirección.

## Setup Google Cloud (primera vez)

1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto Winston (o uno nuevo).
2. **APIs y servicios → Pantalla de consentimiento OAuth**
   - Tipo: **Interna** si usas Google Workspace de `winston93.edu.mx` (recomendado).
   - App name: p. ej. `Servicios Winston RAC`.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**
   - Nombre: `servicios-admin RAC`
   - **Orígenes de JavaScript autorizados:**
     - `https://servicios.winston93.edu.mx`
     - `http://localhost:3000` (dev)
   - No hace falta redirect URI para GIS (botón / One Tap con `id_token`).
4. Copia el **Client ID** (termina en `.apps.googleusercontent.com`).

## Env

Local (`.env.local`) y Vercel:

```bash
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

Redeploy tras añadir la variable en Vercel.

## Prueba rápida

1. Abrir `/reportes-conducta/secundaria` (o primaria / maternal-kinder).
2. Entrar con Google usando un correo ya cargado en el catálogo.
3. Caso ambiguo: `idiomas@winston93.edu.mx` debe pedir elegir cuenta.

## Archivos

- `src/lib/racGoogleIdToken.ts` — verificación del token
- `src/lib/racAuthGoogle.ts` — mapeo email → candidatos / sesión
- `src/app/api/rac/auth/google/route.ts`
- `src/app/api/rac-nivel/[slug]/auth/google/route.ts`
- `src/app/reportes-conducta/components/RacGoogleSignIn.tsx`
