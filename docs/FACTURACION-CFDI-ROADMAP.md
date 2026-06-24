# Facturación CFDI — Roadmap de modernización

Reemplazo progresivo de `cfdiwinston` (PHP en winston93.edu.mx) por módulo en **servicios_admin**, usando **InsForge Winston Servicios** + **FacturoPorTi**.

No se usa un proyecto InsForge aparte: mismo backend que pagos y alumnos.

## Fase 1 — Fundación (actual)

- [x] Tarjeta **Facturación CFDI** en dashboard Servicios Administrativos
- [x] Ruta `/facturacion` con shell, auth y menú de operaciones (placeholders)
- [x] Enlace al portal legacy PHP durante la transición
- [ ] Eliminar proyecto InsForge huérfano `d4100337-...` si no se usa

## Fase 2 — Datos e InsForge (actual)

- [x] Tablas `datos_facturacion`, `cfdi_timbrado`, `cfdi_cancelacion`, `cfdi_nota_credito` (migración SQL)
- [x] RLS servidor-only (proxy `/api/database`)
- [x] Portal papás `/portal-facturacion` → InsForge (reemplaza `pagos/guardar_alumno.php`)
- [x] `datos_facturacion` en manifiesto de migración MySQL → InsForge
- [x] Aplicar SQL en InsForge Winston Servicios (`db import`)
- [x] Migrar filas desde MySQL `winston_general` (625 registros en `datos_facturacion`)
- [ ] Variables PAC en Vercel: `FACTUROPORTI_BEARER_*`, CSD por emisor (secrets, Fase 3)
- [ ] Bucket Storage `cfdi` para XML/PDF (opcional hasta Fase 5)

## Fase 3 — Timbrado core

- Servicio TypeScript único (sin duplicar `timbrar.php` × 4)
- API: factura **individual** y **por mes** (efectivo / transferencia)
- Actualizar `pago_detalle.facturo` en InsForge
- Complemento instituciones educativas (Churchill vs Educativo por `alumno_nivel`)

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
