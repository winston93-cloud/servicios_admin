-- Uniformes (InsForge q488j9fg) → Winston Servicios: FK, índices, funciones y triggers.
-- Aplicar DESPUÉS de copiar los datos. Las FK de Uniformes hacia usuario no se crean (usuario es de Winston).

ALTER TABLE public.compras_insumos ADD CONSTRAINT compras_insumos_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE;
ALTER TABLE public.conjunto_precios ADD CONSTRAINT conjunto_precios_conjunto_id_fkey FOREIGN KEY (conjunto_id) REFERENCES conjuntos(id) ON DELETE CASCADE;
ALTER TABLE public.conjunto_precios ADD CONSTRAINT conjunto_precios_talla_id_fkey FOREIGN KEY (talla_id) REFERENCES tallas(id) ON DELETE RESTRICT;
ALTER TABLE public.conjuntos ADD CONSTRAINT conjuntos_prenda_a_id_fkey FOREIGN KEY (prenda_a_id) REFERENCES prendas(id) ON DELETE RESTRICT;
ALTER TABLE public.conjuntos ADD CONSTRAINT conjuntos_prenda_b_id_fkey FOREIGN KEY (prenda_b_id) REFERENCES prendas(id) ON DELETE RESTRICT;
ALTER TABLE public.cortes ADD CONSTRAINT cortes_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);
ALTER TABLE public.cortes ADD CONSTRAINT cortes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.costo_ubicaciones ADD CONSTRAINT costo_ubicaciones_costo_id_fkey FOREIGN KEY (costo_id) REFERENCES costos(id) ON DELETE CASCADE;
ALTER TABLE public.costo_ubicaciones ADD CONSTRAINT costo_ubicaciones_ubicacion_almacenamiento_id_fkey FOREIGN KEY (ubicacion_almacenamiento_id) REFERENCES ubicaciones_almacenamiento(id) ON DELETE RESTRICT;
ALTER TABLE public.costos ADD CONSTRAINT costos_prenda_id_fkey FOREIGN KEY (prenda_id) REFERENCES prendas(id) ON DELETE CASCADE;
ALTER TABLE public.costos ADD CONSTRAINT costos_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);
ALTER TABLE public.costos ADD CONSTRAINT costos_talla_id_fkey FOREIGN KEY (talla_id) REFERENCES tallas(id) ON DELETE CASCADE;
ALTER TABLE public.costos ADD CONSTRAINT costos_ubicacion_almacenamiento_id_fkey FOREIGN KEY (ubicacion_almacenamiento_id) REFERENCES ubicaciones_almacenamiento(id) ON DELETE SET NULL;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_externo_id_fkey FOREIGN KEY (externo_id) REFERENCES externos(id) ON DELETE SET NULL;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_forma_pago_id_fkey FOREIGN KEY (forma_pago_id) REFERENCES sat_formas_pago(id) ON DELETE SET NULL;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_metodo_pago_id_fkey FOREIGN KEY (metodo_pago_id) REFERENCES sat_metodos_pago(id) ON DELETE SET NULL;
ALTER TABLE public.datos_fiscales_cliente ADD CONSTRAINT datos_fiscales_cliente_externo_id_fkey FOREIGN KEY (externo_id) REFERENCES externos(id) ON DELETE CASCADE;
ALTER TABLE public.detalle_cortes ADD CONSTRAINT detalle_cortes_corte_id_fkey FOREIGN KEY (corte_id) REFERENCES cortes(id) ON DELETE CASCADE;
ALTER TABLE public.detalle_cortes ADD CONSTRAINT detalle_cortes_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT;
ALTER TABLE public.detalle_cotizacion ADD CONSTRAINT detalle_cotizacion_costo_id_fkey FOREIGN KEY (costo_id) REFERENCES costos(id) ON DELETE SET NULL;
ALTER TABLE public.detalle_cotizacion ADD CONSTRAINT detalle_cotizacion_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE;
ALTER TABLE public.detalle_cotizacion ADD CONSTRAINT detalle_cotizacion_prenda_id_fkey FOREIGN KEY (prenda_id) REFERENCES prendas(id) ON DELETE SET NULL;
ALTER TABLE public.detalle_devoluciones ADD CONSTRAINT detalle_devoluciones_detalle_pedido_id_fkey FOREIGN KEY (detalle_pedido_id) REFERENCES detalle_pedidos(id);
ALTER TABLE public.detalle_devoluciones ADD CONSTRAINT detalle_devoluciones_devolucion_id_fkey FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id) ON DELETE CASCADE;
ALTER TABLE public.detalle_devoluciones ADD CONSTRAINT detalle_devoluciones_prenda_cambio_id_fkey FOREIGN KEY (prenda_cambio_id) REFERENCES prendas(id);
ALTER TABLE public.detalle_devoluciones ADD CONSTRAINT detalle_devoluciones_prenda_id_fkey FOREIGN KEY (prenda_id) REFERENCES prendas(id);
ALTER TABLE public.detalle_devoluciones ADD CONSTRAINT detalle_devoluciones_talla_cambio_id_fkey FOREIGN KEY (talla_cambio_id) REFERENCES tallas(id);
ALTER TABLE public.detalle_devoluciones ADD CONSTRAINT detalle_devoluciones_talla_id_fkey FOREIGN KEY (talla_id) REFERENCES tallas(id);
ALTER TABLE public.detalle_pedidos ADD CONSTRAINT detalle_pedidos_costo_id_fkey FOREIGN KEY (costo_id) REFERENCES costos(id) ON DELETE RESTRICT;
ALTER TABLE public.detalle_pedidos ADD CONSTRAINT detalle_pedidos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
ALTER TABLE public.detalle_pedidos ADD CONSTRAINT detalle_pedidos_prenda_id_fkey FOREIGN KEY (prenda_id) REFERENCES prendas(id) ON DELETE RESTRICT;
ALTER TABLE public.detalle_pedidos ADD CONSTRAINT detalle_pedidos_talla_id_fkey FOREIGN KEY (talla_id) REFERENCES tallas(id) ON DELETE RESTRICT;
ALTER TABLE public.detalle_transferencias ADD CONSTRAINT detalle_transferencias_costo_id_fkey FOREIGN KEY (costo_id) REFERENCES costos(id);
ALTER TABLE public.detalle_transferencias ADD CONSTRAINT detalle_transferencias_prenda_id_fkey FOREIGN KEY (prenda_id) REFERENCES prendas(id);
ALTER TABLE public.detalle_transferencias ADD CONSTRAINT detalle_transferencias_talla_id_fkey FOREIGN KEY (talla_id) REFERENCES tallas(id);
ALTER TABLE public.detalle_transferencias ADD CONSTRAINT detalle_transferencias_transferencia_id_fkey FOREIGN KEY (transferencia_id) REFERENCES transferencias(id) ON DELETE CASCADE;
ALTER TABLE public.devoluciones ADD CONSTRAINT devoluciones_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
ALTER TABLE public.devoluciones ADD CONSTRAINT devoluciones_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);
ALTER TABLE public.gastos_fijos_semanales ADD CONSTRAINT gastos_fijos_semanales_semana_id_fkey FOREIGN KEY (semana_id) REFERENCES semanas(id) ON DELETE CASCADE;
ALTER TABLE public.gastos_fijos_semanales_detalle ADD CONSTRAINT gastos_fijos_semanales_detalle_gasto_fijo_catalogo_id_fkey FOREIGN KEY (gasto_fijo_catalogo_id) REFERENCES gastos_fijos_catalogo(id) ON DELETE RESTRICT;
ALTER TABLE public.gastos_fijos_semanales_detalle ADD CONSTRAINT gastos_fijos_semanales_detalle_gastos_fijos_semanales_id_fkey FOREIGN KEY (gastos_fijos_semanales_id) REFERENCES gastos_fijos_semanales(id) ON DELETE CASCADE;
ALTER TABLE public.insumo_ubicaciones ADD CONSTRAINT insumo_ubicaciones_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE;
ALTER TABLE public.insumo_ubicaciones ADD CONSTRAINT insumo_ubicaciones_ubicacion_almacenamiento_id_fkey FOREIGN KEY (ubicacion_almacenamiento_id) REFERENCES ubicaciones_almacenamiento(id) ON DELETE RESTRICT;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_presentacion_id_fkey FOREIGN KEY (presentacion_id) REFERENCES presentaciones(id) ON DELETE RESTRICT;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_ubicacion_almacenamiento_id_fkey FOREIGN KEY (ubicacion_almacenamiento_id) REFERENCES ubicaciones_almacenamiento(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos ADD CONSTRAINT movimientos_costo_id_fkey FOREIGN KEY (costo_id) REFERENCES costos(id) ON DELETE RESTRICT;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE SET NULL;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_externo_id_fkey FOREIGN KEY (externo_id) REFERENCES externos(id) ON DELETE SET NULL;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE RESTRICT;
ALTER TABLE public.prenda_talla_insumos ADD CONSTRAINT prenda_talla_insumos_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE;
ALTER TABLE public.prenda_talla_insumos ADD CONSTRAINT prenda_talla_insumos_prenda_id_fkey FOREIGN KEY (prenda_id) REFERENCES prendas(id) ON DELETE CASCADE;
ALTER TABLE public.prenda_talla_insumos ADD CONSTRAINT prenda_talla_insumos_talla_id_fkey FOREIGN KEY (talla_id) REFERENCES tallas(id) ON DELETE CASCADE;
ALTER TABLE public.prendas ADD CONSTRAINT prendas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias_prendas(id) ON DELETE SET NULL;
ALTER TABLE public.prendas ADD CONSTRAINT prendas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE public.produccion_plan_semanal ADD CONSTRAINT produccion_plan_semanal_semana_id_fkey FOREIGN KEY (semana_id) REFERENCES semanas(id) ON DELETE CASCADE;
ALTER TABLE public.produccion_plan_semanal_items ADD CONSTRAINT produccion_plan_semanal_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES produccion_plan_semanal(id) ON DELETE CASCADE;
ALTER TABLE public.snapshot_insumos_pedido ADD CONSTRAINT snapshot_insumos_pedido_detalle_pedido_id_fkey FOREIGN KEY (detalle_pedido_id) REFERENCES detalle_pedidos(id) ON DELETE CASCADE;
ALTER TABLE public.transferencias ADD CONSTRAINT transferencias_sucursal_destino_id_fkey FOREIGN KEY (sucursal_destino_id) REFERENCES sucursales(id);
ALTER TABLE public.transferencias ADD CONSTRAINT transferencias_sucursal_origen_id_fkey FOREIGN KEY (sucursal_origen_id) REFERENCES sucursales(id);
ALTER TABLE public.usuarios_uniformes ADD CONSTRAINT usuarios_uniformes_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES roles_uniformes(id) ON DELETE RESTRICT;
ALTER TABLE public.usuarios_uniformes ADD CONSTRAINT usuarios_uniformes_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE SET NULL;

CREATE INDEX idx_auditoria_tabla ON public.auditoria USING btree (tabla);
CREATE INDEX idx_auditoria_timestamp ON public.auditoria USING btree ("timestamp" DESC);
CREATE INDEX idx_auditoria_usuario ON public.auditoria USING btree (usuario_id);
CREATE INDEX conjunto_precios_conjunto_idx ON public.conjunto_precios USING btree (conjunto_id);
CREATE INDEX conjuntos_activo_idx ON public.conjuntos USING btree (activo);
CREATE UNIQUE INDEX conjuntos_codigo_uidx ON public.conjuntos USING btree (codigo) WHERE ((codigo IS NOT NULL) AND ((codigo)::text <> ''::text));
CREATE INDEX idx_cortes_fecha ON public.cortes USING btree (fecha DESC);
CREATE INDEX idx_cortes_sucursal ON public.cortes USING btree (sucursal_id);
CREATE INDEX idx_costos_prenda ON public.costos USING btree (prenda_id);
CREATE INDEX idx_costos_sucursal ON public.costos USING btree (sucursal_id);
CREATE INDEX idx_costos_talla ON public.costos USING btree (talla_id);
CREATE INDEX idx_cotizaciones_alumno ON public.cotizaciones USING btree (alumno_id);
CREATE INDEX idx_cotizaciones_estado ON public.cotizaciones USING btree (estado);
CREATE INDEX idx_cotizaciones_externo ON public.cotizaciones USING btree (externo_id);
CREATE INDEX idx_cotizaciones_fecha ON public.cotizaciones USING btree (fecha_cotizacion);
CREATE INDEX idx_cotizaciones_folio ON public.cotizaciones USING btree (folio);
CREATE INDEX idx_cotizaciones_forma_pago ON public.cotizaciones USING btree (forma_pago_id);
CREATE INDEX idx_cotizaciones_metodo_pago ON public.cotizaciones USING btree (metodo_pago_id);
CREATE UNIQUE INDEX idx_datos_fiscales_alumno ON public.datos_fiscales_cliente USING btree (alumno_id) WHERE (alumno_id IS NOT NULL);
CREATE UNIQUE INDEX idx_datos_fiscales_externo ON public.datos_fiscales_cliente USING btree (externo_id) WHERE (externo_id IS NOT NULL);
CREATE INDEX idx_detalle_cortes_corte ON public.detalle_cortes USING btree (corte_id);
CREATE INDEX idx_detalle_cortes_pedido ON public.detalle_cortes USING btree (pedido_id);
CREATE INDEX idx_detalle_costo_id ON public.detalle_cotizacion USING btree (costo_id);
CREATE INDEX idx_detalle_cotizacion_cotizacion ON public.detalle_cotizacion USING btree (cotizacion_id);
CREATE INDEX idx_detalle_prenda_id ON public.detalle_cotizacion USING btree (prenda_id);
CREATE INDEX idx_detalle_tipo_precio ON public.detalle_cotizacion USING btree (tipo_precio_usado);
CREATE INDEX idx_detalle_devoluciones_devolucion_id ON public.detalle_devoluciones USING btree (devolucion_id);
CREATE INDEX idx_detalle_pedidos_pedido ON public.detalle_pedidos USING btree (pedido_id);
CREATE INDEX idx_detalle_pedidos_prenda ON public.detalle_pedidos USING btree (prenda_id);
CREATE INDEX idx_detalle_pedidos_talla ON public.detalle_pedidos USING btree (talla_id);
CREATE INDEX idx_detalle_transferencias_trans ON public.detalle_transferencias USING btree (transferencia_id);
CREATE INDEX idx_devoluciones_created_at ON public.devoluciones USING btree (created_at);
CREATE INDEX idx_devoluciones_pedido_id ON public.devoluciones USING btree (pedido_id);
CREATE INDEX idx_devoluciones_sucursal_id ON public.devoluciones USING btree (sucursal_id);
CREATE INDEX idx_devoluciones_usuario_id ON public.devoluciones USING btree (usuario_id);
CREATE INDEX empresas_activo_idx ON public.empresas USING btree (activo);
CREATE INDEX empresas_nombre_idx ON public.empresas USING btree (nombre);
CREATE INDEX idx_externos_activo ON public.externos USING btree (activo) WHERE (activo = true);
CREATE INDEX idx_insumos_presentacion_id ON public.insumos USING btree (presentacion_id);
CREATE INDEX idx_movimientos_costo ON public.movimientos USING btree (costo_id);
CREATE INDEX idx_movimientos_tipo ON public.movimientos USING btree (tipo);
CREATE INDEX idx_pedidos_alumno ON public.pedidos USING btree (alumno_id);
CREATE INDEX idx_pedidos_estado ON public.pedidos USING btree (estado);
CREATE INDEX idx_pedidos_externo ON public.pedidos USING btree (externo_id);
CREATE INDEX idx_pedidos_sucursal ON public.pedidos USING btree (sucursal_id);
CREATE UNIQUE INDEX idx_pedidos_cotizacion_id_unique ON public.pedidos USING btree (cotizacion_id) WHERE (cotizacion_id IS NOT NULL);
CREATE UNIQUE INDEX idx_pedidos_folio_unique ON public.pedidos USING btree (folio) WHERE (folio IS NOT NULL);
CREATE INDEX idx_prenda_talla_insumos_prenda ON public.prenda_talla_insumos USING btree (prenda_id);
CREATE INDEX prendas_empresa_id_idx ON public.prendas USING btree (empresa_id);
CREATE INDEX idx_snapshot_detalle ON public.snapshot_insumos_pedido USING btree (detalle_pedido_id);
CREATE INDEX idx_transferencias_destino ON public.transferencias USING btree (sucursal_destino_id);
CREATE INDEX idx_transferencias_estado ON public.transferencias USING btree (estado);
CREATE INDEX idx_transferencias_fecha ON public.transferencias USING btree (fecha_transferencia DESC);
CREATE INDEX idx_transferencias_origen ON public.transferencias USING btree (sucursal_origen_id);
CREATE UNIQUE INDEX transferencias_client_token_key ON public.transferencias USING btree (client_token) WHERE (client_token IS NOT NULL);
CREATE INDEX idx_usuarios_uniformes_estado ON public.usuarios_uniformes USING btree (estado);
CREATE INDEX idx_usuarios_uniformes_rol ON public.usuarios_uniformes USING btree (rol_id);
CREATE INDEX idx_usuarios_uniformes_sucursal ON public.usuarios_uniformes USING btree (sucursal_id);
CREATE INDEX idx_usuarios_uniformes_usuario ON public.usuarios_uniformes USING btree (usuario);

CREATE OR REPLACE FUNCTION public._transfer_abonar_destino(p_costo_origen_id uuid, p_sucursal_destino_id uuid, p_cantidad integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o RECORD;
  v_destino_id UUID;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida para recibir.';
  END IF;

  SELECT * INTO o FROM costos WHERE id = p_costo_origen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo de origen no encontrado.';
  END IF;

  INSERT INTO costos (
    prenda_id, talla_id, sucursal_id,
    precio_venta, precio_compra, precio_mayoreo, precio_menudeo,
    stock_inicial, stock, stock_minimo, cantidad_venta, activo
  )
  VALUES (
    o.prenda_id, o.talla_id, p_sucursal_destino_id,
    COALESCE(o.precio_venta, 0), COALESCE(o.precio_compra, 0),
    COALESCE(o.precio_mayoreo, 0), COALESCE(o.precio_menudeo, 0),
    p_cantidad, p_cantidad, COALESCE(o.stock_minimo, 0), COALESCE(o.cantidad_venta, 0), TRUE
  )
  ON CONFLICT (prenda_id, talla_id, sucursal_id) DO UPDATE
    SET stock = costos.stock + EXCLUDED.stock,
        stock_inicial = costos.stock + EXCLUDED.stock
  RETURNING id INTO v_destino_id;

  PERFORM sumar_costo_ubicaciones_desde_menor(v_destino_id, p_cantidad);
  RETURN v_destino_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public._transfer_descontar_origen(p_costo_id uuid, p_cantidad integer, p_sucursal_origen_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sucursal UUID;
  v_stock INTEGER;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida para transferir.';
  END IF;

  SELECT sucursal_id, stock INTO v_sucursal, v_stock
  FROM costos WHERE id = p_costo_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo de origen no encontrado.';
  END IF;
  IF v_sucursal IS DISTINCT FROM p_sucursal_origen_id THEN
    RAISE EXCEPTION 'El costo no pertenece a la sucursal origen.';
  END IF;
  IF COALESCE(v_stock, 0) < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente: hay %, se pidieron %.', COALESCE(v_stock, 0), p_cantidad;
  END IF;

  UPDATE costos
  SET stock = stock - p_cantidad,
      stock_inicial = stock - p_cantidad
  WHERE id = p_costo_id;

  PERFORM descontar_costo_ubicaciones_desde_menor(p_costo_id, p_cantidad);
END;
$function$;

CREATE OR REPLACE FUNCTION public._transfer_reponer_origen(p_costo_id uuid, p_cantidad integer, p_sucursal_origen_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sucursal UUID;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  SELECT sucursal_id INTO v_sucursal FROM costos WHERE id = p_costo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costo de origen no encontrado.';
  END IF;
  IF v_sucursal IS DISTINCT FROM p_sucursal_origen_id THEN
    RAISE EXCEPTION 'El costo no pertenece a la sucursal origen.';
  END IF;

  UPDATE costos
  SET stock = stock + p_cantidad,
      stock_inicial = stock + p_cantidad
  WHERE id = p_costo_id;

  PERFORM sumar_costo_ubicaciones_desde_menor(p_costo_id, p_cantidad);
END;
$function$;

CREATE OR REPLACE FUNCTION public._transferencia_recalcular_estado(p_transferencia_id uuid)
 RETURNS character varying
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER;
  v_recibidas INTEGER;
  v_transito INTEGER;
  v_compl INTEGER;
  v_estado VARCHAR := 'EN_TRANSITO';
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE UPPER(COALESCE(estado, 'EN_TRANSITO')) = 'RECIBIDA'),
    COUNT(*) FILTER (WHERE UPPER(COALESCE(estado, 'EN_TRANSITO')) IN ('EN_TRANSITO', 'PENDIENTE')),
    COUNT(*) FILTER (WHERE UPPER(COALESCE(estado, 'EN_TRANSITO')) = 'EN_TRANSITO_COMPLEMENTARIO')
  INTO v_total, v_recibidas, v_transito, v_compl
  FROM detalle_transferencias
  WHERE transferencia_id = p_transferencia_id;

  IF v_total > 0 AND v_recibidas = v_total THEN
    v_estado := 'RECIBIDA';
  ELSIF v_transito > 0 THEN
    v_estado := 'EN_TRANSITO';
  ELSIF v_compl > 0 THEN
    v_estado := 'RECIBIDA_PARCIAL';
  END IF;

  UPDATE transferencias SET estado = v_estado WHERE id = p_transferencia_id;
  RETURN v_estado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ajustar_precio_pedido_tras_devolucion(p_devolucion_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE v_dev RECORD; v_det RECORD; v_det_pedido RECORD; v_nuevo_precio DECIMAL(10,2); v_nuevo_total DECIMAL(10,2); v_nueva_cantidad INTEGER; v_dev_qty INTEGER; v_max_entregado INTEGER; BEGIN SELECT id, pedido_id, estado INTO v_dev FROM devoluciones WHERE id = p_devolucion_id; IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Devolución no encontrada'); END IF; FOR v_det IN SELECT * FROM detalle_devoluciones WHERE devolucion_id = p_devolucion_id LOOP SELECT * INTO v_det_pedido FROM detalle_pedidos WHERE id = v_det.detalle_pedido_id; IF NOT FOUND THEN CONTINUE; END IF; IF v_det.es_cambio AND v_det.prenda_cambio_id IS NOT NULL AND v_det.talla_cambio_id IS NOT NULL THEN SELECT COALESCE(v_det.precio_cambio, c.precio_menudeo, c.precio_venta, v_det_pedido.precio_unitario) INTO v_nuevo_precio FROM costos c WHERE c.prenda_id = v_det.prenda_cambio_id AND c.talla_id = v_det.talla_cambio_id AND c.sucursal_id = (SELECT sucursal_id FROM devoluciones WHERE id = p_devolucion_id); UPDATE detalle_pedidos SET precio_unitario = v_nuevo_precio, subtotal = cantidad * v_nuevo_precio, costo_id = (SELECT id FROM costos WHERE prenda_id = v_det.prenda_cambio_id AND talla_id = v_det.talla_cambio_id AND sucursal_id = (SELECT sucursal_id FROM devoluciones WHERE id = p_devolucion_id) LIMIT 1) WHERE id = v_det_pedido.id; ELSE v_max_entregado := GREATEST(v_det_pedido.cantidad - COALESCE(v_det_pedido.pendiente, 0), 0); v_dev_qty := LEAST(v_det.cantidad_devuelta, v_max_entregado); v_nueva_cantidad := v_det_pedido.cantidad - v_dev_qty; IF v_nueva_cantidad <= 0 THEN DELETE FROM detalle_pedidos WHERE id = v_det_pedido.id; ELSE UPDATE detalle_pedidos SET cantidad = v_nueva_cantidad, pendiente = GREATEST(COALESCE(pendiente, 0) - LEAST(v_dev_qty, COALESCE(pendiente, 0)), 0), subtotal = v_nueva_cantidad * precio_unitario WHERE id = v_det_pedido.id; END IF; END IF; END LOOP; SELECT COALESCE(SUM(subtotal), 0) INTO v_nuevo_total FROM detalle_pedidos WHERE pedido_id = v_dev.pedido_id; IF NOT EXISTS (SELECT 1 FROM detalle_pedidos WHERE pedido_id = v_dev.pedido_id) THEN UPDATE pedidos SET estado = 'CANCELADO', updated_at = NOW() WHERE id = v_dev.pedido_id; ELSIF v_nuevo_total > 0 THEN UPDATE pedidos SET subtotal = v_nuevo_total, total = v_nuevo_total, updated_at = NOW() WHERE id = v_dev.pedido_id; END IF; RETURN json_build_object('success', true); END; $function$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido_atomico(p_pedido_id uuid, p_usuario_id uuid DEFAULT NULL::uuid, p_items jsonb DEFAULT NULL::jsonb, p_motivo text DEFAULT NULL::text, p_sucursal_stock_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_suc_stock UUID;
  v_pedido RECORD;
  v_item JSONB;
  v_det RECORD;
  v_qty_cancel INTEGER;
  v_cancel_from_pending INTEGER;
  v_cancel_from_delivered INTEGER;
  v_costo_id UUID;
  v_restantes INTEGER;
BEGIN
  SELECT id, folio, estado, sucursal_id, linea_venta
  INTO v_pedido
  FROM pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Stock desde otra sucursal (p. ej. Uniformes atendiendo un pedido de Winston):
  -- solo pedidos de la línea prendas; tenis / remate tenis nunca salen de su sucursal.
  v_suc_stock := COALESCE(p_sucursal_stock_id, v_pedido.sucursal_id);
  IF p_sucursal_stock_id IS NOT NULL
     AND p_sucursal_stock_id IS DISTINCT FROM v_pedido.sucursal_id
     AND COALESCE(v_pedido.linea_venta, '') <> 'prendas' THEN
    RAISE EXCEPTION 'Solo los pedidos de prendas se pueden atender con stock de otra sucursal.';
  END IF;

  IF v_pedido.estado IN ('CANCELADO') THEN
    RETURN json_build_object('success', false, 'error', 'El pedido ya está CANCELADO.');
  END IF;

  -- Si no vienen items, cancelar todo lo que exista
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    p_items := (
      SELECT jsonb_agg(
        jsonb_build_object(
          'detalle_pedido_id', id,
          'cantidad_cancelar', cantidad
        )
      )
      FROM detalle_pedidos
      WHERE pedido_id = p_pedido_id
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT *
    INTO v_det
    FROM detalle_pedidos
    WHERE id = (v_item->>'detalle_pedido_id')::UUID
      AND pedido_id = p_pedido_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Detalle del pedido no encontrado para cancelar';
    END IF;

    v_qty_cancel := GREATEST(COALESCE((v_item->>'cantidad_cancelar')::INTEGER, 0), 0);
    IF v_qty_cancel <= 0 OR v_qty_cancel > v_det.cantidad THEN
      RAISE EXCEPTION 'Cantidad a cancelar inválida para el detalle %', v_det.id;
    END IF;

    -- Primero se cancela de lo pendiente (no toca stock porque aún no se descontó)
    v_cancel_from_pending := LEAST(v_det.pendiente, v_qty_cancel);
    v_cancel_from_delivered := v_qty_cancel - v_cancel_from_pending;

    -- Si se cancela algo ya entregado/descontado, reponer stock (ENTRADA)
    IF v_cancel_from_delivered > 0 THEN
      SELECT c.id
      INTO v_costo_id
      FROM costos c
      WHERE c.prenda_id = v_det.prenda_id
        AND c.talla_id = v_det.talla_id
        AND c.sucursal_id = v_suc_stock;

      IF v_costo_id IS NULL THEN
        RAISE EXCEPTION 'No existe costo para reponer stock (prenda %, talla %)', v_det.prenda_id, v_det.talla_id;
      END IF;

      UPDATE costos
      SET stock = stock + v_cancel_from_delivered
      WHERE id = v_costo_id;

      PERFORM sumar_costo_ubicaciones_desde_menor(v_costo_id, v_cancel_from_delivered);

      INSERT INTO movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
      VALUES (
        'ENTRADA',
        v_costo_id,
        v_cancel_from_delivered,
        'CANCELACION - Pedido ' || COALESCE(v_pedido.folio, v_pedido.id::TEXT) || COALESCE(' - ' || p_motivo, ''),
        p_usuario_id
      );
    END IF;

    -- Ajustar detalle: reducir cantidad total y pendiente
    IF v_qty_cancel = v_det.cantidad THEN
      DELETE FROM detalle_pedidos WHERE id = v_det.id;
    ELSE
      UPDATE detalle_pedidos
      SET cantidad = cantidad - v_qty_cancel,
          pendiente = GREATEST(pendiente - v_cancel_from_pending, 0),
          subtotal = (cantidad - v_qty_cancel) * precio_unitario
      WHERE id = v_det.id;
    END IF;
  END LOOP;

  -- Recalcular totales del pedido desde detalle_pedidos
  UPDATE pedidos p
  SET subtotal = COALESCE(s.sum_subtotal, 0),
      total = COALESCE(s.sum_subtotal, 0),
      updated_at = NOW()
  FROM (
    SELECT pedido_id, COALESCE(SUM(subtotal), 0) AS sum_subtotal
    FROM detalle_pedidos
    WHERE pedido_id = p_pedido_id
    GROUP BY pedido_id
  ) s
  WHERE p.id = p_pedido_id;

  SELECT COUNT(*)::INTEGER INTO v_restantes
  FROM detalle_pedidos
  WHERE pedido_id = p_pedido_id;

  IF v_restantes = 0 THEN
    UPDATE pedidos SET estado = 'CANCELADO', updated_at = NOW() WHERE id = p_pedido_id;
    RETURN json_build_object('success', true, 'message', 'Pedido cancelado totalmente.');
  ELSE
    UPDATE pedidos SET estado = 'CANCELADO_PARCIAL', updated_at = NOW() WHERE id = p_pedido_id;
    RETURN json_build_object('success', true, 'message', 'Pedido cancelado parcialmente.');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.completar_detalles_pedido_atomico(p_pedido_id uuid, p_detalle_ids uuid[], p_usuario_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido RECORD;
  v_det RECORD;
  v_costo_id UUID;
  v_qty INTEGER;
  v_stock INTEGER;
  v_descontar INTEGER;
  v_pendientes_restantes INTEGER;
  v_prenda_nombre TEXT;
  v_talla_nombre TEXT;
  v_warnings JSONB := '[]'::JSONB;
  v_completados INTEGER := 0;
  v_estado_final TEXT;
BEGIN
  IF p_detalle_ids IS NULL OR array_length(p_detalle_ids, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Selecciona al menos una partida a completar.');
  END IF;

  SELECT id, folio, estado, sucursal_id
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF v_pedido.estado <> 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'Solo se puede completar un pedido en PENDIENTE.');
  END IF;

  FOR v_det IN
    SELECT id, prenda_id, talla_id, pendiente
    FROM public.detalle_pedidos
    WHERE pedido_id = p_pedido_id
      AND id = ANY (p_detalle_ids)
      AND COALESCE(pendiente, 0) > 0
      AND prenda_id IS NOT NULL
  LOOP
    v_qty := v_det.pendiente;

    SELECT p.nombre, t.nombre
    INTO v_prenda_nombre, v_talla_nombre
    FROM public.prendas p
    LEFT JOIN public.tallas t ON t.id = v_det.talla_id
    WHERE p.id = v_det.prenda_id;

    SELECT c.id, c.stock
    INTO v_costo_id, v_stock
    FROM public.costos c
    WHERE c.prenda_id = v_det.prenda_id
      AND c.talla_id = v_det.talla_id
      AND COALESCE(c.activo, true) = true
      AND (
        v_pedido.sucursal_id IS NULL
        OR c.sucursal_id = v_pedido.sucursal_id
      )
    ORDER BY
      CASE WHEN v_pedido.sucursal_id IS NOT NULL AND c.sucursal_id = v_pedido.sucursal_id THEN 0 ELSE 1 END,
      c.created_at NULLS LAST
    LIMIT 1;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe costo activo para % / % en la sucursal del pedido',
        COALESCE(v_prenda_nombre, v_det.prenda_id::TEXT),
        COALESCE(v_talla_nombre, v_det.talla_id::TEXT);
    END IF;

    v_stock := COALESCE(v_stock, 0);
    v_descontar := LEAST(v_qty, GREATEST(v_stock, 0));

    IF v_descontar > 0 THEN
      UPDATE public.costos
      SET stock = stock - v_descontar
      WHERE id = v_costo_id
        AND stock >= v_descontar;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para completar: % / % (requiere %, disponible %)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_descontar,
          v_stock;
      END IF;

      PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_descontar);

      INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
      VALUES (
        'SALIDA',
        v_costo_id,
        -v_descontar,
        'ENTREGA_PENDIENTE - Pedido ' || COALESCE(v_pedido.folio, v_pedido.id::TEXT),
        NULL
      );
    END IF;

    IF v_descontar < v_qty THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          '%s / %s: entregado sin descontar inventario (pendiente %s, stock %s)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_qty,
          v_stock
        )
      );
    END IF;

    UPDATE public.detalle_pedidos
    SET pendiente = 0
    WHERE id = v_det.id;

    v_completados := v_completados + 1;
  END LOOP;

  IF v_completados = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ninguna de las partidas seleccionadas tiene pendientes por entregar.'
    );
  END IF;

  SELECT COALESCE(SUM(pendiente), 0)::INTEGER
  INTO v_pendientes_restantes
  FROM public.detalle_pedidos
  WHERE pedido_id = p_pedido_id
    AND prenda_id IS NOT NULL;

  IF v_pendientes_restantes <= 0 THEN
    UPDATE public.pedidos
    SET estado = 'COMPLETADO', updated_at = NOW()
    WHERE id = p_pedido_id;
    v_estado_final := 'COMPLETADO';
  ELSE
    UPDATE public.pedidos
    SET updated_at = NOW()
    WHERE id = p_pedido_id;
    v_estado_final := 'PENDIENTE';
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', CASE
      WHEN v_estado_final = 'COMPLETADO' THEN 'Pedido completado: ya no quedan pendientes.'
      ELSE format('Se completaron %s partida(s). El pedido sigue PENDIENTE.', v_completados)
    END,
    'estado', v_estado_final,
    'completados', v_completados,
    'pendientes_restantes', v_pendientes_restantes,
    'warnings', v_warnings
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.completar_detalles_pedido_por_piezas_atomico(p_pedido_id uuid, p_items jsonb, p_usuario_id uuid DEFAULT NULL::uuid, p_sucursal_stock_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_suc_stock UUID;
  v_pedido RECORD;
  v_item RECORD;
  v_det RECORD;
  v_costo_id UUID;
  v_solicitado INTEGER;
  v_entregar INTEGER;
  v_stock INTEGER;
  v_pendientes_restantes INTEGER;
  v_prenda_nombre TEXT;
  v_talla_nombre TEXT;
  v_warnings JSONB := '[]'::JSONB;
  v_omitidas JSONB := '[]'::JSONB;
  v_partidas INTEGER := 0;
  v_piezas INTEGER := 0;
  v_estado_final TEXT;
  v_items JSONB;
BEGIN
  v_items := p_items;
  IF v_items IS NOT NULL AND jsonb_typeof(v_items) = 'string' THEN
    BEGIN
      v_items := (v_items #>> '{}')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_items := p_items;
    END;
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Selecciona al menos una partida a completar.');
  END IF;

  SELECT id, folio, estado, sucursal_id, linea_venta
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Stock desde otra sucursal (p. ej. Uniformes atendiendo un pedido de Winston):
  -- solo pedidos de la línea prendas; tenis / remate tenis nunca salen de su sucursal.
  v_suc_stock := COALESCE(p_sucursal_stock_id, v_pedido.sucursal_id);
  IF p_sucursal_stock_id IS NOT NULL
     AND p_sucursal_stock_id IS DISTINCT FROM v_pedido.sucursal_id
     AND COALESCE(v_pedido.linea_venta, '') <> 'prendas' THEN
    RAISE EXCEPTION 'Solo los pedidos de prendas se pueden atender con stock de otra sucursal.';
  END IF;

  IF v_pedido.estado <> 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'Solo se puede completar un pedido en PENDIENTE.');
  END IF;

  FOR v_item IN
    SELECT
      (elem->>'id')::UUID AS detalle_id,
      GREATEST(COALESCE((elem->>'cantidad')::INTEGER, 0), 0) AS cantidad
    FROM jsonb_array_elements(v_items) AS elem
  LOOP
    IF v_item.cantidad <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, prenda_id, talla_id, pendiente
    INTO v_det
    FROM public.detalle_pedidos
    WHERE id = v_item.detalle_id
      AND pedido_id = p_pedido_id
      AND COALESCE(pendiente, 0) > 0
      AND prenda_id IS NOT NULL;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT p.nombre, t.nombre
    INTO v_prenda_nombre, v_talla_nombre
    FROM public.prendas p
    LEFT JOIN public.tallas t ON t.id = v_det.talla_id
    WHERE p.id = v_det.prenda_id;

    SELECT c.id, c.stock
    INTO v_costo_id, v_stock
    FROM public.costos c
    WHERE c.prenda_id = v_det.prenda_id
      AND c.talla_id = v_det.talla_id
      AND COALESCE(c.activo, true) = true
      AND (
        v_suc_stock IS NULL
        OR c.sucursal_id = v_suc_stock
      )
    ORDER BY
      CASE WHEN v_suc_stock IS NOT NULL AND c.sucursal_id = v_suc_stock THEN 0 ELSE 1 END,
      c.created_at NULLS LAST
    LIMIT 1;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe costo activo para % / % en la sucursal del pedido',
        COALESCE(v_prenda_nombre, v_det.prenda_id::TEXT),
        COALESCE(v_talla_nombre, v_det.talla_id::TEXT);
    END IF;

    v_stock := COALESCE(v_stock, 0);
    -- Tope estricto: no entregar más de lo que hay en stock
    v_solicitado := v_item.cantidad;
    v_entregar := LEAST(v_solicitado, v_det.pendiente, GREATEST(v_stock, 0));

    IF v_entregar <= 0 THEN
      v_omitidas := v_omitidas || jsonb_build_array(
        format(
          '%s / %s: sin stock (solicitó %s, pendiente %s, stock %s)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_solicitado,
          v_det.pendiente,
          v_stock
        )
      );
      CONTINUE;
    END IF;

    IF v_entregar < v_solicitado THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          '%s / %s: solo se entregaron %s de %s (stock disponible %s)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_entregar,
          v_solicitado,
          v_stock
        )
      );
    END IF;

    UPDATE public.costos
    SET stock = stock - v_entregar
    WHERE id = v_costo_id
      AND stock >= v_entregar;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para completar: % / % (requiere %, disponible %)',
        COALESCE(v_prenda_nombre, '?'),
        COALESCE(v_talla_nombre, '?'),
        v_entregar,
        v_stock;
    END IF;

    PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_entregar);

    INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
    VALUES (
      'SALIDA',
      v_costo_id,
      -v_entregar,
      'ENTREGA_PENDIENTE - Pedido ' || COALESCE(v_pedido.folio, v_pedido.id::TEXT),
      NULL
    );

    UPDATE public.detalle_pedidos
    SET pendiente = GREATEST(COALESCE(pendiente, 0) - v_entregar, 0)
    WHERE id = v_det.id;

    v_partidas := v_partidas + 1;
    v_piezas := v_piezas + v_entregar;
  END LOOP;

  IF v_partidas = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', CASE
        WHEN jsonb_array_length(v_omitidas) > 0 THEN
          'No se pudo entregar: sin stock en las partidas marcadas. Mete inventario e intenta de nuevo.'
        ELSE
          'Ninguna de las partidas seleccionadas tiene pendientes por entregar.'
      END,
      'omitidas', v_omitidas
    );
  END IF;

  SELECT COALESCE(SUM(pendiente), 0)::INTEGER
  INTO v_pendientes_restantes
  FROM public.detalle_pedidos
  WHERE pedido_id = p_pedido_id
    AND prenda_id IS NOT NULL;

  IF v_pendientes_restantes <= 0 THEN
    UPDATE public.pedidos
    SET estado = 'COMPLETADO', updated_at = NOW()
    WHERE id = p_pedido_id;
    v_estado_final := 'COMPLETADO';
  ELSE
    UPDATE public.pedidos
    SET updated_at = NOW()
    WHERE id = p_pedido_id;
    v_estado_final := 'PENDIENTE';
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', CASE
      WHEN v_estado_final = 'COMPLETADO' THEN 'Pedido completado: ya no quedan pendientes.'
      ELSE format('Se entregaron %s pieza(s) en %s partida(s). El pedido sigue PENDIENTE.', v_piezas, v_partidas)
    END,
    'estado', v_estado_final,
    'partidas', v_partidas,
    'piezas', v_piezas,
    'pendientes_restantes', v_pendientes_restantes,
    'warnings', v_warnings || v_omitidas
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.completar_pedido_atomico(p_pedido_id uuid, p_usuario_id uuid DEFAULT NULL::uuid, p_sucursal_stock_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_suc_stock UUID;
  v_pedido RECORD;
  v_det RECORD;
  v_costo_id UUID;
  v_qty INTEGER;
  v_stock INTEGER;
  v_descontar INTEGER;
  v_pendientes_total INTEGER;
  v_prenda_nombre TEXT;
  v_talla_nombre TEXT;
  v_warnings JSONB := '[]'::JSONB;
BEGIN
  SELECT id, folio, estado, sucursal_id, linea_venta
  INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Stock desde otra sucursal (p. ej. Uniformes atendiendo un pedido de Winston):
  -- solo pedidos de la línea prendas; tenis / remate tenis nunca salen de su sucursal.
  v_suc_stock := COALESCE(p_sucursal_stock_id, v_pedido.sucursal_id);
  IF p_sucursal_stock_id IS NOT NULL
     AND p_sucursal_stock_id IS DISTINCT FROM v_pedido.sucursal_id
     AND COALESCE(v_pedido.linea_venta, '') <> 'prendas' THEN
    RAISE EXCEPTION 'Solo los pedidos de prendas se pueden atender con stock de otra sucursal.';
  END IF;

  IF v_pedido.estado <> 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'Solo se puede completar un pedido en PENDIENTE.');
  END IF;

  SELECT COALESCE(SUM(pendiente), 0)::INTEGER
  INTO v_pendientes_total
  FROM public.detalle_pedidos
  WHERE pedido_id = p_pedido_id;

  IF v_pendientes_total <= 0 THEN
    UPDATE public.pedidos
    SET estado = 'COMPLETADO', updated_at = NOW()
    WHERE id = p_pedido_id;
    RETURN json_build_object('success', true, 'message', 'Pedido marcado como COMPLETADO (sin pendientes).');
  END IF;

  FOR v_det IN
    SELECT id, prenda_id, talla_id, pendiente
    FROM public.detalle_pedidos
    WHERE pedido_id = p_pedido_id
      AND pendiente > 0
  LOOP
    v_qty := v_det.pendiente;

    SELECT p.nombre, t.nombre
    INTO v_prenda_nombre, v_talla_nombre
    FROM public.prendas p
    JOIN public.tallas t ON t.id = v_det.talla_id
    WHERE p.id = v_det.prenda_id;

    SELECT c.id, c.stock
    INTO v_costo_id, v_stock
    FROM public.costos c
    WHERE c.prenda_id = v_det.prenda_id
      AND c.talla_id = v_det.talla_id
      AND COALESCE(c.activo, true) = true
      AND (
        v_suc_stock IS NULL
        OR c.sucursal_id = v_suc_stock
      )
    ORDER BY
      CASE WHEN v_suc_stock IS NOT NULL AND c.sucursal_id = v_suc_stock THEN 0 ELSE 1 END,
      c.created_at NULLS LAST
    LIMIT 1;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe costo activo para % / % en la sucursal del pedido',
        COALESCE(v_prenda_nombre, v_det.prenda_id::TEXT),
        COALESCE(v_talla_nombre, v_det.talla_id::TEXT);
    END IF;

    v_stock := COALESCE(v_stock, 0);
    v_descontar := LEAST(v_qty, GREATEST(v_stock, 0));

    IF v_descontar > 0 THEN
      UPDATE public.costos
      SET stock = stock - v_descontar
      WHERE id = v_costo_id
        AND stock >= v_descontar;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para completar: % / % (requiere %, disponible %)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_descontar,
          v_stock;
      END IF;

      PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_descontar);

      INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
      VALUES (
        'SALIDA',
        v_costo_id,
        -v_descontar,
        'ENTREGA_PENDIENTE - Pedido ' || COALESCE(v_pedido.folio, v_pedido.id::TEXT),
        NULL
      );
    END IF;

    IF v_descontar < v_qty THEN
      v_warnings := v_warnings || jsonb_build_array(
        format(
          '%s / %s: entregado sin descontar inventario (pendiente %s, stock %s)',
          COALESCE(v_prenda_nombre, '?'),
          COALESCE(v_talla_nombre, '?'),
          v_qty,
          v_stock
        )
      );
    END IF;

    UPDATE public.detalle_pedidos
    SET pendiente = 0
    WHERE id = v_det.id;
  END LOOP;

  UPDATE public.pedidos
  SET estado = 'COMPLETADO',
      updated_at = NOW()
  WHERE id = p_pedido_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido completado.',
    'warnings', v_warnings
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_pedido_atomico(p_tipo_cliente character varying, p_cliente_nombre character varying, p_sucursal_id uuid, p_usuario_id uuid DEFAULT NULL::uuid, p_alumno_id text DEFAULT NULL::text, p_externo_id uuid DEFAULT NULL::uuid, p_estado character varying DEFAULT 'PENDIENTE'::character varying, p_notas text DEFAULT NULL::text, p_detalles jsonb DEFAULT '[]'::jsonb, p_linea_venta character varying DEFAULT NULL::character varying)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido_id UUID;
  v_folio TEXT;
  v_detalle JSONB;
  v_costo_id UUID;
  v_stock_actual INTEGER;
  v_precio_unitario DECIMAL(10,2);
  v_cantidad_total INTEGER;
  v_cantidad_con_stock INTEGER;
  v_cantidad_pendiente INTEGER;
  v_detalle_pedido_id UUID;
  v_subtotal_calculado DECIMAL(10,2) := 0;
  v_total_calculado DECIMAL(10,2) := 0;
  v_any_pending BOOLEAN := false;
  v_estado_final VARCHAR;
  v_codigo_sucursal TEXT;
