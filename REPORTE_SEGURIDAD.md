# 🔒 Reporte de Seguridad - Base de Datos Desayunos

**Fecha:** 11 de Febrero, 2026  
**Severidad:** 🔴 **CRÍTICA**  
**Total de problemas:** 18 errores de seguridad

---

## 📋 Resumen Ejecutivo

El linter de Supabase detectó **18 problemas de seguridad críticos** en la base de datos:

- **13 tablas** sin Row Level Security (RLS) habilitado
- **1 tabla** con políticas RLS pero el sistema RLS deshabilitado
- **8 vistas** con configuración SECURITY DEFINER

---

## 🚨 Problemas Críticos

### 1. RLS Deshabilitado en Tablas Públicas (13 tablas)

**Riesgo:** Cualquier usuario puede leer/modificar/eliminar todos los datos sin restricciones.

#### Tablas afectadas:
1. ✅ `personal` - Contiene información del personal
2. ✅ `auditoria` - Registros de auditoría del sistema
3. ✅ `pago_desayunos` - Pagos de desayunos
4. ⚠️ `reservas_backup` - Tabla de respaldo
5. ✅ `wsp` - Datos de WhatsApp
6. ⚠️ `reservas_backup_funcion2_hoy` - Tabla de respaldo temporal
7. ⚠️ `reservas_backup_funcion2_2025_12_04` - Tabla de respaldo temporal
8. ⚠️ `reservas_backup_funcion1_2025_12_02` - Tabla de respaldo temporal
9. ✅ `ag_alumno` - Datos de alumnos

**Estado:** ✅ = Tabla en uso | ⚠️ = Posible tabla obsoleta

---

### 2. Tabla con Políticas RLS pero Sistema Deshabilitado

**Tabla:** `pago_desayunos`

**Problema:** La tabla tiene una política RLS llamada "Allow public access", pero el sistema RLS no está habilitado en la tabla, por lo que la política **no se aplica**.

**Solución:** Ejecutar `ALTER TABLE public.pago_desayunos ENABLE ROW LEVEL SECURITY;`

---

### 3. Vistas con SECURITY DEFINER (8 vistas)

**Problema:** Estas vistas se ejecutan con los permisos del usuario que las creó, no del usuario que las consulta. Esto puede:
- Permitir acceso a datos que el usuario no debería ver
- Ocultar el verdadero origen de los permisos
- Dificultar la auditoría de seguridad

#### Vistas afectadas:
1. `v_expenses_by_category` - Gastos por categoría
2. `v_expenses_by_person_category` - Gastos por persona y categoría
3. `v_expenses_by_person` - Gastos por persona
4. `vista_contratos_indeterminado` - Contratos indeterminados
5. `v_balance` - Balance general
6. `vista_contratos_determinado` - Contratos determinados
7. `vista_contratos_hora` - Contratos por hora
8. `expense_details` - Detalles de gastos

**Recomendación:** Evaluar si SECURITY DEFINER es realmente necesario. En la mayoría de casos, es mejor usar SECURITY INVOKER (por defecto).

---

## 🛠️ Soluciones Propuestas

### Opción 1: Solución Rápida (Recomendada para desarrollo)

He creado el archivo `fix_security_issues.sql` que:

1. ✅ Habilita RLS en todas las tablas afectadas
2. ✅ Crea políticas RLS permisivas (`Allow public access`) para mantener el comportamiento actual
3. ℹ️ Incluye comentarios para ajustar las vistas SECURITY DEFINER

**Pasos:**
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia y pega el contenido de `fix_security_issues.sql`
4. Ejecuta el script
5. Verifica que no haya errores

**⚠️ IMPORTANTE:** Estas políticas permiten acceso completo. Son apropiadas para desarrollo pero **NO para producción**.

---

### Opción 2: Solución Segura (Recomendada para producción)

Para un ambiente de producción, debes definir políticas RLS específicas según tu lógica de negocio:

#### Ejemplo: Restricción por usuario autenticado

