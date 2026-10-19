-- Uniformes (InsForge q488j9fg) → Winston Servicios: tablas, llaves, RLS y políticas.
-- Generado por scripts/generar-esquema-uniformes-winston.mjs. Solo crea objetos nuevos; no toca tablas de Winston.

CREATE SEQUENCE IF NOT EXISTS public.cotizacion_folio_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.devoluciones_folio_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;

CREATE TABLE public.auditoria (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tabla character varying(100) NOT NULL,
  operacion character varying(20) NOT NULL,
  registro_id uuid,
  registro_pk text,
  registro_pk_col text,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  usuario_id smallint,
  timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT auditoria_pkey PRIMARY KEY (id)
);
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total auditoria" ON public.auditoria AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.categorias_prendas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(100) NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categorias_prendas_pkey PRIMARY KEY (id),
  CONSTRAINT categorias_prendas_nombre_key UNIQUE (nombre)
);
ALTER TABLE public.categorias_prendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY categorias_prendas_all ON public.categorias_prendas AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.compras_insumos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  insumo_id uuid NOT NULL,
  cantidad_comprada numeric(10,2) NOT NULL,
  costo_unitario numeric(10,2),
  costo_total numeric(10,2),
  proveedor character varying(255),
  fecha_compra date DEFAULT CURRENT_DATE NOT NULL,
  notas text,
  usuario_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT compras_insumos_cantidad_comprada_check CHECK ((cantidad_comprada > (0)::numeric)),
  CONSTRAINT compras_insumos_pkey PRIMARY KEY (id)
);
ALTER TABLE public.compras_insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY compras_insumos_all ON public.compras_insumos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.conjunto_precios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conjunto_id uuid NOT NULL,
  talla_id uuid NOT NULL,
  precio_mayoreo numeric(10,2) DEFAULT 0 NOT NULL,
  precio_menudeo numeric(10,2) DEFAULT 0 NOT NULL,
  precio_venta numeric(10,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT conjunto_precios_pkey PRIMARY KEY (id),
  CONSTRAINT conjunto_precios_unico UNIQUE (conjunto_id, talla_id)
);
ALTER TABLE public.conjunto_precios ENABLE ROW LEVEL SECURITY;
CREATE POLICY conjunto_precios_all ON public.conjunto_precios AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.conjuntos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(120) NOT NULL,
  codigo character varying(40),
  prenda_a_id uuid NOT NULL,
  prenda_b_id uuid NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  notas text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT conjuntos_prendas_distintas CHECK ((prenda_a_id <> prenda_b_id)),
  CONSTRAINT conjuntos_pkey PRIMARY KEY (id),
  CONSTRAINT conjuntos_par_unico UNIQUE (prenda_a_id, prenda_b_id)
);
ALTER TABLE public.conjuntos ENABLE ROW LEVEL SECURITY;
CREATE POLICY conjuntos_all ON public.conjuntos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.cortes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  fecha timestamp with time zone DEFAULT now(),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  total_ventas numeric(10,2) DEFAULT 0,
  total_pedidos integer DEFAULT 0,
  usuario_id uuid,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sucursal_id uuid,
  linea_venta character varying(20),
  CONSTRAINT cortes_pkey PRIMARY KEY (id)
);
ALTER TABLE public.cortes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total cortes" ON public.cortes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.costo_ubicaciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  costo_id uuid NOT NULL,
  ubicacion_almacenamiento_id uuid NOT NULL,
  cantidad integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT costo_ubicaciones_cantidad_check CHECK ((cantidad >= 0)),
  CONSTRAINT costo_ubicaciones_pkey PRIMARY KEY (id),
  CONSTRAINT uq_costo_ubicacion UNIQUE (costo_id, ubicacion_almacenamiento_id)
);
ALTER TABLE public.costo_ubicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY costo_ubicaciones_all ON public.costo_ubicaciones AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.costos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  talla_id uuid NOT NULL,
  prenda_id uuid NOT NULL,
  sucursal_id uuid NOT NULL,
  precio_venta numeric(10,2) DEFAULT 0 NOT NULL,
  precio_compra numeric(10,2) DEFAULT 0,
  precio_mayoreo numeric(10,2) DEFAULT 0,
  precio_menudeo numeric(10,2) DEFAULT 0,
  stock_inicial integer DEFAULT 0,
  stock integer DEFAULT 0,
  cantidad_venta integer DEFAULT 0,
  stock_minimo integer DEFAULT 0,
  ubicacion_almacenamiento_id uuid,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT costos_stock_check CHECK ((stock >= 0)),
  CONSTRAINT costos_pkey PRIMARY KEY (id),
  CONSTRAINT costos_prenda_talla_sucursal_key UNIQUE (prenda_id, talla_id, sucursal_id)
);
ALTER TABLE public.costos ENABLE ROW LEVEL SECURITY;
CREATE POLICY costos_all ON public.costos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.cotizaciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  folio character varying(50) NOT NULL,
  alumno_id text,
  externo_id uuid,
  tipo_cliente character varying(20) NOT NULL,
  fecha_cotizacion date DEFAULT CURRENT_DATE NOT NULL,
  fecha_vigencia date,
  subtotal numeric(10,2) DEFAULT 0 NOT NULL,
  total numeric(10,2) DEFAULT 0 NOT NULL,
  observaciones text,
  condiciones_pago text,
  tiempo_entrega character varying(100),
  fecha_entrega date,
  pdf_url text,
  estado character varying(20) DEFAULT 'emitido'::character varying,
  incluir_iva boolean DEFAULT false NOT NULL,
  incluir_isr boolean DEFAULT false NOT NULL,
  insumos_trabajando_aplicado boolean DEFAULT false NOT NULL,
  metodo_pago_id uuid,
  forma_pago_id uuid,
  metodo_pago_pdf character varying(200),
  forma_pago_pdf character varying(200),
  usuario_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cotizaciones_check_cliente CHECK ((((alumno_id IS NOT NULL) AND (externo_id IS NULL)) OR ((alumno_id IS NULL) AND (externo_id IS NOT NULL)))),
  CONSTRAINT cotizaciones_estado_check CHECK (((estado)::text = ANY (ARRAY[('en_proceso'::character varying)::text, ('emitido'::character varying)::text, ('aprobado'::character varying)::text, ('trabajando'::character varying)::text, ('terminado'::character varying)::text]))),
  CONSTRAINT cotizaciones_tipo_cliente_check CHECK (((tipo_cliente)::text = ANY (ARRAY[('alumno'::character varying)::text, ('externo'::character varying)::text]))),
  CONSTRAINT cotizaciones_pkey PRIMARY KEY (id),
  CONSTRAINT cotizaciones_folio_key UNIQUE (folio)
);
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total cotizaciones" ON public.cotizaciones AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.datos_fiscales_cliente (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  alumno_id text,
  externo_id uuid,
  rfc text NOT NULL,
  nombre_fiscal text NOT NULL,
  regimen_fiscal text NOT NULL,
  codigo_postal text NOT NULL,
  uso_cfdi text DEFAULT 'G03'::text NOT NULL,
  email_fiscal text,
  constancia_pdf_path text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT datos_fiscales_cp_len CHECK ((char_length(TRIM(BOTH FROM codigo_postal)) = 5)),
  CONSTRAINT datos_fiscales_un_solo_cliente CHECK ((((alumno_id IS NOT NULL) AND (externo_id IS NULL)) OR ((alumno_id IS NULL) AND (externo_id IS NOT NULL)))),
  CONSTRAINT datos_fiscales_cliente_pkey PRIMARY KEY (id)
);
ALTER TABLE public.datos_fiscales_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total datos_fiscales_cliente" ON public.datos_fiscales_cliente AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.detalle_cortes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  corte_id uuid,
  pedido_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT detalle_cortes_pkey PRIMARY KEY (id)
);
ALTER TABLE public.detalle_cortes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total detalle_cortes" ON public.detalle_cortes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.detalle_cotizacion (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cotizacion_id uuid NOT NULL,
  prenda_nombre character varying(255) NOT NULL,
  talla character varying(50) NOT NULL,
  color character varying(100),
  especificaciones text,
  cantidad integer NOT NULL,
  precio_unitario numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  orden integer DEFAULT 1,
  tipo_precio_usado character varying(10) DEFAULT 'menudeo'::character varying NOT NULL,
  prenda_id uuid,
  costo_id uuid,
  es_manual boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT detalle_cotizacion_cantidad_check CHECK ((cantidad > 0)),
  CONSTRAINT detalle_cotizacion_precio_unitario_check CHECK ((precio_unitario >= (0)::numeric)),
  CONSTRAINT detalle_cotizacion_subtotal_check CHECK ((subtotal >= (0)::numeric)),
  CONSTRAINT detalle_cotizacion_tipo_precio_usado_check CHECK (((tipo_precio_usado)::text = ANY (ARRAY[('mayoreo'::character varying)::text, ('menudeo'::character varying)::text]))),
  CONSTRAINT detalle_cotizacion_pkey PRIMARY KEY (id)
);
ALTER TABLE public.detalle_cotizacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total detalle_cotizacion" ON public.detalle_cotizacion AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.detalle_devoluciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  devolucion_id uuid NOT NULL,
  detalle_pedido_id uuid NOT NULL,
  prenda_id uuid NOT NULL,
  talla_id uuid NOT NULL,
  cantidad_devuelta integer NOT NULL,
  precio_unitario numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  es_cambio boolean DEFAULT false,
  prenda_cambio_id uuid,
  talla_cambio_id uuid,
  cantidad_cambio integer,
  precio_cambio numeric(10,2),
  observaciones_detalle text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT detalle_devoluciones_cantidad_devuelta_check CHECK ((cantidad_devuelta > 0)),
  CONSTRAINT detalle_devoluciones_pkey PRIMARY KEY (id)
);
ALTER TABLE public.detalle_devoluciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total detalle_devoluciones" ON public.detalle_devoluciones AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.detalle_pedidos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pedido_id uuid NOT NULL,
  costo_id uuid,
  prenda_id uuid,
  talla_id uuid,
  cantidad integer NOT NULL,
  precio_unitario numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  pendiente integer DEFAULT 0,
  especificaciones text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT detalle_pedidos_cantidad_check CHECK ((cantidad > 0)),
  CONSTRAINT detalle_pedidos_pendiente_check CHECK ((pendiente >= 0)),
  CONSTRAINT detalle_pedidos_pkey PRIMARY KEY (id)
);
ALTER TABLE public.detalle_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total detalle_pedidos" ON public.detalle_pedidos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.detalle_transferencias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transferencia_id uuid NOT NULL,
  prenda_id uuid NOT NULL,
  talla_id uuid NOT NULL,
  cantidad integer NOT NULL,
  costo_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  estado character varying(40) DEFAULT 'EN_TRANSITO'::character varying,
  CONSTRAINT detalle_transferencias_cantidad_check CHECK ((cantidad > 0)),
  CONSTRAINT detalle_transferencias_pkey PRIMARY KEY (id)
);
ALTER TABLE public.detalle_transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total detalle_transferencias" ON public.detalle_transferencias AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.devoluciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  folio integer DEFAULT nextval('devoluciones_folio_seq'::regclass) NOT NULL,
  pedido_id uuid NOT NULL,
  sucursal_id uuid NOT NULL,
  usuario_id smallint NOT NULL,
  tipo_devolucion character varying(20) NOT NULL,
  motivo character varying(100) NOT NULL,
  observaciones text,
  total_devolucion numeric(10,2) DEFAULT 0 NOT NULL,
  reembolso_aplicado boolean DEFAULT false,
  monto_reembolsado numeric(10,2) DEFAULT 0,
  estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT devoluciones_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('PROCESADA'::character varying)::text, ('CANCELADA'::character varying)::text]))),
  CONSTRAINT devoluciones_tipo_devolucion_check CHECK (((tipo_devolucion)::text = ANY (ARRAY[('COMPLETA'::character varying)::text, ('PARCIAL'::character varying)::text, ('CAMBIO_TALLA'::character varying)::text, ('CAMBIO_PRENDA'::character varying)::text]))),
  CONSTRAINT devoluciones_pkey PRIMARY KEY (id),
  CONSTRAINT devoluciones_folio_key UNIQUE (folio)
);
ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total devoluciones" ON public.devoluciones AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.empresas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre text NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT empresas_pkey PRIMARY KEY (id),
  CONSTRAINT empresas_nombre_unique UNIQUE (nombre)
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresas_all ON public.empresas AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.externos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(255) NOT NULL,
  telefono character varying(20),
  email character varying(255),
  direccion text,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT externos_pkey PRIMARY KEY (id)
);
ALTER TABLE public.externos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a externos" ON public.externos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.gastos_fijos_catalogo (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(255) NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT gastos_fijos_catalogo_pkey PRIMARY KEY (id),
  CONSTRAINT gastos_fijos_catalogo_nombre_key UNIQUE (nombre)
);
ALTER TABLE public.gastos_fijos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY gastos_fijos_catalogo_all ON public.gastos_fijos_catalogo AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.gastos_fijos_semanales (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  semana_id uuid NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT gastos_fijos_semanales_pkey PRIMARY KEY (id),
  CONSTRAINT gastos_fijos_semanales_semana_id_key UNIQUE (semana_id)
);
ALTER TABLE public.gastos_fijos_semanales ENABLE ROW LEVEL SECURITY;
CREATE POLICY gastos_fijos_semanales_all ON public.gastos_fijos_semanales AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.gastos_fijos_semanales_detalle (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  gastos_fijos_semanales_id uuid NOT NULL,
  gasto_fijo_catalogo_id uuid NOT NULL,
  monto numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT gastos_fijos_semanales_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT gastos_fijos_semanales_detall_gastos_fijos_semanales_id_gas_key UNIQUE (gastos_fijos_semanales_id, gasto_fijo_catalogo_id)
);
ALTER TABLE public.gastos_fijos_semanales_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY gastos_fijos_semanales_detalle_all ON public.gastos_fijos_semanales_detalle AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.insumo_ubicaciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  insumo_id uuid NOT NULL,
  ubicacion_almacenamiento_id uuid NOT NULL,
  cantidad numeric(10,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT insumo_ubicaciones_cantidad_check CHECK ((cantidad >= (0)::numeric)),
  CONSTRAINT insumo_ubicaciones_pkey PRIMARY KEY (id),
  CONSTRAINT uq_insumo_ubicacion UNIQUE (insumo_id, ubicacion_almacenamiento_id)
);
ALTER TABLE public.insumo_ubicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY insumo_ubicaciones_all ON public.insumo_ubicaciones AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.insumos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  codigo character varying(50) NOT NULL,
  nombre character varying(255) NOT NULL,
  descripcion text,
  presentacion_id uuid,
  cantidad_por_presentacion numeric(10,2) DEFAULT 0 NOT NULL,
  unidad_medida character varying(80) DEFAULT 'unidades'::character varying NOT NULL,
  costo_compra numeric(10,2) DEFAULT 0 NOT NULL,
  stock_inicial numeric(10,2) DEFAULT 0,
  stock numeric(10,2) DEFAULT 0,
  ubicacion_almacenamiento_id uuid,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  stock_minimo numeric(10,2) DEFAULT 0,
  CONSTRAINT insumos_pkey PRIMARY KEY (id),
  CONSTRAINT insumos_codigo_key UNIQUE (codigo)
);
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY insumos_all ON public.insumos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.movimientos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tipo character varying(20) NOT NULL,
  costo_id uuid NOT NULL,
  cantidad integer NOT NULL,
  observaciones text,
  usuario_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT movimientos_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('ENTRADA'::character varying)::text, ('SALIDA'::character varying)::text, ('AJUSTE'::character varying)::text]))),
  CONSTRAINT movimientos_pkey PRIMARY KEY (id)
);
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total movimientos" ON public.movimientos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.pedidos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  folio character varying(50),
  cotizacion_id uuid,
  alumno_id text,
  externo_id uuid,
  tipo_cliente character varying(20) NOT NULL,
  cliente_nombre character varying(255),
  sucursal_id uuid NOT NULL,
  estado character varying(20) DEFAULT 'PENDIENTE'::character varying,
  subtotal numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  fecha_entrega timestamp with time zone,
  fecha_liquidacion timestamp with time zone,
  notas text,
  observaciones text,
  modalidad_pago character varying(20) DEFAULT 'TOTAL'::character varying,
  efectivo_recibido numeric(10,2) DEFAULT 0,
  usuario_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  linea_venta character varying(20),
  CONSTRAINT pedidos_check_total_positivo CHECK (((total > (0)::numeric) AND (subtotal > (0)::numeric))),
  CONSTRAINT pedidos_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('COMPLETADO'::character varying)::text, ('CANCELADO'::character varying)::text, ('CANCELADO_PARCIAL'::character varying)::text]))),
  CONSTRAINT pedidos_modalidad_pago_check CHECK (((modalidad_pago)::text = ANY (ARRAY[('TOTAL'::character varying)::text, ('ANTICIPO'::character varying)::text]))),
  CONSTRAINT pedidos_tipo_cliente_check CHECK (((tipo_cliente)::text = ANY (ARRAY[('alumno'::character varying)::text, ('externo'::character varying)::text]))),
  CONSTRAINT pedidos_pkey PRIMARY KEY (id)
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total pedidos" ON public.pedidos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.prenda_talla_insumos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  prenda_id uuid NOT NULL,
  talla_id uuid NOT NULL,
  insumo_id uuid NOT NULL,
  cantidad numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prenda_talla_insumos_cantidad_check CHECK ((cantidad > (0)::numeric)),
  CONSTRAINT prenda_talla_insumos_pkey PRIMARY KEY (id),
  CONSTRAINT prenda_talla_insumos_prenda_id_talla_id_insumo_id_key UNIQUE (prenda_id, talla_id, insumo_id)
);
ALTER TABLE public.prenda_talla_insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY prenda_talla_insumos_all ON public.prenda_talla_insumos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.prendas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(255) NOT NULL,
  codigo character varying(100),
  descripcion text,
  categoria_id uuid,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  empresa_id uuid,
  CONSTRAINT prendas_pkey PRIMARY KEY (id),
  CONSTRAINT prendas_codigo_key UNIQUE (codigo)
);
ALTER TABLE public.prendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY prendas_all ON public.prendas AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.presentaciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(100) NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT presentaciones_pkey PRIMARY KEY (id),
  CONSTRAINT presentaciones_nombre_key UNIQUE (nombre)
);
ALTER TABLE public.presentaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY presentaciones_all ON public.presentaciones AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.produccion_plan_semanal (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  semana_id uuid NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  gastos_fijos_total numeric DEFAULT 0 NOT NULL,
  ganancias_total numeric DEFAULT 0 NOT NULL,
  estado character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT produccion_plan_semanal_pkey PRIMARY KEY (id),
  CONSTRAINT produccion_plan_semanal_semana_id_key UNIQUE (semana_id)
);
ALTER TABLE public.produccion_plan_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY produccion_plan_all ON public.produccion_plan_semanal AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.produccion_plan_semanal_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid NOT NULL,
  cotizacion_id text NOT NULL,
  cotizacion_folio text NOT NULL,
  detalle_id text NOT NULL,
  modelo text NOT NULL,
  piezas integer NOT NULL,
  precio_unitario numeric DEFAULT 0 NOT NULL,
  costo_unitario numeric DEFAULT 0 NOT NULL,
  ganancia_unitaria numeric DEFAULT 0 NOT NULL,
  ganancia_total numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT produccion_plan_semanal_items_pkey PRIMARY KEY (id),
  CONSTRAINT produccion_plan_semanal_items_plan_id_detalle_id_key UNIQUE (plan_id, detalle_id)
);
ALTER TABLE public.produccion_plan_semanal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY produccion_plan_items_all ON public.produccion_plan_semanal_items AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.roles_uniformes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  orden integer DEFAULT 0 NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT roles_uniformes_pkey PRIMARY KEY (id),
  CONSTRAINT roles_uniformes_nombre_unique UNIQUE (nombre)
);
ALTER TABLE public.roles_uniformes ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_uniformes_select_catalogo ON public.roles_uniformes AS PERMISSIVE FOR SELECT TO public USING ((activo = true));

