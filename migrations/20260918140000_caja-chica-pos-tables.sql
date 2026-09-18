-- Caja Chica (Monitoreo y Control / cchic) → Winston Servicios
-- Solo CREATE IF NOT EXISTS. No ALTER/UPDATE/DELETE de tablas prod existentes.
-- No reemplaza update_updated_at_column (ya en Winston).

-- Caja Chica (cChic) — esquema inicial para InsForge
-- Consolidado desde Supabase producción

-- update_updated_at_column ya existe en Winston; no se reemplaza.

-- Categorías
CREATE TABLE IF NOT EXISTS public.categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#4da6ff',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Personas
CREATE TABLE IF NOT EXISTS public.persons (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  last_name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  identification TEXT,
  department TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Ejecutores
CREATE TABLE IF NOT EXISTS public.executors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  identification TEXT UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Subcategorías
CREATE TABLE IF NOT EXISTS public.subcategories (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#4da6ff',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(category_id, name)
);

-- Fondos
CREATE TABLE IF NOT EXISTS public.funds (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_by TEXT,
  person_id BIGINT REFERENCES public.persons(id) ON DELETE SET NULL,
  voucher_number TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Gastos
CREATE TABLE IF NOT EXISTS public.expenses (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  correspondent_to TEXT,
  executor TEXT NOT NULL,
  executor_id BIGINT REFERENCES public.executors(id) ON DELETE SET NULL,
  category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id BIGINT REFERENCES public.subcategories(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  voucher_number TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'approved')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Relación persona-categorías
CREATE TABLE IF NOT EXISTS public.person_categories (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT REFERENCES public.persons(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(person_id, category_id)
);

-- Períodos personalizados
CREATE TABLE IF NOT EXISTS public.custom_periods (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT unique_active_period UNIQUE (year, month, active),
  CONSTRAINT check_date_range CHECK (end_date > start_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_executor_text ON public.expenses(executor);
CREATE INDEX IF NOT EXISTS idx_expenses_executor_id ON public.expenses(executor_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_subcategory ON public.expenses(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_funds_date ON public.funds(date DESC);
CREATE INDEX IF NOT EXISTS idx_funds_person ON public.funds(person_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON public.subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_name ON public.subcategories(name);
CREATE INDEX IF NOT EXISTS idx_subcategories_active ON public.subcategories(active);
CREATE INDEX IF NOT EXISTS idx_executors_name ON public.executors(name);
CREATE INDEX IF NOT EXISTS idx_executors_active ON public.executors(active);
CREATE INDEX IF NOT EXISTS idx_executors_identification ON public.executors(identification);
CREATE INDEX IF NOT EXISTS idx_person_categories_person ON public.person_categories(person_id);
CREATE INDEX IF NOT EXISTS idx_person_categories_category ON public.person_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_custom_periods_year_month ON public.custom_periods(year, month);
CREATE INDEX IF NOT EXISTS idx_custom_periods_active ON public.custom_periods(active);
CREATE INDEX IF NOT EXISTS idx_custom_periods_dates ON public.custom_periods(start_date, end_date);

-- Triggers updated_at
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_persons_updated_at ON public.persons;
CREATE TRIGGER update_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_funds_updated_at ON public.funds;
CREATE TRIGGER update_funds_updated_at
  BEFORE UPDATE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS subcategories_updated_at ON public.subcategories;
CREATE TRIGGER subcategories_updated_at
  BEFORE UPDATE ON public.subcategories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS executors_updated_at ON public.executors;
CREATE TRIGGER executors_updated_at
  BEFORE UPDATE ON public.executors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS custom_periods_updated_at ON public.custom_periods;
CREATE TRIGGER custom_periods_updated_at
  BEFORE UPDATE ON public.custom_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vistas
CREATE OR REPLACE VIEW public.v_balance AS
SELECT
  COALESCE(SUM(f.amount), 0) AS total_funds,
  COALESCE(SUM(e.amount), 0) AS total_expenses,
  COALESCE(SUM(f.amount), 0) - COALESCE(SUM(e.amount), 0) AS balance
FROM public.funds f
FULL OUTER JOIN public.expenses e ON true
WHERE e.status = 'active' OR e.status IS NULL;

CREATE OR REPLACE VIEW public.v_expenses_by_category AS
SELECT
  c.name AS category_name,
  c.icon AS category_icon,
  c.color AS category_color,
  COUNT(e.id) AS count,
  COALESCE(SUM(e.amount), 0) AS total,
  COALESCE(AVG(e.amount), 0) AS average
FROM public.categories c
LEFT JOIN public.expenses e ON c.id = e.category_id AND e.status = 'active'
GROUP BY c.id, c.name, c.icon, c.color
ORDER BY total DESC;

CREATE OR REPLACE VIEW public.v_expenses_by_person AS
SELECT
  e.executor,
  COUNT(e.id) AS count,
  COALESCE(SUM(e.amount), 0) AS total,
  COALESCE(AVG(e.amount), 0) AS average
FROM public.expenses e
WHERE e.status = 'active'
GROUP BY e.executor
ORDER BY total DESC;

CREATE OR REPLACE VIEW public.v_expenses_by_person_category AS
SELECT
  e.executor,
  c.name AS category_name,
  c.icon AS category_icon,
  COUNT(e.id) AS count,
  COALESCE(SUM(e.amount), 0) AS total,
  COALESCE(AVG(e.amount), 0) AS average
FROM public.expenses e
LEFT JOIN public.categories c ON e.category_id = c.id
WHERE e.status = 'active'
GROUP BY e.executor, c.name, c.icon
ORDER BY e.executor, total DESC;

CREATE OR REPLACE VIEW public.expense_details AS
SELECT
  e.id,
  e.date,
  e.amount,
  e.correspondent_to,
  e.executor,
  e.executor_id,
  e.voucher_number,
  e.notes,
  e.status,
  e.created_at,
  e.updated_at,
  e.category_id,
  c.name AS category_name,
  c.icon AS category_icon,
  c.color AS category_color,
  e.subcategory_id,
  s.name AS subcategory_name,
  s.icon AS subcategory_icon,
  s.color AS subcategory_color,
  e.correspondent_to AS person_name,
  NULL::text AS person_identification,
  ex.name AS executor_name,
  ex.identification AS executor_identification
FROM public.expenses e
LEFT JOIN public.categories c ON e.category_id = c.id
LEFT JOIN public.subcategories s ON e.subcategory_id = s.id
LEFT JOIN public.executors ex ON e.executor_id = ex.id;

-- Función períodos
CREATE OR REPLACE FUNCTION public.get_month_limits(p_year INTEGER, p_month INTEGER)
RETURNS TABLE(start_date DATE, end_date DATE, is_custom BOOLEAN) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_custom_exists BOOLEAN;
BEGIN
  SELECT cp.start_date, cp.end_date, true
  INTO v_start_date, v_end_date, v_custom_exists
  FROM public.custom_periods cp
  WHERE cp.year = p_year
    AND cp.month = p_month
    AND cp.active = true
  LIMIT 1;

  IF v_start_date IS NULL THEN
    v_start_date := DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01');
    v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;
    v_custom_exists := false;
  END IF;

  RETURN QUERY SELECT v_start_date, v_end_date, v_custom_exists;
END;
$$ LANGUAGE plpgsql;

-- RLS (acceso abierto — app interna con API key admin)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for categories" ON public.categories;
CREATE POLICY "Enable all for categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for persons" ON public.persons;
CREATE POLICY "Enable all for persons" ON public.persons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for funds" ON public.funds;
CREATE POLICY "Enable all for funds" ON public.funds FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for expenses" ON public.expenses;
CREATE POLICY "Enable all for expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for subcategories" ON public.subcategories;
CREATE POLICY "Enable all for subcategories" ON public.subcategories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for executors" ON public.executors;
CREATE POLICY "Enable all for executors" ON public.executors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for person_categories" ON public.person_categories;
CREATE POLICY "Enable all for person_categories" ON public.person_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for custom_periods" ON public.custom_periods;
CREATE POLICY "Enable all for custom_periods" ON public.custom_periods FOR ALL USING (true) WITH CHECK (true);
