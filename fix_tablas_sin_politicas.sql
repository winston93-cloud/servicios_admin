-- =====================================================
-- CREAR POLÍTICAS PARA TABLAS CON RLS SIN POLÍTICAS
-- =====================================================
-- Estas tablas tienen RLS habilitado pero sin políticas.
-- Actualmente NADIE puede acceder a ellas.

-- Tabla: desayunos_saldo
CREATE POLICY "Allow public access" 
  ON public.desayunos_saldo 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Tabla: kommo_lead_tracking
CREATE POLICY "Allow public access" 
  ON public.kommo_lead_tracking 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Tabla: usuarios
CREATE POLICY "Allow public access" 
  ON public.usuarios 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