BEGIN
  IF p_tipo_cliente IS NULL OR p_cliente_nombre IS NULL OR p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Faltan datos obligatorios';
  END IF;

  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'No se pueden crear pedidos sin detalles';
  END IF;

  SELECT codigo INTO v_codigo_sucursal FROM public.sucursales WHERE id = p_sucursal_id;
  IF v_codigo_sucursal = 'SUC-WIN' AND (
    p_linea_venta IS NULL
    OR p_linea_venta NOT IN ('prendas', 'tenis', 'remate_tenis')
  ) THEN
    RAISE EXCEPTION 'linea_venta requerida en Sucursal Winston (prendas, tenis o remate_tenis)';
  END IF;

  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);
    IF v_cantidad_total <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
    END IF;

    SELECT c.id, c.stock, COALESCE(c.precio_menudeo, c.precio_venta, 0)
    INTO v_costo_id, v_stock_actual, v_precio_unitario
    FROM public.costos c
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id
      AND c.activo = true;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'No existe precio para prenda % talla % en esta sucursal', (v_detalle->>'prenda_id'), (v_detalle->>'talla_id');
    END IF;

    v_cantidad_con_stock := LEAST(GREATEST(COALESCE(v_stock_actual, 0), 0), v_cantidad_total);
    v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;
    IF v_cantidad_pendiente > 0 THEN
      v_any_pending := true;
    END IF;

    v_subtotal_calculado := v_subtotal_calculado + (v_cantidad_total * v_precio_unitario);
  END LOOP;

  v_total_calculado := v_subtotal_calculado;
  v_estado_final := CASE WHEN v_any_pending THEN 'PENDIENTE' ELSE 'COMPLETADO' END;
  v_folio := public.generar_folio_pedido(p_sucursal_id, p_linea_venta);

  INSERT INTO public.pedidos (
    tipo_cliente, cliente_nombre, sucursal_id, usuario_id,
    alumno_id, externo_id, estado, subtotal, total, notas, folio, linea_venta
  ) VALUES (
    p_tipo_cliente, UPPER(p_cliente_nombre), p_sucursal_id, NULL,
    p_alumno_id, p_externo_id, v_estado_final, v_subtotal_calculado, v_total_calculado, p_notas, v_folio,
    CASE WHEN v_codigo_sucursal = 'SUC-WIN' THEN p_linea_venta ELSE NULL END
  ) RETURNING id INTO v_pedido_id;

  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad_total := COALESCE((v_detalle->>'cantidad')::INTEGER, 0);

    SELECT c.id, c.stock, COALESCE(c.precio_menudeo, c.precio_venta, 0)
    INTO v_costo_id, v_stock_actual, v_precio_unitario
    FROM public.costos c
    WHERE c.prenda_id = (v_detalle->>'prenda_id')::UUID
      AND c.talla_id = (v_detalle->>'talla_id')::UUID
      AND c.sucursal_id = p_sucursal_id;

    v_cantidad_con_stock := LEAST(GREATEST(COALESCE(v_stock_actual, 0), 0), v_cantidad_total);
    v_cantidad_pendiente := v_cantidad_total - v_cantidad_con_stock;

    INSERT INTO public.detalle_pedidos (
      pedido_id, prenda_id, talla_id, cantidad, precio_unitario,
      subtotal, pendiente, especificaciones
    ) VALUES (
      v_pedido_id,
      (v_detalle->>'prenda_id')::UUID,
      (v_detalle->>'talla_id')::UUID,
      v_cantidad_total,
      v_precio_unitario,
      v_cantidad_total * v_precio_unitario,
      v_cantidad_pendiente,
      UPPER(COALESCE(v_detalle->>'especificaciones', ''))
    ) RETURNING id INTO v_detalle_pedido_id;

    IF v_cantidad_con_stock > 0 THEN
      UPDATE public.costos
      SET stock = stock - v_cantidad_con_stock
      WHERE id = v_costo_id
        AND stock >= v_cantidad_con_stock;

      IF FOUND THEN
        PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_id, v_cantidad_con_stock);

        INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones, usuario_id)
        VALUES (
          'SALIDA',
          v_costo_id,
          -v_cantidad_con_stock,
          'VENTA - Pedido ' || v_folio ||
            CASE
              WHEN v_cantidad_pendiente > 0
              THEN ' (' || v_cantidad_con_stock || ' entregadas, ' || v_cantidad_pendiente || ' pendientes)'
              ELSE ' (' || v_cantidad_con_stock || ' entregadas)'
            END,
          NULL
        );
      ELSE
        UPDATE public.detalle_pedidos SET pendiente = cantidad WHERE id = v_detalle_pedido_id;
        UPDATE public.pedidos SET estado = 'PENDIENTE' WHERE id = v_pedido_id;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'folio', v_folio,
    'linea_venta', p_linea_venta,
    'total', v_total_calculado,
    'estado', (SELECT estado FROM public.pedidos WHERE id = v_pedido_id),
    'message', 'Pedido creado correctamente'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error al crear pedido: ' || SQLERRM
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.descontar_costo_ubicaciones_desde_menor(p_costo_id uuid, p_cantidad integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rem INTEGER;
  v_take INTEGER;
  r RECORD;
  v_sum INTEGER;
BEGIN
  IF p_costo_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad), 0)::INTEGER INTO v_sum
  FROM public.costo_ubicaciones
  WHERE costo_id = p_costo_id;

  IF v_sum < p_cantidad THEN
    RAISE EXCEPTION
      'Stock por ubicaciones insuficiente para la prenda/talla (costo %): en ubicaciones hay %, se requieren % unidades.',
      p_costo_id,
      v_sum,
      p_cantidad;
  END IF;

  v_rem := p_cantidad;
  FOR r IN
    SELECT cu.id, cu.cantidad
    FROM public.costo_ubicaciones cu
    JOIN public.ubicaciones_almacenamiento ua
      ON ua.id = cu.ubicacion_almacenamiento_id
    WHERE cu.costo_id = p_costo_id
    ORDER BY
      cu.cantidad ASC,
      CASE
        WHEN ua.nombre ILIKE 'taller' THEN 0
        ELSE 1
      END ASC,
      cu.ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    v_take := LEAST(r.cantidad, v_rem);
    IF v_take > 0 THEN
      UPDATE public.costo_ubicaciones
      SET cantidad = cantidad - v_take
      WHERE id = r.id;
      v_rem := v_rem - v_take;
    END IF;
  END LOOP;

  IF v_rem > 0 THEN
    RAISE EXCEPTION 'No se pudo completar el descuento por ubicaciones (costo %).', p_costo_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.descontar_insumo_ubicaciones_desde_menor(p_insumo_id uuid, p_cantidad numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rem NUMERIC(14, 4);
  v_take NUMERIC(14, 4);
  r RECORD;
  v_sum NUMERIC(14, 4);
BEGIN
  IF p_insumo_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM insumo_ubicaciones WHERE insumo_id = p_insumo_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(cantidad), 0)::NUMERIC(14, 4) INTO v_sum
  FROM insumo_ubicaciones
  WHERE insumo_id = p_insumo_id;

  IF v_sum < p_cantidad THEN
    RAISE EXCEPTION
      'Stock por ubicaciones insuficiente para el insumo %: en ubicaciones hay %, se requiere %.',
      p_insumo_id,
      v_sum,
      p_cantidad;
  END IF;

  v_rem := ROUND(p_cantidad, 4);
  FOR r IN
    SELECT id, cantidad
    FROM insumo_ubicaciones
    WHERE insumo_id = p_insumo_id
    ORDER BY cantidad ASC, ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    v_take := LEAST(r.cantidad, v_rem);
    IF v_take > 0 THEN
      UPDATE insumo_ubicaciones
      SET cantidad = cantidad - v_take
      WHERE id = r.id;
      v_rem := ROUND(v_rem - v_take, 4);
    END IF;
  END LOOP;

  IF v_rem > 0.0001 THEN
    RAISE EXCEPTION 'No se pudo completar el descuento por ubicaciones (insumo %).', p_insumo_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generar_folio_cotizacion()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  anio text;
  mes text;
  n bigint;
