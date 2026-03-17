-- =====================================================
-- VERIFICAR ESTADO DE POLÍTICAS RLS
-- =====================================================

-- Ver si las tablas tienen políticas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operacion
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('desayunos_saldo', 'kommo_lead_tracking', 'usuarios')
ORDER BY tablename, policyname;

-- Si no aparece nada, las políticas no se crearon.
-- Si aparece "ERROR: relation does not exist", la tabla no existe.
