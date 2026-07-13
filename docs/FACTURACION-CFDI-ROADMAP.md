# Facturación CFDI — Roadmap de modernización

Reemplazo progresivo de `cfdiwinston` (PHP en winston93.edu.mx) por módulo en **servicios_admin**, usando **InsForge Winston Servicios** + **FacturoPorTi**.

No se usa un proyecto InsForge aparte: mismo backend que pagos y alumnos.

## Política de producción

- **`cfdiwinston` permanece activo** hasta que Mario lo indique explícitamente, aunque el módulo nuevo esté listo.
- La **sincronización final** MySQL/phpMyAdmin → InsForge de `datos_facturacion` se hará **al lanzar el nuevo portal a producción**, no antes.
- El enlace al PHP legacy en `/facturacion` es respaldo operativo, no fecha de corte automática.

## Fase 1 — Fundación ✅

- [x] Tarjeta **Facturación CFDI** en dashboard Servicios Administrativos
- [x] Ruta `/facturacion` con shell, auth y menú de operaciones
- [x] Enlace al portal PHP legacy (sigue en prod)

## Fase 2 — Datos e InsForge ✅

- [x] Tablas `datos_facturacion`, `cfdi_timbrado`, `cfdi_cancelacion`, `cfdi_nota_credito` (migración SQL)
- [x] RLS servidor-only (proxy `/api/database`)
- [x] Portal papás `/portal-facturacion` → InsForge (reemplaza `pagos/guardar_alumno.php`)
- [x] `datos_facturacion` en manifiesto de migración MySQL → InsForge
- [x] Migración inicial desde MySQL (625 registros)
- [x] Bucket Storage `cfdi` para XML/PDF
- [x] Persistencia tras timbrado (admin + Banorte CE automático)
- [ ] Re-sync `datos_facturacion` al go-live (pedido por Mario en ese momento)

## Fase 3 — Timbrado core ✅

- [x] Servicio TypeScript único (`src/lib/cfdi/*`)
- [x] API `POST /api/facturacion/timbrar` — individual, por mes, público en general
- [x] UI mes / individual / público general (tema Totality)
- [x] `pago_detalle.facturo` + auditoría `cfdi_timbrado`
- [x] Persistir XML/PDF en Storage (`cfdi`)
- [x] Timbrado automático post Banorte CE (`registrarPagoBanorteExitoso`)
- [ ] Smoke PAC en Vercel / preview

## Fase 4 — Operaciones SAT ✅

- [x] Público en general por mes
- [x] Consulta saldo de timbres
- [x] Cancelaciones (`POST /api/facturacion/cancelar`, auditoría `cfdi_cancelacion`)
- [x] Notas de crédito / devoluciones (`POST /api/facturacion/nota-credito`, auditoría `cfdi_nota_credito`)

## Fase 5 — Corte y legacy (solo cuando Mario lo pida)

- Reporte contadores (hoy en `/xml` en winston93)
- Redirección o apagado de `winston93.edu.mx/cfdiwinston`
- Retiro de credenciales del PHP en GitLab
- Go-live: re-sync `datos_facturacion` MySQL → InsForge

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
