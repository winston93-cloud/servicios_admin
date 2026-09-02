-- News por audiencia (educativo / primaria / secundaria); desayunos global (audiencia vacía).

ALTER TABLE public.portal_news_desayunos
  ADD COLUMN IF NOT EXISTS audiencia VARCHAR(20) NOT NULL DEFAULT '';

UPDATE public.portal_news_desayunos
SET audiencia = 'educativo'
WHERE tipo = 'news' AND audiencia = '';

ALTER TABLE public.portal_news_desayunos
  DROP CONSTRAINT IF EXISTS portal_news_desayunos_tipo_mes_unique;

ALTER TABLE public.portal_news_desayunos
  DROP CONSTRAINT IF EXISTS portal_news_desayunos_tipo_audiencia_mes_unique;

ALTER TABLE public.portal_news_desayunos
  ADD CONSTRAINT portal_news_desayunos_tipo_audiencia_mes_unique
  UNIQUE (tipo, audiencia, anio, mes);

ALTER TABLE public.portal_news_desayunos
  DROP CONSTRAINT IF EXISTS portal_news_desayunos_audiencia_chk;

ALTER TABLE public.portal_news_desayunos
  ADD CONSTRAINT portal_news_desayunos_audiencia_chk CHECK (
    (tipo = 'news' AND audiencia IN ('educativo', 'primaria', 'secundaria'))
    OR (tipo = 'desayunos' AND audiencia = '')
  );
