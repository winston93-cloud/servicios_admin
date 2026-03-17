-- =====================================================
-- COMPLETAR search_path EN FUNCIONES RESTANTES
-- =====================================================

ALTER FUNCTION public.crear_pedido_atomico(p_tipo_cliente character varying, p_cliente_nombre character varying, p_sucursal_id uuid, p_usuario_id smallint, p_alumno_id uuid, p_externo_id uuid, p_estado character varying, p_notas text, p_detalles jsonb) SET search_path = public, pg_temp;

ALTER FUNCTION public.generar_folio_cotizacion() SET search_path = public, pg_temp;

ALTER FUNCTION public.generar_referencia_alumno() SET search_path = public, pg_temp;

ALTER FUNCTION public.get_month_limits(p_year integer, p_month integer) SET search_path = public, pg_temp;

ALTER FUNCTION public.login_usuario(p_username character varying, p_password character varying) SET search_path = public, pg_temp;

ALTER FUNCTION public.procesar_devolucion_atomica(p_devolucion_id uuid) SET search_path = public, pg_temp;

ALTER FUNCTION public.validar_total_pedido() SET search_path = public, pg_temp;
