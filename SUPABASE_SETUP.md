# Configuración de Supabase para Desayunos POS

## Paso 1: Obtener las credenciales de Supabase

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard/project/nmxrccrbnoenkahefrrw
2. Ve a **Settings** → **API**
3. Copia la **URL** y la **anon key**

## Paso 2: Configurar las variables de entorno

Crea o edita el archivo `.env.local` en la raíz del proyecto con:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

## Paso 3: Verificar la tabla alumno

La tabla `alumno` debe tener los siguientes campos:
- `alumno_id` (integer, primary key)
- `alumno_ref` (text)
- `alumno_app` (text) - apellido paterno
- `alumno_apm` (text) - apellido materno
- `alumno_nombre` (text) - nombre
- `alumno_nombre_completo` (text) - nombre completo concatenado
- `alumno_nivel` (integer) - nivel/grado

## Paso 4: Ejecutar optimizaciones de base de datos

Ejecuta el archivo `database_optimization.sql` en el SQL Editor de Supabase para crear los índices necesarios.

## Paso 5: Reiniciar el servidor

```bash
npm run dev
```

## Funcionalidades implementadas

✅ Búsqueda autocompletada usando el campo `alumno_nombre_completo` directamente
✅ Debounce de 300ms para optimizar consultas
✅ Manejo de errores y estados de carga
✅ Interfaz consistente con el diseño existente
✅ Límite de 5 resultados por búsqueda
✅ Índices optimizados para búsqueda rápida

## Notas importantes

- La búsqueda se activa con mínimo 2 caracteres
- Los resultados se muestran en tiempo real
- Se incluye información adicional: referencia, nivel y ID formateado
- El componente es completamente funcional con datos reales de Supabase
- Ahora usa el campo `alumno_nombre_completo` pre-calculado en lugar de concatenar campos 