BEGIN
  anio := to_char(current_date, 'YYYY');
  mes := to_char(current_date, 'MM');
  n := nextval('public.cotizacion_folio_seq');

  RETURN 'COT-' || anio || mes || '-' || lpad(n::text, 4, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generar_folio_pedido(p_sucursal_id uuid, p_linea_venta character varying DEFAULT NULL::character varying)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo TEXT;
  anio TEXT;
  mes TEXT;
  prefijo TEXT;
  siguiente_numero INTEGER;
  nuevo_folio TEXT;
BEGIN
  IF p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'sucursal_id requerido para folio de pedido';
  END IF;

  SELECT codigo INTO v_codigo FROM public.sucursales WHERE id = p_sucursal_id;
  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Sucursal no encontrada para folio de pedido';
  END IF;

  IF v_codigo = 'SUC-WIN' THEN
    IF p_linea_venta = 'tenis' THEN
      prefijo := 'wt';
    ELSIF p_linea_venta = 'remate_tenis' THEN
      prefijo := 'rt';
    ELSIF p_linea_venta = 'prendas' THEN
      prefijo := 'wu';
    ELSE
      RAISE EXCEPTION 'linea_venta requerida en Winston: prendas, tenis o remate_tenis';
    END IF;

    SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO siguiente_numero
    FROM public.pedidos
    WHERE sucursal_id = p_sucursal_id
      AND folio IS NOT NULL
      AND folio ~ ('^' || prefijo || '[0-9]+$');

    nuevo_folio := prefijo || LPAD(siguiente_numero::TEXT, 4, '0');
    RETURN nuevo_folio;
  END IF;

  anio := TO_CHAR(CURRENT_DATE, 'YYYY');
  mes := TO_CHAR(CURRENT_DATE, 'MM');
  prefijo := 'PED-' || v_codigo || '-' || anio || mes;

  SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO siguiente_numero
  FROM public.pedidos
  WHERE sucursal_id = p_sucursal_id
    AND folio IS NOT NULL
    AND folio LIKE prefijo || '%';

  nuevo_folio := prefijo || '-' || LPAD(siguiente_numero::TEXT, 4, '0');
  RETURN nuevo_folio;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_folio_transferencia()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_folio VARCHAR(20);
  year_part VARCHAR(4);
  count_part INTEGER;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(COUNT(*) + 1, 1)
  INTO count_part
  FROM public.transferencias
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  new_folio := 'TRANS-' || year_part || '-' || LPAD(count_part::TEXT, 3, '0');
  NEW.folio := new_folio;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.obtener_tallas_ordenadas()
 RETURNS TABLE(id uuid, nombre text, orden integer, activo boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    id,
    nombre,
    orden,
    activo,
    created_at,
    updated_at
  FROM tallas
  ORDER BY 
    -- 1. Separar números de letras (números primero = 0, letras después = 1)
    CASE 
      WHEN nombre ~ '^[0-9]+$' THEN 0  -- Es solo números
      ELSE 1  -- Contiene letras o caracteres especiales
    END,
    -- 2. Si es número, ordenar numéricamente
    CASE 
      WHEN nombre ~ '^[0-9]+$' THEN nombre::integer
      ELSE 999999  -- Valor alto para que las letras vayan después
    END,
    -- 3. Ordenar alfabéticamente (para letras como XS, S, M, L, XL)
    nombre ASC;
$function$;

CREATE OR REPLACE FUNCTION public.procesar_devolucion_atomica(p_devolucion_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_det RECORD;
  v_dev RECORD;
  v_det_pedido RECORD;
  v_costo_id UUID;
  v_costo_cambio_id UUID;
  v_max_entregado INTEGER;
  v_dev_qty INTEGER;
  v_cambio_qty INTEGER;
BEGIN
  SELECT id, pedido_id, sucursal_id, estado
  INTO v_dev
  FROM public.devoluciones
  WHERE id = p_devolucion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devolución no encontrada';
  END IF;

  IF v_dev.estado <> 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'La devolución ya fue procesada o cancelada.');
  END IF;

  FOR v_det IN
    SELECT * FROM public.detalle_devoluciones WHERE devolucion_id = p_devolucion_id
  LOOP
    SELECT *
    INTO v_det_pedido
    FROM public.detalle_pedidos
    WHERE id = v_det.detalle_pedido_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Detalle del pedido no encontrado para devolución';
    END IF;

    v_max_entregado := GREATEST(v_det_pedido.cantidad - COALESCE(v_det_pedido.pendiente, 0), 0);
    v_dev_qty := LEAST(v_det.cantidad_devuelta, v_max_entregado);

    IF v_dev_qty <= 0 THEN
      RAISE EXCEPTION 'No hay piezas entregadas para devolver en la partida %', v_det_pedido.id;
    END IF;

    SELECT c.id
    INTO v_costo_id
    FROM public.costos c
    WHERE c.prenda_id = v_det.prenda_id
      AND c.talla_id = v_det.talla_id
      AND c.sucursal_id = v_dev.sucursal_id;

    IF v_costo_id IS NULL THEN
      RAISE EXCEPTION 'Costo no encontrado para prenda/talla de devolución';
    END IF;

    UPDATE public.costos
    SET stock = stock + v_dev_qty
    WHERE id = v_costo_id;

    PERFORM public.sumar_costo_ubicaciones_desde_menor(v_costo_id, v_dev_qty);

    INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones)
    VALUES ('ENTRADA', v_costo_id, v_dev_qty, 'Devolución #' || p_devolucion_id);

    IF v_det.es_cambio
      AND v_det.prenda_cambio_id IS NOT NULL
      AND v_det.talla_cambio_id IS NOT NULL
    THEN
      v_cambio_qty := COALESCE(v_det.cantidad_cambio, v_dev_qty);
      IF v_cambio_qty <= 0 THEN
        v_cambio_qty := v_dev_qty;
      END IF;

      SELECT c.id
      INTO v_costo_cambio_id
      FROM public.costos c
      WHERE c.prenda_id = v_det.prenda_cambio_id
        AND c.talla_id = v_det.talla_cambio_id
        AND c.sucursal_id = v_dev.sucursal_id;

      IF v_costo_cambio_id IS NULL THEN
        RAISE EXCEPTION 'Costo no encontrado para artículo de cambio';
      END IF;

      UPDATE public.costos
      SET stock = stock - v_cambio_qty
      WHERE id = v_costo_cambio_id
        AND stock >= v_cambio_qty;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock insuficiente para el artículo de cambio';
      END IF;

      PERFORM public.descontar_costo_ubicaciones_desde_menor(v_costo_cambio_id, v_cambio_qty);

      INSERT INTO public.movimientos (tipo, costo_id, cantidad, observaciones)
      VALUES ('SALIDA', v_costo_cambio_id, -v_cambio_qty, 'Cambio - Devolución #' || p_devolucion_id);

      UPDATE public.detalle_pedidos
      SET prenda_id = v_det.prenda_cambio_id,
          talla_id = v_det.talla_cambio_id
      WHERE id = v_det_pedido.id;
    END IF;
  END LOOP;

  UPDATE public.devoluciones
  SET estado = 'PROCESADA',
      updated_at = NOW()
  WHERE id = p_devolucion_id;

  RETURN json_build_object('success', true, 'message', 'Devolución procesada correctamente');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconciliar_costo_ubicaciones_desde_stock(p_costo_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stock INTEGER;
  v_sum INTEGER;
  v_diff INTEGER;
  v_rem INTEGER;
  v_take INTEGER;
  r RECORD;
  v_target_id UUID;
  v_cur INTEGER;
BEGIN
  IF p_costo_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'costo_id requerido');
  END IF;

  SELECT GREATEST(COALESCE(stock, 0), 0)::INTEGER INTO v_stock
  FROM public.costos WHERE id = p_costo_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Costo no encontrado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    IF v_stock > 0 THEN
      INSERT INTO public.costo_ubicaciones (costo_id, ubicacion_almacenamiento_id, cantidad)
      SELECT p_costo_id, ua.id, v_stock
      FROM public.ubicaciones_almacenamiento ua
      WHERE ua.activo = true
      ORDER BY CASE WHEN ua.nombre ILIKE 'taller' THEN 0 ELSE 1 END, ua.nombre
      LIMIT 1;
      RETURN json_build_object('success', true, 'adjusted', true, 'note', 'Ubicación creada en Taller');
    END IF;
    RETURN json_build_object('success', true, 'adjusted', false, 'note', 'Sin ubicaciones');
  END IF;

  SELECT COALESCE(SUM(GREATEST(cantidad, 0)), 0)::INTEGER INTO v_sum
  FROM public.costo_ubicaciones WHERE costo_id = p_costo_id;

  v_diff := v_stock - v_sum;
  IF v_diff = 0 THEN
    RETURN json_build_object('success', true, 'adjusted', false, 'stock', v_stock, 'sum', v_sum);
  END IF;

  IF v_diff > 0 THEN
    SELECT cu.id, GREATEST(cu.cantidad, 0)::INTEGER
    INTO v_target_id, v_cur
    FROM public.costo_ubicaciones cu
    JOIN public.ubicaciones_almacenamiento ua ON ua.id = cu.ubicacion_almacenamiento_id
    WHERE cu.costo_id = p_costo_id
    ORDER BY
      GREATEST(cu.cantidad, 0) ASC,
      CASE WHEN ua.nombre ILIKE 'taller' THEN 0 ELSE 1 END ASC,
      cu.ubicacion_almacenamiento_id ASC
    LIMIT 1;

    UPDATE public.costo_ubicaciones
    SET cantidad = v_cur + v_diff, updated_at = NOW()
    WHERE id = v_target_id;
  ELSE
    v_rem := -v_diff;
    FOR r IN
      SELECT cu.id, GREATEST(cu.cantidad, 0)::INTEGER AS cantidad
      FROM public.costo_ubicaciones cu
      JOIN public.ubicaciones_almacenamiento ua ON ua.id = cu.ubicacion_almacenamiento_id
      WHERE cu.costo_id = p_costo_id
      ORDER BY
        GREATEST(cu.cantidad, 0) ASC,
        CASE WHEN ua.nombre ILIKE 'taller' THEN 0 ELSE 1 END ASC,
        cu.ubicacion_almacenamiento_id ASC
    LOOP
      EXIT WHEN v_rem <= 0;
      v_take := LEAST(r.cantidad, v_rem);
      IF v_take > 0 THEN
        UPDATE public.costo_ubicaciones
        SET cantidad = r.cantidad - v_take, updated_at = NOW()
        WHERE id = r.id;
        v_rem := v_rem - v_take;
      END IF;
    END LOOP;

    IF v_rem > 0 THEN
      RAISE EXCEPTION 'No alcanzó stock en ubicaciones para descontar sobrante (costo %)', p_costo_id;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'adjusted', true, 'stock', v_stock, 'sum_before', v_sum);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refoliar_cotizaciones_existentes()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_n bigint;
  v_count int := 0;
