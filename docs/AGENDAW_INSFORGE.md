# AgendaW en InsForge

El panel `/admin` y `/admin/dashboard` de **servicios_admin** usa el proyecto **AgendaW** en InsForge (no Supabase ni Winston Servicios).

## Variables en Vercel / `.env.local`

```env
NEXT_PUBLIC_ADMISSION_INSFORGE_URL=https://<appkey>.us-east.insforge.app
NEXT_PUBLIC_ADMISSION_INSFORGE_ANON_KEY=<anon del proyecto AgendaW>
ADMISSION_INSFORGE_API_KEY=<API key del proyecto AgendaW>
```

No hace falta `ADMISSION_SUPABASE_*`. El deploy de **agendaw.vercel.app** (papás) sigue en Supabase hasta el enlace final.

## Crear tablas en InsForge (proyecto AgendaW)

1. En InsForge Dashboard → **AgendaW** → copiar Project ID y API key.
2. Enlazar el CLI (una vez):

```bash
insforge login
insforge link --project-id <AGENDAW_PROJECT_ID> --org-id 3ffddf5b-9cf9-4a73-8d60-3de260c20676
```

3. Aplicar migraciones:

```bash
insforge db import migrations/agendaw/20260619120000_agendaw_admission_schema.sql
insforge db import migrations/agendaw/20260619120100_agendaw_rls_server_only.sql
```

4. Volver a enlazar Winston Servicios si trabajas el resto del portal:

```bash
insforge link --project-id 1a769c0a-ab1b-4500-bb6b-1e8bb131980b --org-id 3ffddf5b-9cf9-4a73-8d60-3de260c20676
```

## Tablas incluidas

| Tabla | Uso en servicios_admin |
|-------|------------------------|
| `admission_appointments` | Panel psicólogas |
| `blocked_dates` | Bloqueos de fechas/horas |
| `admission_schedules` | Horarios por nivel |
| `admission_permission_requests` | Dashboard directoras |
| `expediente_inicial` | Expediente desde admin |
| `tour_recorridos` | Recorridos vinculación |
| `wsp` | Reservado para flujo papás (enlace futuro) |

## Autenticación

- Login único en Servicios Administrativos (`staff_session`).
- Sin PIN: solo selector de área/nivel al entrar a `/admin` o `/admin/dashboard`.
