# 🔐 Configuración de Auth en Supabase

**Fecha:** 11 de Febrero, 2026  
**Proyecto:** Desayunos

---

## ⚠️ Advertencias de Auth Detectadas

El linter de Supabase detectó **3 problemas de configuración** en el sistema de autenticación:

### 1. OTP con Expiración Larga
**Problema:** El código OTP (One-Time Password) expira después de más de 1 hora.  
**Riesgo:** Ventana de tiempo muy amplia para ataques de fuerza bruta o robo de códigos.  
**Recomendación:** Configurar expiración a menos de 1 hora (idealmente 5-15 minutos).

### 2. Protección contra Contraseñas Filtradas Deshabilitada
**Problema:** Supabase Auth no está verificando contraseñas contra la base de datos de HaveIBeenPwned.  
**Riesgo:** Los usuarios pueden usar contraseñas que han sido comprometidas en brechas de seguridad.  
**Recomendación:** Habilitar esta función para mejorar la seguridad.

### 3. Versión de Postgres Desactualizada
**Problema:** Versión actual `17.4.1.064` tiene parches de seguridad disponibles.  
**Riesgo:** Vulnerabilidades conocidas sin parchear.  
**Recomendación:** Actualizar la base de datos.

---

## 🛠️ Cómo Solucionar

### 1. Reducir Expiración de OTP

**Pasos:**
1. Ve a **Supabase Dashboard**
2. Navega a **Authentication** → **Settings** → **Email Auth**
3. Busca la opción **"OTP Expiry"**
4. Cambia el valor a **15 minutos** (900 segundos) o menos
5. Guarda los cambios

**Configuración recomendada:**
```
OTP Expiry: 15 minutes (900 seconds)
```

---

### 2. Habilitar Protección contra Contraseñas Filtradas

**Pasos:**
1. Ve a **Supabase Dashboard**
2. Navega a **Authentication** → **Settings** → **Security and Protection**
3. Busca **"Leaked Password Protection"**
4. Activa el toggle ✅
5. Guarda los cambios

**Qué hace:**
- Verifica contraseñas contra la base de datos de HaveIBeenPwned.org (8+ billones de contraseñas comprometidas)
- Rechaza contraseñas que han sido filtradas en brechas de seguridad
- No envía las contraseñas completas - usa k-anonymity para privacidad

**Documentación:**
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

### 3. Actualizar Postgres

**Pasos:**
1. Ve a **Supabase Dashboard**
2. Navega a **Settings** → **Infrastructure** → **Database**
3. Verifica la versión actual: `17.4.1.064`
4. Haz clic en **"Upgrade"** si está disponible
5. Sigue las instrucciones del asistente

**⚠️ IMPORTANTE antes de actualizar:**
- Haz un backup completo de la base de datos
- Programa la actualización en horario de bajo tráfico
- Notifica al equipo
- Ten un plan de rollback

**Documentación:**
https://supabase.com/docs/guides/platform/upgrading

---

## 📊 Configuraciones Adicionales Recomendadas

### Fortaleza de Contraseñas

```
Minimum Password Length: 12 caracteres
Require uppercase: ✅
Require lowercase: ✅
Require numbers: ✅
Require special characters: ✅
```

### Rate Limiting

```
Max requests per hour: 30-60 (ajustar según necesidad)
Lockout duration: 1 hora
```

### Multi-Factor Authentication (MFA)

```
Enable MFA: ✅ (altamente recomendado para cuentas admin)
MFA Methods: TOTP (Google Authenticator, Authy)
```

### Email Templates

Personalizar plantillas de email para:
- Confirmación de registro
- Reset de contraseña
- Cambio de email
- Magic links

---

## ✅ Checklist de Seguridad Auth

- [ ] OTP expira en menos de 15 minutos
- [ ] Protección contra contraseñas filtradas habilitada
- [ ] Postgres actualizado a última versión
- [ ] Contraseñas requieren mínimo 12 caracteres
- [ ] Rate limiting configurado
- [ ] MFA disponible para usuarios
- [ ] Email templates personalizados
- [ ] HTTPS forzado en producción
- [ ] Cookies con SameSite=Strict
- [ ] Refresh tokens con rotación habilitada

---

## 🔗 Referencias

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Security Best Practices](https://supabase.com/docs/guides/platform/going-into-prod#security)
- [Password Security](https://supabase.com/docs/guides/auth/password-security)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)

---

**Última actualización:** 2026-02-11  
**Generado por:** Cursor AI - Claude Sonnet 4.5