CREATE TABLE public.sat_formas_pago (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clave character varying(10) NOT NULL,
  descripcion character varying(200) NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  orden integer DEFAULT 0 NOT NULL,
  es_default boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sat_formas_pago_pkey PRIMARY KEY (id),
  CONSTRAINT sat_formas_pago_clave_unique UNIQUE (clave)
);
ALTER TABLE public.sat_formas_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total sat_formas_pago" ON public.sat_formas_pago AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.sat_metodos_pago (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clave character varying(10) NOT NULL,
  descripcion character varying(200) NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  orden integer DEFAULT 0 NOT NULL,
  es_default boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sat_metodos_pago_pkey PRIMARY KEY (id),
  CONSTRAINT sat_metodos_pago_clave_unique UNIQUE (clave)
);
ALTER TABLE public.sat_metodos_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total sat_metodos_pago" ON public.sat_metodos_pago AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.semanas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  fecha_inicio date NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT semanas_pkey PRIMARY KEY (id),
  CONSTRAINT semanas_fecha_inicio_key UNIQUE (fecha_inicio)
);
ALTER TABLE public.semanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY gastos_fijos_semanas_all ON public.semanas AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.snapshot_insumos_pedido (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  detalle_pedido_id uuid NOT NULL,
  prenda_id uuid NOT NULL,
  talla_id uuid NOT NULL,
  insumo_id uuid NOT NULL,
  insumo_nombre character varying(255) NOT NULL,
  cantidad_insumo numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT snapshot_insumos_pedido_pkey PRIMARY KEY (id)
);
ALTER TABLE public.snapshot_insumos_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total snapshot_insumos_pedido" ON public.snapshot_insumos_pedido AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.sucursales (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  codigo character varying(20) NOT NULL,
  nombre character varying(100) NOT NULL,
  direccion text,
  telefono character varying(20),
  es_matriz boolean DEFAULT false,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sucursales_pkey PRIMARY KEY (id),
  CONSTRAINT sucursales_codigo_key UNIQUE (codigo)
);
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sucursales_all ON public.sucursales AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.tallas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(50) NOT NULL,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tallas_pkey PRIMARY KEY (id),
  CONSTRAINT tallas_nombre_key UNIQUE (nombre)
);
ALTER TABLE public.tallas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tallas_all ON public.tallas AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.transferencias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  folio character varying(20) NOT NULL,
  sucursal_origen_id uuid NOT NULL,
  sucursal_destino_id uuid NOT NULL,
  usuario_id smallint,
  fecha_transferencia timestamp with time zone DEFAULT now(),
  estado character varying(40) DEFAULT 'PENDIENTE'::character varying,
  observaciones text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_token uuid,
  CONSTRAINT check_sucursales_diferentes CHECK ((sucursal_origen_id <> sucursal_destino_id)),
  CONSTRAINT transferencias_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('EN_TRANSITO'::character varying)::text, ('RECIBIDA'::character varying)::text, ('RECIBIDA_PARCIAL'::character varying)::text, ('CANCELADA'::character varying)::text]))),
  CONSTRAINT transferencias_pkey PRIMARY KEY (id),
  CONSTRAINT transferencias_folio_key UNIQUE (folio)
);
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total transferencias" ON public.transferencias AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.ubicaciones_almacenamiento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(100) NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT ubicaciones_almacenamiento_pkey PRIMARY KEY (id),
  CONSTRAINT ubicaciones_almacenamiento_nombre_key UNIQUE (nombre)
);
ALTER TABLE public.ubicaciones_almacenamiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY ubicaciones_all ON public.ubicaciones_almacenamiento AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.uniformes_migracion_state (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  baseline_ts timestamp with time zone,
  last_applied_ts timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uniformes_migracion_state_pkey PRIMARY KEY (id),
  CONSTRAINT uniformes_migracion_state_key_key UNIQUE (key)
);

