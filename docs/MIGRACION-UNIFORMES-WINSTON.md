# Migración InsForge: Uniformes (`q488j9fg`) → Winston Servicios (`g4ta4bfg`)

Fecha: 2026-10-19  
App: `~/Proyectos/uniformes` (Vercel `uniformes`). Uniformes se usa de 8:00 a 17:30: el corte va fuera de ese horario.

## Política

- En Winston **no se borra ni se modifica nada**: solo se crearon objetos nuevos.
- `alumno`, `ciclos_escolares` y `usuario` existían en los dos proyectos; Uniformes usa **las de Winston** (decisión de Mario):
  - `alumno`: la de Uniformes era copia vieja (761 con grado del ciclo pasado); producción ya leía alumnos de Winston (`INSFORGE_ALUMNOS_*`). Los pedidos guardan el nombre del cliente, no el `alumno_id`.
  - `ciclos_escolares`: Uniformes marcaba 2025-2026 como actual y sus id chocaban con Winston. Ninguna tabla de Uniformes guarda ciclo; solo filtra alumnos y el selector del encabezado. Ahora se leen de Winston por `/api/ciclos-escolares`, en solo lectura (la pantalla ya no crea ni cambia ciclos).
  - `usuario`: mismos id con otras personas. El login usa `usuarios_uniformes`; `usuario` solo se consultaba para un nombre que ninguna pantalla muestra (las devoluciones guardan `usuario_id = 1` fijo). Las FK de Uniformes hacia `usuario` no se crearon en Winston.
- Funciones que ya existían en Winston no se reemplazan (`update_updated_at_column` es equivalente; las de ciclos no aplican).
- El navegador usa la llave **anon** de Winston (nunca la `ik_`). Antes del corte, Uniformes mandaba su llave de servicio en `NEXT_PUBLIC_INSFORGE_ANON_KEY`; la constancia fiscal y los ciclos ahora pasan por rutas de servidor.
- Se quitaron `/migracion` y `/api/migracion/*` de Uniformes (incluían `wipe-insforge`).

## Qué se migró

- 43 tablas con datos (127 mil filas; `auditoria` 115,309), mismas políticas RLS que en Uniformes (como Cheques y Caja Chica).
- 31 funciones, 61 triggers, 59 índices, FK, CHECK/UNIQUE y 2 secuencias de folios (`cotizacion_folio_seq`, `devoluciones_folio_seq`).
- Bucket privado `datos-fiscales-clientes` (1 constancia PDF, misma ruta).

Esquema: `migrations/20261019190000_uniformes_tablas.sql` (antes de copiar) y `migrations/20261019190100_uniformes_logica.sql` (después), generados con `scripts/generar-esquema-uniformes-winston.mjs`.  
Copia y verificación fila por fila: `scripts/migrar-uniformes-a-winston.mjs`.

## Respaldo

`~/Respaldos/uniformes-insforge-20261019/` (JSON de las 46 tablas completas + PDF) y `~/Respaldos/uniformes-insforge-20261019-esquema.sql.gz`.

## Corte

**Hecho el 19 oct 2026 ~13:05** (sin movimientos en Uniformes desde las 9:12): espejo idéntico, folios alineados
(84 cotizaciones, 29 devoluciones), variables de Vercel en Winston y redeploy (`uniformes-mu.vercel.app`).
Si alguna vez apareciera algo en el NANO viejo después del corte: `migrar-uniformes-a-winston.mjs --solo-faltantes`
(solo inserta lo que falte; nunca pisa filas de Winston).

Pasos usados:

1. `node --env-file=.env.local scripts/corte-uniformes-a-winston.mjs --sincronizar` → debe terminar en «ESPEJO IDÉNTICO».
2. `node --env-file=.env.local scripts/corte-uniformes-a-winston.mjs --vercel`.
3. Redeploy de producción de `uniformes`.
4. `node --env-file=.env.local scripts/migrar-uniformes-a-winston.mjs` otra vez: si algo entró a Uniformes entre el paso 1 y el 3, repetir el paso 1.
5. Prueba con Mario (login, pedido, cotización, devolución, transferencia, constancia PDF, ciclos).

## Borrar NANO Uniformes

Solo cuando Mario lo indique, tras la prueba: eliminar proyecto InsForge **Uniformes** (`q488j9fg` / id `71884820-…`).