```sql
-- Solo usuarios autenticados pueden leer
CREATE POLICY "authenticated_read" 
  ON public.personal 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "admin_write" 
  ON public.personal 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');
```

#### Ejemplo: Restricción por propiedad de datos

```sql
-- Los usuarios solo ven sus propios pagos
CREATE POLICY "user_own_payments" 
  ON public.pago_desayunos 
  FOR SELECT 
  USING (auth.uid() = user_id);
```

---

## 🧹 Limpieza Recomendada

### Tablas de Backup Obsoletas

Las siguientes tablas parecen ser respaldos temporales antiguos:

- `reservas_backup`
- `reservas_backup_funcion2_hoy`
- `reservas_backup_funcion2_2025_12_04`
- `reservas_backup_funcion1_2025_12_02`

**Recomendación:**
1. Verifica si estas tablas todavía son necesarias
2. Si no, elimínalas para reducir la superficie de ataque
3. Si son necesarias, considera moverlas a un schema privado (ej: `backup` o `internal`)

```sql
-- Mover a schema privado
CREATE SCHEMA IF NOT EXISTS backup;
ALTER TABLE public.reservas_backup SET SCHEMA backup;
-- El schema 'backup' no debe estar expuesto en PostgREST
```

---

## 📊 Verificación Post-Implementación

Después de aplicar las correcciones, ejecuta estas queries en Supabase SQL Editor:

### 1. Verificar RLS habilitado

```sql
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'personal', 'auditoria', 'pago_desayunos', 
    'reservas_backup', 'wsp', 'ag_alumno'
  )
ORDER BY tablename;
```

**Resultado esperado:** Todas las tablas deben tener `rls_enabled = true`

### 2. Verificar políticas RLS

```sql
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd as operation,
  CASE 
    WHEN roles = '{public}' THEN 'Público'
    ELSE array_to_string(roles, ', ')
  END as roles
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

**Resultado esperado:** Cada tabla debe tener al menos una política

### 3. Verificar vistas SECURITY DEFINER

```sql
SELECT 
  schemaname,
  viewname,
  CASE 
    WHEN definition LIKE '%SECURITY DEFINER%' THEN '⚠️ DEFINER'
    ELSE '✅ INVOKER'
  END as security_type
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
    'v_expenses_by_category',
    'v_expenses_by_person_category',
    'v_expenses_by_person',
    'v_balance',
    'expense_details',
    'vista_contratos_indeterminado',
    'vista_contratos_determinado',
    'vista_contratos_hora'
  )
ORDER BY viewname;
```

---

## 🎯 Plan de Acción Recomendado

### Fase 1: Corrección Inmediata (Hoy)
- [ ] Ejecutar `fix_security_issues.sql` en Supabase
- [ ] Verificar que RLS está habilitado en todas las tablas
- [ ] Probar que la aplicación sigue funcionando correctamente

### Fase 2: Evaluación (Esta semana)
- [ ] Identificar qué tablas de backup son obsoletas
- [ ] Documentar qué datos son sensibles y requieren protección
- [ ] Definir roles de usuario (admin, usuario, invitado, etc.)

### Fase 3: Implementación de Seguridad (Próxima semana)
- [ ] Diseñar políticas RLS específicas para cada tabla
- [ ] Implementar políticas en ambiente de desarrollo
- [ ] Probar exhaustivamente
- [ ] Aplicar a producción

### Fase 4: Vistas SECURITY DEFINER (Opcional)
- [ ] Obtener definiciones de vistas con `pg_get_viewdef()`
- [ ] Evaluar si SECURITY DEFINER es necesario
- [ ] Recrear vistas sin SECURITY DEFINER si es posible

---

## 📚 Recursos

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)

---

## ⚡ Comandos Rápidos

```bash
# Ver este reporte
cat REPORTE_SEGURIDAD.md

# Ejecutar correcciones (en Supabase SQL Editor)
# Copia el contenido de fix_security_issues.sql
```

---

**Última actualización:** 2026-02-11  
**Generado por:** Cursor AI - Claude Sonnet 4.5