CREATE TABLE public.usuario_perfil (
  perfil_id smallint NOT NULL,
  perfil_clase character varying NOT NULL,
  CONSTRAINT usuario_perfil_pkey PRIMARY KEY (perfil_id)
);

CREATE TABLE public.usuarios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre character varying(255) NOT NULL,
  apellido_p character varying(255),
  apellido_m character varying(255),
  usuario character varying(100) NOT NULL,
  password text NOT NULL,
  tipo integer DEFAULT 1,
  email character varying(255),
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_usuario_key UNIQUE (usuario)
);
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total usuarios" ON public.usuarios AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE public.usuarios_uniformes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre text NOT NULL,
  correo text NOT NULL,
  rol_id uuid NOT NULL,
  estado text DEFAULT 'pendiente_validacion'::text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  usuario text NOT NULL,
  password_hash text NOT NULL,
  sucursal_id uuid,
  CONSTRAINT usuarios_uniformes_estado_check CHECK ((estado = ANY (ARRAY['pendiente_validacion'::text, 'activo'::text, 'inactivo'::text]))),
  CONSTRAINT usuarios_uniformes_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_uniformes_correo_unique UNIQUE (correo),
  CONSTRAINT usuarios_uniformes_usuario_unique UNIQUE (usuario)
);
ALTER TABLE public.usuarios_uniformes ENABLE ROW LEVEL SECURITY;
CREATE POLICY usuarios_uniformes_crud_provisional ON public.usuarios_uniformes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

