-- Panel de control: banco de Uniformes (Connor). Lectura de uso, integridad del stock, funciones, enlace y
-- almacenamiento del sistema de Uniformes en una sola llamada. Solo lee (catálogo, estadísticas y conteos); no toca
-- la función ni las tablas del panel de Servicios. Solo la llave admin del servidor la ejecuta.
CREATE OR REPLACE FUNCTION public.panel_uniformes_metricas()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '3s'
 SET lock_timeout TO '500ms'
AS $function$
WITH
tablas_u AS (
  SELECT unnest(ARRAY[
    'auditoria', 'categorias_prendas', 'compras_insumos', 'conjunto_precios', 'conjuntos', 'cortes',
    'costo_ubicaciones', 'costos', 'cotizaciones', 'datos_fiscales_cliente', 'detalle_cortes', 'detalle_cotizacion',
    'detalle_devoluciones', 'detalle_pedidos', 'detalle_transferencias', 'devoluciones', 'empresas', 'externos',
    'gastos_fijos_catalogo', 'gastos_fijos_semanales_detalle', 'gastos_fijos_semanales', 'insumo_ubicaciones',
    'insumos', 'movimientos', 'pedidos', 'prenda_talla_insumos', 'prendas', 'presentaciones',
    'produccion_plan_semanal_items', 'produccion_plan_semanal', 'roles_uniformes', 'sat_formas_pago',
    'sat_metodos_pago', 'semanas', 'snapshot_insumos_pedido', 'sucursales', 'tallas', 'transferencias',
    'ubicaciones_almacenamiento', 'usuario_perfil', 'usuarios_uniformes', 'usuarios'
  ]::text[]) AS nombre
),
rpc_u AS (
  SELECT unnest(ARRAY[
    'ajustar_precio_pedido_tras_devolucion', 'asegurar_un_ciclo_actual', 'cancelar_pedido_atomico',
    'completar_detalles_pedido_atomico', 'completar_detalles_pedido_por_piezas_atomico', 'completar_pedido_atomico',
    'crear_pedido_atomico', 'descontar_costo_ubicaciones_desde_menor', 'descontar_insumo_ubicaciones_desde_menor',
    'generar_folio_cotizacion', 'generar_folio_pedido', 'generate_folio_transferencia', 'obtener_tallas_ordenadas',
    'procesar_devolucion_atomica', 'reconciliar_costo_ubicaciones_desde_stock', 'refoliar_cotizaciones_existentes',
    'sumar_costo_ubicaciones_desde_menor', '_transfer_abonar_destino', '_transfer_descontar_origen',
    'transferencia_cancelar', 'transferencia_crear', 'transferencia_modificar', '_transferencia_recalcular_estado',
    'transferencia_recibir', 'transferencia_recibir_partida', 'transferencia_reenviar_complementario',
    '_transfer_reponer_origen', 'trg_auditoria_generic', 'trg_cotizacion_insumos_al_trabajar',
    'trg_pedido_desde_cotizacion_terminada', 'update_ciclo_escolar_updated_at', 'update_devoluciones_updated_at',
    'update_updated_at_column', 'validar_total_pedido'
  ]::text[]) AS nombre
),
rpc_venta AS (
  SELECT unnest(ARRAY[
    'crear_pedido_atomico', 'completar_pedido_atomico', 'cancelar_pedido_atomico',
    'procesar_devolucion_atomica', 'transferencia_crear', 'transferencia_recibir'
  ]::text[]) AS nombre
),
procs AS (
  SELECT p.oid, p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
hoy AS (
  SELECT (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City') AS desde
)
SELECT jsonb_build_object(
  'uso', jsonb_build_object(
    'pedidos_hoy', (SELECT count(*) FROM pedidos, hoy WHERE pedidos.created_at >= hoy.desde),
    'importe_hoy', (SELECT coalesce(sum(total), 0) FROM pedidos, hoy WHERE pedidos.created_at >= hoy.desde),
    'pedidos_7d', (SELECT count(*) FROM pedidos WHERE created_at > now() - interval '7 days'),
    'pendientes', (SELECT count(*) FROM pedidos WHERE estado = 'PENDIENTE'),
    'movimientos_24h', (SELECT count(*) FROM movimientos WHERE created_at > now() - interval '24 hours'),
    'devoluciones_7d', (SELECT count(*) FROM devoluciones WHERE created_at > now() - interval '7 days'),
    'cotizaciones_7d', (SELECT count(*) FROM cotizaciones WHERE created_at > now() - interval '7 days'),
    'transferencias_7d', (SELECT count(*) FROM transferencias WHERE created_at > now() - interval '7 days'),
    'operaciones_24h', (SELECT count(*) FROM auditoria WHERE "timestamp" > now() - interval '24 hours'),
    'ultima_operacion', (SELECT max("timestamp") FROM auditoria)
  ),
  'stock', jsonb_build_object(
    'negativos', (SELECT count(*) FROM costos WHERE stock < 0),
    'duplicados', (SELECT count(*) FROM (
      SELECT 1 FROM costos GROUP BY prenda_id, talla_id, sucursal_id HAVING count(*) > 1
    ) d),
    'ubicaciones_desfasadas', (SELECT count(*) FROM costos c JOIN (
      SELECT costo_id, sum(cantidad) s FROM costo_ubicaciones GROUP BY 1
    ) u ON u.costo_id = c.id WHERE u.s <> c.stock),
    'pedidos_incoherentes', (
      (SELECT count(*) FROM pedidos p WHERE p.estado = 'PENDIENTE' AND NOT EXISTS (
        SELECT 1 FROM detalle_pedidos d WHERE d.pedido_id = p.id AND coalesce(d.pendiente, 0) > 0))
      + (SELECT count(*) FROM pedidos p WHERE p.estado = 'COMPLETADO' AND EXISTS (
        SELECT 1 FROM detalle_pedidos d WHERE d.pedido_id = p.id AND coalesce(d.pendiente, 0) > 0))
      + (SELECT count(*) FROM detalle_pedidos WHERE coalesce(pendiente, 0) < 0 OR coalesce(pendiente, 0) > cantidad)
    ),
    'movimientos_24h', (SELECT count(*) FROM movimientos WHERE created_at > now() - interval '24 hours'),
    'movimientos_auditados_24h', (SELECT count(*) FROM auditoria
      WHERE tabla = 'movimientos' AND operacion = 'INSERT' AND "timestamp" > now() - interval '24 hours'),
    'transferencias_abiertas', (SELECT count(*) FROM transferencias WHERE estado NOT IN ('RECIBIDA', 'CANCELADA'))
  ),
  'funciones', jsonb_build_object(
    'esperadas', (SELECT count(*) FROM rpc_u),
    'presentes', (SELECT count(DISTINCT r.nombre) FROM rpc_u r JOIN procs p ON p.proname = r.nombre),
    'venta_esperadas', (SELECT count(*) FROM rpc_venta),
    'venta_ejecutables', (SELECT count(DISTINCT r.nombre) FROM rpc_venta r JOIN procs p ON p.proname = r.nombre
      WHERE has_function_privilege('anon', p.oid, 'EXECUTE')),
    'internas', (SELECT count(*) FROM procs WHERE proname LIKE '\_transfer%'),
    'internas_expuestas', (SELECT count(*) FROM procs WHERE proname LIKE '\_transfer%'
      AND (has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE'))),
    'tablas_auditadas', (SELECT count(DISTINCT t.tgrelid) FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE p.proname = 'trg_auditoria_generic' AND NOT t.tgisinternal)
  ),
  'enlace', jsonb_build_object(
    'tablas_esperadas', (SELECT count(*) FROM tablas_u),
    'tablas_presentes', (SELECT count(*) FROM tablas_u u JOIN pg_tables t ON t.schemaname = 'public' AND t.tablename = u.nombre),
    'ciclo_actual', (SELECT count(*) FROM ciclos_escolares WHERE es_actual),
    'alumnos', (SELECT count(*) FROM alumno),
    'bucket', EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'datos-fiscales-clientes')
  ),
  'almacenamiento', jsonb_build_object(
    'bytes_tablas', (SELECT coalesce(sum(pg_total_relation_size(('public.' || quote_ident(u.nombre))::regclass)), 0)
      FROM tablas_u u JOIN pg_tables t ON t.schemaname = 'public' AND t.tablename = u.nombre),
    'bytes_auditoria', pg_total_relation_size('public.auditoria'::regclass),
    'bytes_base', pg_database_size(current_database()),
    'auditoria_filas', (SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = 'auditoria'),
    'auditoria_7d', (SELECT count(*) FROM auditoria WHERE "timestamp" > now() - interval '7 days'),
    'bucket_archivos', (SELECT count(*) FROM storage.objects WHERE bucket = 'datos-fiscales-clientes'),
    'bucket_bytes', (SELECT coalesce(sum(size), 0) FROM storage.objects WHERE bucket = 'datos-fiscales-clientes')
  ),
  'tablas', coalesce((SELECT jsonb_object_agg(s.relname, jsonb_build_array(
      s.n_live_tup, s.n_dead_tup, s.seq_scan, coalesce(s.idx_scan, 0)
    )) FROM pg_stat_user_tables s JOIN tablas_u u ON u.nombre = s.relname
    WHERE s.schemaname = 'public'), '{}'::jsonb)
);
$function$;

REVOKE ALL ON FUNCTION public.panel_uniformes_metricas() FROM PUBLIC, anon, authenticated;