BEGIN
  PERFORM setval('public.cotizacion_folio_seq', 1, false);

  FOR r IN
    SELECT id, fecha_cotizacion, created_at
    FROM public.cotizaciones
    ORDER BY
      COALESCE(fecha_cotizacion, created_at::date) ASC,
      created_at ASC,
      id ASC
  LOOP
    v_n := nextval('public.cotizacion_folio_seq');
    UPDATE public.cotizaciones
    SET folio = 'COT-' || to_char(COALESCE(r.fecha_cotizacion, r.created_at::date), 'YYYYMM') || '-' || lpad(v_n::text, 4, '0')
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'updated', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sumar_costo_ubicaciones_desde_menor(p_costo_id uuid, p_cantidad integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rem INTEGER;
  r RECORD;
BEGIN
  IF p_costo_id IS NULL OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM costo_ubicaciones WHERE costo_id = p_costo_id) THEN
    RETURN;
  END IF;

  -- Política: sumar primero a la ubicación con menor cantidad (desempate por ubicacion_almacenamiento_id)
  v_rem := p_cantidad;
  FOR r IN
    SELECT id
    FROM costo_ubicaciones
    WHERE costo_id = p_costo_id
    ORDER BY cantidad ASC, ubicacion_almacenamiento_id ASC
  LOOP
    EXIT WHEN v_rem <= 0;
    UPDATE costo_ubicaciones
    SET cantidad = cantidad + v_rem
    WHERE id = r.id;
    v_rem := 0;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferencia_cancelar(p_transferencia_id uuid, p_sucursal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
  det RECORD;
  v_repuestas INTEGER := 0;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.estado = 'CANCELADA' THEN
    RAISE EXCEPTION 'Esta transferencia ya está cancelada.';
  END IF;
  IF t.estado = 'RECIBIDA' THEN
    RAISE EXCEPTION 'No se puede cancelar una transferencia ya recibida.';
  END IF;
  IF t.estado NOT IN ('EN_TRANSITO', 'PENDIENTE', 'RECIBIDA_PARCIAL') THEN
    RAISE EXCEPTION 'No se puede cancelar en estado %.', t.estado;
  END IF;
  IF t.sucursal_origen_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal origen puede cancelar esta transferencia.';
  END IF;

  FOR det IN
    SELECT * FROM detalle_transferencias WHERE transferencia_id = p_transferencia_id FOR UPDATE
  LOOP
    -- RECIBIDA: ya está en destino. COMPLEMENTARIO: el stock ya volvió al origen.
    CONTINUE WHEN UPPER(COALESCE(det.estado, 'EN_TRANSITO')) IN ('RECIBIDA', 'EN_TRANSITO_COMPLEMENTARIO');
    CONTINUE WHEN det.costo_id IS NULL OR COALESCE(det.cantidad, 0) <= 0;
    PERFORM _transfer_reponer_origen(det.costo_id, det.cantidad, t.sucursal_origen_id);
    v_repuestas := v_repuestas + det.cantidad;
  END LOOP;

  UPDATE transferencias SET estado = 'CANCELADA' WHERE id = p_transferencia_id;
  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN jsonb_build_object('transferencia', v_row, 'unidades_repuestas', v_repuestas);
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferencia_crear(p_sucursal_origen_id uuid, p_sucursal_destino_id uuid, p_observaciones text, p_detalles jsonb, p_client_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  d JSONB;
  v_cantidad INTEGER;
  v_row JSONB;
BEGIN
  IF p_sucursal_origen_id IS NULL OR p_sucursal_destino_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona sucursal origen y destino.';
  END IF;
  IF p_sucursal_origen_id = p_sucursal_destino_id THEN
    RAISE EXCEPTION 'Origen y destino deben ser distintos.';
  END IF;
  IF p_detalles IS NULL OR jsonb_typeof(p_detalles) <> 'array' OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos una prenda con cantidad.';
  END IF;

  -- Reintento con el mismo token: devolver la transferencia ya creada sin tocar stock.
  -- Si otra petición con el mismo token está en curso, el INSERT espera a que termine.
  INSERT INTO transferencias (
    sucursal_origen_id, sucursal_destino_id, usuario_id, estado, observaciones, folio, client_token
  )
  VALUES (
    p_sucursal_origen_id, p_sucursal_destino_id, NULL, 'EN_TRANSITO',
    NULLIF(BTRIM(COALESCE(p_observaciones, '')), ''), '', p_client_token
  )
  ON CONFLICT (client_token) WHERE client_token IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT to_jsonb(t) INTO v_row FROM transferencias t WHERE t.client_token = p_client_token;
    RETURN v_row || jsonb_build_object('duplicada', TRUE);
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad := TRUNC((d->>'cantidad')::NUMERIC)::INTEGER;
    IF COALESCE(d->>'prenda_id', '') = '' OR COALESCE(d->>'talla_id', '') = ''
       OR COALESCE(d->>'costo_id', '') = '' OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cada línea debe tener prenda, talla, costo y cantidad > 0.';
    END IF;

    PERFORM _transfer_descontar_origen((d->>'costo_id')::UUID, v_cantidad, p_sucursal_origen_id);

    INSERT INTO detalle_transferencias (transferencia_id, prenda_id, talla_id, cantidad, costo_id, estado)
    VALUES (v_id, (d->>'prenda_id')::UUID, (d->>'talla_id')::UUID, v_cantidad, (d->>'costo_id')::UUID, 'EN_TRANSITO');
  END LOOP;

  SELECT to_jsonb(t) INTO v_row FROM transferencias t WHERE t.id = v_id;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferencia_modificar(p_transferencia_id uuid, p_sucursal_id uuid, p_observaciones text, p_detalles jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
  prev RECORD;
  d JSONB;
  v_cantidad INTEGER;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.sucursal_origen_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal origen puede modificar esta transferencia.';
  END IF;
  IF t.estado NOT IN ('EN_TRANSITO', 'PENDIENTE') THEN
    RAISE EXCEPTION 'Solo se pueden modificar transferencias en tránsito (estado: %).', t.estado;
  END IF;
  IF p_detalles IS NULL OR jsonb_typeof(p_detalles) <> 'array' OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos una prenda con cantidad.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM detalle_transferencias
    WHERE transferencia_id = p_transferencia_id
      AND UPPER(COALESCE(estado, 'EN_TRANSITO')) NOT IN ('EN_TRANSITO', 'PENDIENTE')
  ) THEN
    RAISE EXCEPTION 'No se puede modificar: ya hay partidas recibidas o complementarias.';
  END IF;

  FOR prev IN
    SELECT * FROM detalle_transferencias WHERE transferencia_id = p_transferencia_id FOR UPDATE
  LOOP
    IF prev.costo_id IS NOT NULL AND COALESCE(prev.cantidad, 0) > 0 THEN
      PERFORM _transfer_reponer_origen(prev.costo_id, prev.cantidad, t.sucursal_origen_id);
    END IF;
  END LOOP;

  DELETE FROM detalle_transferencias WHERE transferencia_id = p_transferencia_id;

  FOR d IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_cantidad := TRUNC((d->>'cantidad')::NUMERIC)::INTEGER;
    IF COALESCE(d->>'prenda_id', '') = '' OR COALESCE(d->>'talla_id', '') = ''
       OR COALESCE(d->>'costo_id', '') = '' OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cada línea debe tener prenda, talla, costo y cantidad > 0.';
    END IF;

    PERFORM _transfer_descontar_origen((d->>'costo_id')::UUID, v_cantidad, t.sucursal_origen_id);

    INSERT INTO detalle_transferencias (transferencia_id, prenda_id, talla_id, cantidad, costo_id, estado)
    VALUES (p_transferencia_id, (d->>'prenda_id')::UUID, (d->>'talla_id')::UUID, v_cantidad, (d->>'costo_id')::UUID, 'EN_TRANSITO');
  END LOOP;

  UPDATE transferencias
  SET observaciones = NULLIF(BTRIM(COALESCE(p_observaciones, '')), ''),
      estado = 'EN_TRANSITO'
  WHERE id = p_transferencia_id;

  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferencia_recibir(p_transferencia_id uuid, p_sucursal_id uuid, p_detalle_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
  det RECORD;
  v_seleccion BOOLEAN := p_detalle_ids IS NOT NULL AND COALESCE(array_length(p_detalle_ids, 1), 0) > 0;
  v_recibidas INTEGER := 0;
  v_no_recibidas INTEGER := 0;
  v_estado VARCHAR;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.sucursal_destino_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal destino puede confirmar la recepción.';
  END IF;
  IF t.estado IN ('RECIBIDA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Esta transferencia ya no admite recepción.';
  END IF;
  IF t.estado NOT IN ('EN_TRANSITO', 'PENDIENTE', 'RECIBIDA_PARCIAL') THEN
    RAISE EXCEPTION 'Estado no válido: %', t.estado;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM detalle_transferencias
    WHERE transferencia_id = p_transferencia_id
      AND UPPER(COALESCE(estado, 'EN_TRANSITO')) IN ('EN_TRANSITO', 'PENDIENTE')
  ) THEN
    RAISE EXCEPTION 'No hay partidas pendientes por recibir.';
  END IF;

  IF v_seleccion AND NOT EXISTS (
    SELECT 1 FROM detalle_transferencias
    WHERE transferencia_id = p_transferencia_id
      AND UPPER(COALESCE(estado, 'EN_TRANSITO')) IN ('EN_TRANSITO', 'PENDIENTE')
      AND id = ANY (p_detalle_ids)
  ) THEN
    RAISE EXCEPTION 'Selecciona al menos una prenda para recibir.';
  END IF;

  FOR det IN
    SELECT * FROM detalle_transferencias
    WHERE transferencia_id = p_transferencia_id
      AND UPPER(COALESCE(estado, 'EN_TRANSITO')) IN ('EN_TRANSITO', 'PENDIENTE')
    FOR UPDATE
  LOOP
    IF det.costo_id IS NULL THEN
      RAISE EXCEPTION 'Detalle sin costo de origen.';
    END IF;

    IF NOT v_seleccion OR det.id = ANY (p_detalle_ids) THEN
      IF COALESCE(det.cantidad, 0) > 0 THEN
        PERFORM _transfer_abonar_destino(det.costo_id, t.sucursal_destino_id, det.cantidad);
      END IF;
      UPDATE detalle_transferencias SET estado = 'RECIBIDA' WHERE id = det.id;
      v_recibidas := v_recibidas + 1;
    ELSE
      IF COALESCE(det.cantidad, 0) > 0 THEN
        PERFORM _transfer_reponer_origen(det.costo_id, det.cantidad, t.sucursal_origen_id);
      END IF;
      UPDATE detalle_transferencias SET estado = 'EN_TRANSITO_COMPLEMENTARIO' WHERE id = det.id;
      v_no_recibidas := v_no_recibidas + 1;
    END IF;
  END LOOP;

  v_estado := _transferencia_recalcular_estado(p_transferencia_id);
  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN jsonb_build_object(
    'transferencia', v_row,
    'recibidas', v_recibidas,
    'noRecibidas', v_no_recibidas,
    'estado', v_estado
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferencia_recibir_partida(p_transferencia_id uuid, p_detalle_id uuid, p_sucursal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
  det RECORD;
  v_est VARCHAR;
  v_estado VARCHAR;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.sucursal_destino_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal destino puede recibir partidas.';
  END IF;
  IF t.estado IN ('RECIBIDA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Esta transferencia ya no admite recepción.';
  END IF;

  SELECT * INTO det FROM detalle_transferencias
  WHERE id = p_detalle_id AND transferencia_id = p_transferencia_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida no encontrada.';
  END IF;

  v_est := UPPER(COALESCE(det.estado, 'EN_TRANSITO'));
  IF v_est NOT IN ('EN_TRANSITO_COMPLEMENTARIO', 'EN_TRANSITO', 'PENDIENTE') THEN
    RAISE EXCEPTION 'Esta partida no se puede recibir (estado: %).', v_est;
  END IF;
  IF det.costo_id IS NULL OR COALESCE(det.cantidad, 0) <= 0 THEN
    RAISE EXCEPTION 'Partida incompleta.';
  END IF;

  -- Complementario: el stock ya había vuelto al origen → descontar de nuevo al recibir
  IF v_est = 'EN_TRANSITO_COMPLEMENTARIO' THEN
    PERFORM _transfer_descontar_origen(det.costo_id, det.cantidad, t.sucursal_origen_id);
  END IF;

  PERFORM _transfer_abonar_destino(det.costo_id, t.sucursal_destino_id, det.cantidad);
  UPDATE detalle_transferencias SET estado = 'RECIBIDA' WHERE id = det.id;

  v_estado := _transferencia_recalcular_estado(p_transferencia_id);
  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN jsonb_build_object('transferencia', v_row, 'estado', v_estado, 'detalle_id', p_detalle_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferencia_reenviar_complementario(p_transferencia_id uuid, p_detalle_id uuid, p_sucursal_id uuid, p_linea jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD;
  det RECORD;
  v_prenda UUID;
  v_talla UUID;
  v_costo UUID;
  v_cantidad INTEGER;
  v_estado VARCHAR;
  v_row JSONB;
BEGIN
  SELECT * INTO t FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada.';
  END IF;
  IF t.sucursal_origen_id IS DISTINCT FROM p_sucursal_id THEN
    RAISE EXCEPTION 'Solo la sucursal origen puede corregir y reenviar.';
  END IF;
  IF t.estado IN ('RECIBIDA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Estado no válido: %', t.estado;
  END IF;

  SELECT * INTO det FROM detalle_transferencias
  WHERE id = p_detalle_id AND transferencia_id = p_transferencia_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida no encontrada.';
  END IF;
  IF UPPER(COALESCE(det.estado, '')) <> 'EN_TRANSITO_COMPLEMENTARIO' THEN
    RAISE EXCEPTION 'Solo se pueden reenviar partidas en tránsito complementario.';
  END IF;

  v_prenda := det.prenda_id;
  v_talla := det.talla_id;
  v_costo := det.costo_id;
  v_cantidad := det.cantidad;

  IF p_linea IS NOT NULL AND jsonb_typeof(p_linea) = 'object' THEN
    v_cantidad := TRUNC((p_linea->>'cantidad')::NUMERIC)::INTEGER;
    IF COALESCE(p_linea->>'prenda_id', '') = '' OR COALESCE(p_linea->>'talla_id', '') = ''
       OR COALESCE(p_linea->>'costo_id', '') = '' OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La línea corregida debe tener prenda, talla, costo y cantidad > 0.';
    END IF;
    v_prenda := (p_linea->>'prenda_id')::UUID;
    v_talla := (p_linea->>'talla_id')::UUID;
    v_costo := (p_linea->>'costo_id')::UUID;
  END IF;

  IF v_costo IS NULL OR COALESCE(v_cantidad, 0) <= 0 THEN
    RAISE EXCEPTION 'Partida incompleta para reenviar.';
  END IF;

  PERFORM _transfer_descontar_origen(v_costo, v_cantidad, t.sucursal_origen_id);

  UPDATE detalle_transferencias
  SET prenda_id = v_prenda, talla_id = v_talla, costo_id = v_costo,
      cantidad = v_cantidad, estado = 'EN_TRANSITO'
  WHERE id = det.id;

  v_estado := _transferencia_recalcular_estado(p_transferencia_id);
  SELECT to_jsonb(x) INTO v_row FROM transferencias x WHERE x.id = p_transferencia_id;
  RETURN jsonb_build_object('transferencia', v_row, 'estado', v_estado, 'detalle_id', p_detalle_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_auditoria_generic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pk_col TEXT;
  v_pk_text TEXT;
  v_pk_uuid UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSE
    v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
    v_new := to_jsonb(NEW);
  END IF;

  SELECT a.attname
  INTO v_pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[1]
  WHERE i.indrelid = TG_RELID
    AND i.indisprimary
  LIMIT 1;

  IF v_pk_col IS NOT NULL THEN
    v_pk_text := COALESCE(v_new->>v_pk_col, v_old->>v_pk_col);
  END IF;

  IF v_pk_text IS NULL OR v_pk_text = '' THEN
    v_pk_col := NULL;
    v_pk_text := COALESCE(
      v_new->>'id',
      v_old->>'id',
      v_new->>'usuario_id',
      v_old->>'usuario_id'
    );
  END IF;

  BEGIN
    v_pk_uuid := NULLIF(v_pk_text, '')::uuid;
  EXCEPTION
    WHEN others THEN
      v_pk_uuid := NULL;
  END;

  INSERT INTO public.auditoria (tabla, operacion, registro_id, registro_pk_col, registro_pk, datos_anteriores, datos_nuevos, usuario_id, timestamp)
  VALUES (TG_TABLE_NAME, TG_OP, v_pk_uuid, v_pk_col, v_pk_text, v_old, v_new, NULL, NOW());

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_cotizacion_insumos_al_trabajar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_det RECORD;
  v_prenda_id UUID;
  v_talla_id UUID;
  v_insumo_record RECORD;
  v_cons NUMERIC(14, 4);
  v_cant INTEGER;
BEGIN
  IF NEW.estado IS DISTINCT FROM 'trabajando' THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'trabajando' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.insumos_trabajando_aplicado, false) THEN
    RETURN NEW;
  END IF;

  FOR v_det IN
    SELECT id, cantidad, costo_id
    FROM detalle_cotizacion
    WHERE cotizacion_id = NEW.id
      AND costo_id IS NOT NULL
  LOOP
    SELECT c.prenda_id, c.talla_id
    INTO v_prenda_id, v_talla_id
    FROM costos c
    WHERE c.id = v_det.costo_id;

    IF v_prenda_id IS NULL OR v_talla_id IS NULL THEN
      RAISE EXCEPTION
        'Partida de cotización % sin prenda/talla en costos (costo_id %).',
        v_det.id,
        v_det.costo_id;
    END IF;

    v_cant := GREATEST(COALESCE(v_det.cantidad, 0), 0);
    IF v_cant = 0 THEN
      CONTINUE;
    END IF;

    FOR v_insumo_record IN
      SELECT pti.insumo_id, i.nombre, pti.cantidad
      FROM prenda_talla_insumos pti
      JOIN insumos i ON pti.insumo_id = i.id
      WHERE pti.prenda_id = v_prenda_id
        AND pti.talla_id = v_talla_id
    LOOP
      v_cons := ROUND((v_insumo_record.cantidad * v_cant::NUMERIC), 4);
      IF v_cons > 0 THEN
        UPDATE insumos
        SET stock = stock - v_cons
        WHERE id = v_insumo_record.insumo_id
          AND stock >= v_cons;

        IF NOT FOUND THEN
          RAISE EXCEPTION
            'Stock insuficiente del insumo "%" para pasar la cotización % a trabajando. Requerido: % (receta × % u.).',
            v_insumo_record.nombre,
            COALESCE(NEW.folio, NEW.id::TEXT),
            v_cons,
            v_cant;
        END IF;

        PERFORM descontar_insumo_ubicaciones_desde_menor(v_insumo_record.insumo_id, v_cons);
      END IF;
    END LOOP;
  END LOOP;

  NEW.insumos_trabajando_aplicado := true;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_pedido_desde_cotizacion_terminada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido_id UUID;
  v_sucursal_id UUID;
  v_folio TEXT;
  v_cliente_nombre TEXT;
  d RECORD;
  v_prenda_id UUID;
  v_talla_id UUID;
  v_pendiente INTEGER;
  v_lines INTEGER := 0;
  v_sum_sub NUMERIC(12, 2);
  v_ins_sub NUMERIC(12, 2);
  v_ins_tot NUMERIC(12, 2);
BEGIN
  IF NEW.estado IS DISTINCT FROM 'terminado' THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'terminado' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM pedidos p WHERE p.cotizacion_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT c.sucursal_id INTO v_sucursal_id
  FROM detalle_cotizacion dc
  JOIN costos c ON c.id = dc.costo_id
  WHERE dc.cotizacion_id = NEW.id
  LIMIT 1;

  IF v_sucursal_id IS NULL THEN
    SELECT s.id INTO v_sucursal_id
    FROM sucursales s
    WHERE s.es_matriz = true AND s.activo = true
    LIMIT 1;
  END IF;

  IF v_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró sucursal para registrar el pedido (defina una sucursal matriz).';
  END IF;

  IF NEW.tipo_cliente = 'alumno' AND NEW.alumno_id IS NOT NULL THEN
    SELECT UPPER(TRIM(COALESCE(a.alumno_nombre_completo, a.alumno_nombre, ''))) INTO v_cliente_nombre FROM public.alumno a WHERE a.alumno_id::text = TRIM(NEW.alumno_id);
  ELSIF NEW.tipo_cliente = 'externo' AND NEW.externo_id IS NOT NULL THEN
    SELECT UPPER(TRIM(e.nombre)) INTO v_cliente_nombre FROM externos e WHERE e.id = NEW.externo_id;
  END IF;

  v_cliente_nombre := COALESCE(v_cliente_nombre, 'CLIENTE');

  v_folio := public.generar_folio_pedido(v_sucursal_id);

  v_ins_sub := GREATEST(COALESCE(NEW.subtotal, 0), 0.01);
  v_ins_tot := GREATEST(COALESCE(NEW.total, NEW.subtotal, 0), 0.01);

  INSERT INTO pedidos (
    tipo_cliente,
    cliente_nombre,
    sucursal_id,
    usuario_id,
    alumno_id,
    externo_id,
    estado,
    subtotal,
    total,
    notas,
    folio,
    cotizacion_id
  ) VALUES (
    NEW.tipo_cliente,
    v_cliente_nombre,
    v_sucursal_id,
    NEW.usuario_id,
    NEW.alumno_id,
    NEW.externo_id,
    'COMPLETADO',
    v_ins_sub,
    v_ins_tot,
    'Venta por cotización terminada ' || NEW.folio
      || '. Sin salida de inventario de prendas desde almacén.',
    v_folio,
    NEW.id
  )
  RETURNING id INTO v_pedido_id;

  FOR d IN
    SELECT *
    FROM detalle_cotizacion
    WHERE cotizacion_id = NEW.id
    ORDER BY orden
  LOOP
    v_prenda_id := NULL;
    v_talla_id := NULL;

    IF d.costo_id IS NOT NULL THEN
      SELECT c.prenda_id, c.talla_id
      INTO v_prenda_id, v_talla_id
      FROM costos c
      WHERE c.id = d.costo_id;
    ELSIF d.prenda_id IS NOT NULL THEN
      SELECT c.prenda_id, c.talla_id
      INTO v_prenda_id, v_talla_id
      FROM costos c
      JOIN tallas t ON t.id = c.talla_id
      WHERE c.prenda_id = d.prenda_id
        AND c.sucursal_id = v_sucursal_id
        AND UPPER(TRIM(t.nombre)) = UPPER(TRIM(d.talla))
      LIMIT 1;
    END IF;

    IF v_prenda_id IS NULL OR v_talla_id IS NULL THEN
      CONTINUE;
    END IF;

    v_pendiente := 0;

    INSERT INTO detalle_pedidos (
      pedido_id,
      prenda_id,
      talla_id,
      cantidad,
      precio_unitario,
      subtotal,
      pendiente,
      especificaciones
    ) VALUES (
      v_pedido_id,
      v_prenda_id,
      v_talla_id,
      d.cantidad,
      d.precio_unitario,
      d.subtotal,
      v_pendiente,
      UPPER(COALESCE(NULLIF(TRIM(d.especificaciones), ''), ''))
    );

    v_lines := v_lines + 1;
  END LOOP;

  IF v_lines = 0 THEN
    DELETE FROM pedidos WHERE id = v_pedido_id;
    RAISE EXCEPTION
      'No se pudo generar el pedido: ninguna partida tiene costo vinculado (costo_id) o prenda+talla reconocibles en esta sucursal.';
  END IF;

  SELECT COALESCE(SUM(subtotal), 0)::NUMERIC(12, 2)
  INTO v_sum_sub
  FROM detalle_pedidos
  WHERE pedido_id = v_pedido_id;

  UPDATE pedidos
  SET
    subtotal = v_sum_sub,
    total = v_sum_sub,
    notas = TRIM(
      COALESCE(notas, '')
      || CASE
          WHEN COALESCE(NEW.incluir_iva, false) OR COALESCE(NEW.incluir_isr, false)
          THEN ' Total documento cotización (impuestos): ' || NEW.total::TEXT
          ELSE ''
        END
    )
  WHERE id = v_pedido_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_devoluciones_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validar_total_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_total_calculado DECIMAL(10, 2);
BEGIN
  -- Calcular total desde detalles
  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_total_calculado
  FROM detalle_pedidos
  WHERE pedido_id = NEW.id;
  
  -- Si el total calculado difiere del total guardado por más de 0.01
  IF ABS(v_total_calculado - COALESCE(NEW.total, 0)) > 0.01 THEN
    RAISE WARNING 'Total del pedido % no coincide: calculado %, guardado %', 
      NEW.id, v_total_calculado, NEW.total;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auditoria_categorias_prendas AFTER INSERT OR DELETE OR UPDATE ON public.categorias_prendas FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_categorias_prendas_updated_at BEFORE UPDATE ON public.categorias_prendas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_compras_insumos AFTER INSERT OR DELETE OR UPDATE ON public.compras_insumos FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_compras_insumos_updated_at BEFORE UPDATE ON public.compras_insumos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_cortes AFTER INSERT OR DELETE OR UPDATE ON public.cortes FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_cortes_updated_at BEFORE UPDATE ON public.cortes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_costo_ubicaciones AFTER INSERT OR DELETE OR UPDATE ON public.costo_ubicaciones FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_costo_ubicaciones_updated_at BEFORE UPDATE ON public.costo_ubicaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_costos AFTER INSERT OR DELETE OR UPDATE ON public.costos FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trigger_costos_updated_at BEFORE UPDATE ON public.costos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER cotizacion_insumos_al_trabajar BEFORE UPDATE OF estado ON public.cotizaciones FOR EACH ROW WHEN ((((new.estado)::text = 'trabajando'::text) AND ((old.estado)::text IS DISTINCT FROM 'trabajando'::text))) EXECUTE FUNCTION trg_cotizacion_insumos_al_trabajar();
CREATE TRIGGER pedido_desde_cotizacion_terminada BEFORE UPDATE OF estado ON public.cotizaciones FOR EACH ROW WHEN ((((new.estado)::text = 'terminado'::text) AND ((old.estado)::text IS DISTINCT FROM 'terminado'::text))) EXECUTE FUNCTION trg_pedido_desde_cotizacion_terminada();
CREATE TRIGGER trg_auditoria_cotizaciones AFTER INSERT OR DELETE OR UPDATE ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_cotizaciones_updated_at BEFORE UPDATE ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_datos_fiscales_cliente AFTER INSERT OR DELETE OR UPDATE ON public.datos_fiscales_cliente FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_datos_fiscales_cliente_updated_at BEFORE UPDATE ON public.datos_fiscales_cliente FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_detalle_cortes AFTER INSERT OR DELETE OR UPDATE ON public.detalle_cortes FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trg_auditoria_detalle_cotizacion AFTER INSERT OR DELETE OR UPDATE ON public.detalle_cotizacion FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trg_auditoria_detalle_devoluciones AFTER INSERT OR DELETE OR UPDATE ON public.detalle_devoluciones FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trg_auditoria_detalle_pedidos AFTER INSERT OR DELETE OR UPDATE ON public.detalle_pedidos FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trg_auditoria_detalle_transferencias AFTER INSERT OR DELETE OR UPDATE ON public.detalle_transferencias FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trg_auditoria_devoluciones AFTER INSERT OR DELETE OR UPDATE ON public.devoluciones FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trigger_update_devoluciones_updated_at BEFORE UPDATE ON public.devoluciones FOR EACH ROW EXECUTE FUNCTION update_devoluciones_updated_at();
CREATE TRIGGER trg_auditoria_externos AFTER INSERT OR DELETE OR UPDATE ON public.externos FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_externos_updated_at BEFORE UPDATE ON public.externos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_insumo_ubicaciones AFTER INSERT OR DELETE OR UPDATE ON public.insumo_ubicaciones FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_insumo_ubicaciones_updated_at BEFORE UPDATE ON public.insumo_ubicaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_insumos AFTER INSERT OR DELETE OR UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_movimientos AFTER INSERT OR DELETE OR UPDATE ON public.movimientos FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trg_auditoria_pedidos AFTER INSERT OR DELETE OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trigger_validar_total_pedido AFTER INSERT OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION validar_total_pedido();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_prenda_talla_insumos AFTER INSERT OR DELETE OR UPDATE ON public.prenda_talla_insumos FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_prenda_talla_insumos_updated_at BEFORE UPDATE ON public.prenda_talla_insumos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_prendas AFTER INSERT OR DELETE OR UPDATE ON public.prendas FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_prendas_updated_at BEFORE UPDATE ON public.prendas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_presentaciones AFTER INSERT OR DELETE OR UPDATE ON public.presentaciones FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_presentaciones_updated_at BEFORE UPDATE ON public.presentaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_roles_uniformes AFTER INSERT OR DELETE OR UPDATE ON public.roles_uniformes FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_roles_uniformes_updated_at BEFORE UPDATE ON public.roles_uniformes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_sat_formas_pago AFTER INSERT OR DELETE OR UPDATE ON public.sat_formas_pago FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_sat_formas_pago_updated_at BEFORE UPDATE ON public.sat_formas_pago FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_sat_metodos_pago AFTER INSERT OR DELETE OR UPDATE ON public.sat_metodos_pago FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_sat_metodos_pago_updated_at BEFORE UPDATE ON public.sat_metodos_pago FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_snapshot_insumos_pedido AFTER INSERT OR DELETE OR UPDATE ON public.snapshot_insumos_pedido FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trg_auditoria_sucursales AFTER INSERT OR DELETE OR UPDATE ON public.sucursales FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_sucursales_updated_at BEFORE UPDATE ON public.sucursales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_tallas AFTER INSERT OR DELETE OR UPDATE ON public.tallas FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_tallas_updated_at BEFORE UPDATE ON public.tallas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_transferencias AFTER INSERT OR DELETE OR UPDATE ON public.transferencias FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trigger_generate_folio_transferencia BEFORE INSERT ON public.transferencias FOR EACH ROW WHEN (((new.folio IS NULL) OR ((new.folio)::text = ''::text))) EXECUTE FUNCTION generate_folio_transferencia();
CREATE TRIGGER update_transferencias_updated_at BEFORE UPDATE ON public.transferencias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_ubicaciones_almacenamiento AFTER INSERT OR DELETE OR UPDATE ON public.ubicaciones_almacenamiento FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_ubicaciones_almacenamiento_updated_at BEFORE UPDATE ON public.ubicaciones_almacenamiento FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER uniformes_migracion_state_update_timestamp BEFORE UPDATE ON public.uniformes_migracion_state FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER trg_auditoria_usuario_perfil AFTER INSERT OR DELETE OR UPDATE ON public.usuario_perfil FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER trg_auditoria_usuarios AFTER INSERT OR DELETE OR UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditoria_usuarios_uniformes AFTER INSERT OR DELETE OR UPDATE ON public.usuarios_uniformes FOR EACH ROW EXECUTE FUNCTION trg_auditoria_generic();
CREATE TRIGGER update_usuarios_uniformes_updated_at BEFORE UPDATE ON public.usuarios_uniformes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
