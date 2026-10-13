-- Team English: «Curso del día» del portal de teachers. Catálogo de cursos externos que la coordinación
-- recomienda; el portal muestra uno distinto cada día. Arranca con cursos reales verificados (oct 2026).

create table if not exists public.te_curso_sugerido (
  id bigint generated always as identity primary key,
  nivel smallint not null check (nivel in (2, 3)),
  titulo text not null check (char_length(titulo) between 1 and 200),
  institucion text check (char_length(institucion) <= 200),
  modalidad text not null default 'en_linea' check (modalidad in ('presencial', 'en_linea', 'hibrida')),
  enlace text not null check (char_length(enlace) <= 500 and enlace ~ '^https://'),
  skill text check (char_length(skill) <= 30),
  costo text not null default 'gratis' check (costo in ('gratis', 'certificado_costo', 'pago')),
  horas numeric(6, 2) check (horas is null or horas between 0 and 2000),
  descripcion text not null default '' check (char_length(descripcion) <= 600),
  activo boolean not null default true,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists te_curso_sugerido_nivel_idx on public.te_curso_sugerido (nivel, activo, id);

alter table public.te_curso_sugerido enable row level security;

insert into public.te_curso_sugerido (nivel, titulo, institucion, enlace, skill, costo, horas, descripcion, creado_por)
select * from (values
  (3, 'Teaching English in primary', 'British Council · TeachingEnglish', 'https://www.teachingenglish.org.uk/training/courses/teaching-english-primary', null, 'gratis', 12::numeric, 'Estrategias para manejar el grupo y aprovechar la clase con niños de primaria. Se abre por temporadas; el workbook se descarga siempre.', 'Catálogo inicial'),
  (3, 'Teaching Young Learners Online', 'British Council · FutureLearn', 'https://www.futurelearn.com/courses/teaching-young-learners-online', null, 'gratis', null, 'Clases en línea accesibles, evaluación y cómo mantener enganchados a niños de 5 a 17 años. Si no está abierto, pide aviso en la página.', 'Catálogo inicial'),
  (3, 'English in Early Childhood: Language Learning and Development', 'British Council · FutureLearn', 'https://www.futurelearn.com/courses/english-in-early-childhood', 'speaking', 'gratis', null, 'Cómo aprenden inglés los más pequeños y por qué aprenden mejor jugando. Ideal para 1st y 2nd grade.', 'Catálogo inicial'),
  (3, 'Teach English Now! Foundational Principles', 'Arizona State University · Coursera', 'https://www.coursera.org/learn/english-principles', null, 'certificado_costo', null, 'Bases de la enseñanza del inglés como segunda lengua. Se puede cursar gratis; el certificado tiene costo.', 'Catálogo inicial'),
  (3, 'Teach English Now! Lesson Design and Assessment', 'Arizona State University · Coursera', 'https://www.coursera.org/learn/lesson-design', 'evaluation', 'certificado_costo', null, 'Diseño de clases y evaluación: justo lo que piden las planeaciones semanales.', 'Catálogo inicial'),
  (3, 'Teach English Now! Second Language Reading, Writing, and Grammar', 'Arizona State University · Coursera', 'https://www.coursera.org/learn/tesol-writing', 'writing', 'certificado_costo', null, 'Estrategias de reading intensivo y extensivo, etapas del writing y gramática con «noticing».', 'Catálogo inicial'),
  (3, 'Teach English Now! Second Language Listening, Speaking, and Pronunciation', 'Arizona State University · Coursera', 'https://www.coursera.org/learn/tesol-speaking', 'listening', 'certificado_costo', null, 'Estrategias de listening y speaking, y cómo meter pronunciation en la clase.', 'Catálogo inicial'),
  (3, 'Teaching Tips for Tricky English Grammar', 'Arizona State University · Coursera', 'https://www.coursera.org/learn/teaching-common-grammar-mistakes', 'grammar', 'certificado_costo', null, 'Artículos, cuantificadores, gerundios y modales: por qué se confunden los alumnos y actividades para enseñarlos.', 'Catálogo inicial'),
  (3, 'Teach English Now! Teaching Language Online', 'Arizona State University · Coursera', 'https://www.coursera.org/learn/teachlanguageonline', null, 'certificado_costo', null, 'Buenas prácticas para dar clases de inglés en línea, con videos de clases reales.', 'Catálogo inicial'),
  (3, 'American English Webinars', 'U.S. Department of State · American English', 'https://americanenglish.state.gov/ae-webinars', null, 'gratis', null, 'Webinars grabados por tema: speaking, listening & pronunciation, reading & writing, grammar & vocabulary, young learners.', 'Catálogo inicial'),
  (3, 'American English MOOCs (Teaching English to Young Learners, TESOL Methodology)', 'U.S. Department of State · OPEN', 'https://americanenglish.state.gov/OPEN-MOOCs', null, 'gratis', null, 'Cursos gratuitos con insignia y certificado digital del Departamento de Estado al aprobar con 70 % o más.', 'Catálogo inicial'),
  (3, 'Webinars for teachers', 'Cambridge English', 'https://www.cambridgeenglish.org/educators-organisations/resources-for-teachers/webinars/', null, 'gratis', null, 'Webinars en vivo y gratuitos con especialistas de Cambridge: estrategias de clase, engagement y evaluación.', 'Catálogo inicial'),
  (3, 'Motivating and engaging young learners', 'Cambridge English', 'https://www.cambridgeenglish.org/educators-organisations/resources-for-teachers/webinars/motivating-and-engaging-young-learners/', 'speaking', 'gratis', null, 'Webinar grabado con ideas para motivar y mantener participando a los niños.', 'Catálogo inicial'),
  (3, 'Bringing phonics to life for young learners', 'Cambridge University Press', 'https://www.cambridge.org/elt/blog/2023/03/15/bringing-phonics-to-life-for-young-learners-i-like-the-sound-of-that/', 'vocabulary', 'gratis', null, 'Webinar grabado: phonics divertido, sonidos y spelling integrados a reading, writing y speaking.', 'Catálogo inicial')
) as v(nivel, titulo, institucion, enlace, skill, costo, horas, descripcion, creado_por)
where not exists (select 1 from public.te_curso_sugerido);
