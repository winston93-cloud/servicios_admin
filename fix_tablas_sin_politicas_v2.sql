-- =====================================================
-- CREAR POLÍTICAS PARA TABLAS SIN POLÍTICAS (v2)
-- =====================================================
-- Version mejorada: elimina políticas existentes primero

-- Tabla: desayunos_saldo
DROP POLICY IF EXISTS "Allow public access" ON public.desayunos_saldo;
CREATE POLICY "Allow public access" 
  ON public.desayunos_saldo 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Tabla: kommo_lead_tracking
DROP POLICY IF EXISTS "Allow public access" ON public.kommo_lead_tracking;
CREATE POLICY "Allow public access" 
  ON public.kommo_lead_tracking 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Tabla: usuarios
DROP POLICY IF EXISTS "Allow public access" ON public.usuarios;
CREATE POLICY "Allow public access" 
  ON public.usuarios 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Verificar que se crearon
SELECT 
  tablename,
  policyname,
  'OK' as status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('desayunos_saldo', 'kommo_lead_tracking', 'usuarios')
ORDER BY tablename;
