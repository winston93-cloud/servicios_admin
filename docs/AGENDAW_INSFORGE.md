# AgendaW en InsForge

Esquema y datos de admisión en el proyecto **AgendaW** de InsForge (`sr6a9iza`).  
El panel admin y el dashboard de directoras viven en **agendaw.vercel.app** (Supabase).  
Este repo solo conserva migraciones y scripts de referencia.

## Variables en Vercel / `.env.local` (opcional)

Solo necesarias si vuelves a conectar código a AgendaW desde este proyecto:

```env
NEXT_PUBLIC_ADMISSION_INSFORGE_URL=https://<appkey>.us-east.insforge.app
NEXT_PUBLIC_ADMISSION_INSFORGE_ANON_KEY=<anon del proyecto AgendaW>
ADMISSION_INSFORGE_API_KEY=<API key del proyecto AgendaW>
```

El deploy de **agendaw.vercel.app** (papás, admin, directoras) sigue en Supabase.

## Crear tablas en InsForge (proyecto AgendaW)

**Estado:** migraciones aplicadas en InsForge **AgendaW** (`d5c0f471-a16c-497c-b92c-d3f2d0f2638f`, appkey `sr6a9iza`).

Si necesitas recrearlas en otro entorno:

1. Enlazar el CLI al proyecto AgendaW (carpeta `agendaw` ya tiene `.insforge/project.json`):

```bash
cd /home/mario/Proyectos/agendaw
insforge link --project-id d5c0f471-a16c-497c-b92c-d3f2d0f2638f --org-id 3ffddf5b-9cf9-4a73-8d60-3de260c20676
```

2. Aplicar migraciones desde `servicios_admin`:

```bash
insforge db import migrations/agendaw/20260619120000_agendaw_admission_schema.sql
insforge db import migrations/agendaw/20260619120100_agendaw_rls_server_only.sql
```

3. Obtener claves para Vercel:

```bash
insforge secrets get ANON_KEY   # → NEXT_PUBLIC_ADMISSION_INSFORGE_ANON_KEY
# API key en Dashboard o en agendaw/.insforge/project.json tras link
```

4. Volver a Winston Servicios si trabajas el portal principal:

```bash
cd /home/mario/Proyectos/servicios_admin
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

La agenda (admin y directoras) usa el login de **agendaw.vercel.app** (PIN por área/nivel).  
Desde el dashboard de servicios_admin solo hay enlaces externos a esas URLs.
