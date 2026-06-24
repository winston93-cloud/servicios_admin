# Facturación CFDI — Roadmap de modernización

Reemplazo progresivo de `cfdiwinston` (PHP en winston93.edu.mx) por módulo en **servicios_admin**, usando **InsForge Winston Servicios** + **FacturoPorTi**.

No se usa un proyecto InsForge aparte: mismo backend que pagos y alumnos.

## Fase 1 — Fundación ✅

- [x] Tarjeta **Facturación CFDI** en dashboard Servicios Administrativos
- [x] Ruta `/facturacion` con shell, auth y menú de operaciones
- [x] Enlace al portal PHP legacy durante la transición

## Fase 2 — Datos e InsForge ✅

- [x] Tablas `datos_facturacion`, `cfdi_timbrado`, `cfdi_cancelacion`, `cfdi_nota_credito` (migración SQL)
- [x] RLS servidor-only (proxy `/api/database`)
- [x] Portal papás `/portal-facturacion` → InsForge (reemplaza `pagos/guardar_alumno.php`)
- [x] `datos_facturacion` en manifiesto de migración MySQL → InsForge
- [x] Aplicar SQL en InsForge Winston Servicios (`db import`)
- [x] Migrar filas desde MySQL `winston_general` (625 registros en `datos_facturacion`)
- [ ] Bucket Storage `cfdi` para XML/PDF (opcional hasta Fase 5)

## Fase 3 — Timbrado core ✅

- [x] Servicio TypeScript único (`src/lib/cfdi/*`, sin duplicar `timbrar.php` × 4)
- [x] API `POST /api/facturacion/timbrar` — factura **individual** y **por mes** (efectivo / transferencia)
- [x] UI `/facturacion/mes` y `/facturacion/individual` (Atmospheric Glass)
- [x] Actualizar `pago_detalle.facturo` en InsForge tras timbrado exitoso
- [x] Auditoría en `cfdi_timbrado` (`timbrado_mes` / `timbrado_individual`)
- [x] Complemento instituciones educativas (Churchill vs Educativo por `alumno_nivel`)
- [x] Credenciales PAC en Vercel: `FACTUROPORTI_*` (`scripts/setup-facturoporti-vercel-env.mjs` desde legacy)
- [ ] Persistir XML/PDF en Storage (hoy solo rutas legacy en auditoría)

## Fase 4 — Operaciones SAT

- Público en general por mes
- Cancelaciones (Winston / Educativo)
- Notas de crédito (devoluciones)
- Consulta saldo de timbres

## Fase 5 — Corte y legacy

- Reporte contadores (hoy en `/xml` en winston93)
- Redirección o apagado de `winston93.edu.mx/cfdiwinston`
- Retiro de credenciales del PHP en GitLab

## Referencia legacy

| Operación legacy | Ruta nueva |
|------------------|------------|
| Facturas x mes | `/facturacion/mes` |
| Factura individual | `/facturacion/individual` |
| Público general x mes | `/facturacion/publico-general` |
| Cancelaciones | `/facturacion/cancelaciones` |
| Devoluciones | `/facturacion/devoluciones` |
| Timbres | `/facturacion/timbres` |

PAC: FacturoPorTi (`api.facturoporti.com.mx`). Emisores: `IWC990723LX1` (Churchill), `IEW150424CC2` (Educativo).
