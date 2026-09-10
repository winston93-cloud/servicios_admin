# Google Auth en Reportes (RAC)

Login con Google en los 3 paneles de `/reportes-conducta` (maternal-kinder, primaria, secundaria), conviviendo con usuario/contraseña.

## Staff oficial (correo → rol)

Maestros: `boleta_maestro.maestro_email` + nivel.

Staff (allowlist en `src/lib/racStaffAllowlist.ts`):

| Panel | Correo | Rol |
|--------|--------|-----|
| Maternal/Kinder | `direccion.kinder@…` | Dirección español |
| Maternal/Kinder | `englishcoord.educativo@…` | Dirección inglés |
| Maternal/Kinder | `psicologia.kinder@…` | Psicología |
| Primaria | `direccion.primaria@…` | Dirección español |
| Primaria | `coordinacioninglesprimaria@…` | Dirección inglés |
| Primaria | `psicologia.primaria@…` | Psicología |
| Secundaria | `direccion.secundaria@…` | Dirección |
| Secundaria | `psicologia.secundaria@…` | Psicología |
| Secundaria | `prefectura.secundaria@…` | Prefectura |
| Secundaria | `asistente.secundaria@…` | Asistente |

Cualquier otro correo staff **no** entra (ni Google ni password) a ese panel.


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
