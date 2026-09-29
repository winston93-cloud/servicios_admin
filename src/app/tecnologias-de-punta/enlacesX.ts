export type CategoriaEnlace = 'cursor' | 'modelos' | 'agentes' | 'diseno' | 'infra' | 'tips'

export type EnlaceX = {
  id: string
  /** Hora de México, `YYYY-MM-DDTHH:mm`. */
  fecha: string
  cuenta: string
  autor: string
  enlace: string
  titulo: string
  resumen: string
  nota?: string
  categoria: CategoriaEnlace
}

export const CATEGORIAS: { valor: CategoriaEnlace; etiqueta: string }[] = [
  { valor: 'cursor', etiqueta: 'Cursor' },
  { valor: 'modelos', etiqueta: 'Modelos de IA' },
  { valor: 'agentes', etiqueta: 'Agentes y automatización' },
  { valor: 'diseno', etiqueta: 'Diseño UI/UX' },
  { valor: 'infra', etiqueta: 'Infraestructura' },
  { valor: 'tips', etiqueta: 'Tips y buenas prácticas' },
]

export const ENLACES_X: EnlaceX[] = [
  {
    id: '1957977611646439628', fecha: '2025-08-20T09:00', cuenta: 'leerob', autor: 'Lee Robinson', categoria: 'modelos',
    enlace: 'https://x.com/leerob/status/1957977611646439628',
    titulo: 'Nuevo modelo “sigiloso” gratis en Cursor',
    resumen: 'Hay un nuevo modelo experimental en Cursor de uno de sus socios. Es gratis para probarlo y piden comentarios sobre qué tal funciona.',
    nota: 'Tienen que activar este agente en Cursor. Es gratis y parece ser la beta del nuevo agente especializado de Grok para programación.',
  },
  {
    id: '1961037386198266258', fecha: '2025-08-28T13:29', cuenta: 'tetsuoai', autor: 'Tetsuo', categoria: 'modelos',
    enlace: 'https://x.com/tetsuoai/status/1961037386198266258',
    titulo: 'Grok Code, gratis en editores como Cursor',
    resumen: 'Grok Code es un modelo disponible en editores como Cursor y, por ahora, también es gratuito.',
  },
  {
    id: '1972680165378650391', fecha: '2025-09-29T12:30', cuenta: 'lovable_dev', autor: 'Lovable', categoria: 'infra',
    enlace: 'https://x.com/lovable_dev/status/1972680165378650391',
    titulo: 'Lovable Cloud & AI: apps con backend solo con instrucciones',
    resumen: 'Presentan Lovable Cloud & AI, un nuevo capítulo del “vibe coding”: cualquiera puede crear apps con IA avanzada y backend solo describiendo lo que quiere. Cada día se construyen más de 100 mil ideas, herramientas y sitios en Lovable.',
  },
  {
    id: '1983567619946147967', fecha: '2025-10-29T21:48', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'cursor',
    enlace: 'https://x.com/cursor_ai/status/1983567619946147967',
    titulo: 'Llega Cursor 2.0 con su primer modelo propio',
    resumen: 'Presentan Cursor 2.0: su primer modelo de programación y la mejor forma de programar con agentes.',
  },
  {
    id: '1983573794414555314', fecha: '2025-10-29T22:18', cuenta: 'corbin_braun', autor: 'Corbin', categoria: 'cursor',
    enlace: 'https://x.com/corbin_braun/status/1983573794414555314',
    titulo: 'El navegador de Cursor 2.0: “Paint para desarrolladores”',
    resumen: 'La función de navegador de Cursor 2.0 es básicamente un Paint para desarrolladores: señalas partes de la página, dices “quiero cambiar esto” y simplemente funciona. El desarrollo frontend se vuelve tan intuitivo como dibujar.',
  },
  {
    id: '1984260161008202051', fecha: '2025-10-31T12:14', cuenta: 'leerob', autor: 'Lee Robinson', categoria: 'cursor',
    enlace: 'https://x.com/leerob/status/1984260161008202051',
    titulo: 'Cursor ya trae navegador web integrado',
    resumen: 'Puedes decir “arranca mi app” y Cursor levanta el servidor en una terminal y abre el navegador en localhost:3000. Toma capturas para iterar el diseño y puedes mandarle elementos de la página al agente junto con tus instrucciones.',
  },
  {
    id: '1984254784640278635', fecha: '2025-10-31T12:44', cuenta: 'filiksyos', autor: 'Fili', categoria: 'tips',
    enlace: 'https://x.com/filiksyos/status/1984254784640278635',
    titulo: 'Tip: usa /summarize cuando el contexto llegue al 50 %',
    resumen: 'Tip de Cursor que cambia el juego: cuando el contexto llegue a ~50 %, escribe el comando /summarize. Ahorra dinero y mantiene precisas las respuestas de la IA.',
  },
  {
    id: '1997528999010897974', fecha: '2025-12-08T21:23', cuenta: 'marionawfal', autor: 'Mario Nawfal', categoria: 'modelos',
    enlace: 'https://x.com/marionawfal/status/1997528999010897974',
    titulo: 'Grok tendrá entorno de programación e integración con GitHub',
    resumen: 'Grok está lanzando conexión nativa con GitHub y un espacio real de programación: podrás traer repositorios, editar código, hacer commit y push, todo dentro de Grok, impulsado por Grok Code.',
  },
  {
    id: '1999147953609736464', fecha: '2025-12-12T09:15', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'diseno',
    enlace: 'https://x.com/cursor_ai/status/1999147953609736464',
    titulo: 'Diseña directo en tu código con Cursor',
    resumen: 'Ahora puedes diseñar directamente en tu código: seleccionas elementos, los modificas visualmente y Cursor escribe el código.',
  },
  {
    id: '2026658264264696155', fecha: '2026-02-25T23:20', cuenta: 'heynavtoor', autor: 'Nav Toor', categoria: 'tips',
    enlace: 'https://x.com/heynavtoor/status/2026658264264696155',
    titulo: 'CodexBar: tus límites de uso de IA en tiempo real',
    resumen: 'Alguien creó la herramienta que todo programador con IA pedía: CodexBar, una pequeña app para la barra de menú de macOS que muestra en tiempo real tus límites de uso de IA. Se acabó el “¿por qué dejó de funcionar Claude Code?” y entrar a paneles para revisarlo.',
    nota: 'Esto les podría servir.',
  },
  {
    id: '2023827905743384969', fecha: '2026-02-27T22:55', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'cursor',
    enlace: 'https://x.com/cursor_ai/status/2023827905743384969',
    titulo: 'Plugin de Vercel: buenas prácticas de React en Cursor',
    resumen: 'Optimiza tus apps aplicando las mejores prácticas de React con el plugin de Vercel para Cursor.',
  },
  {
    id: '2026198305362083910', fecha: '2026-02-28T12:59', cuenta: 'hartdrawss', autor: 'Harshil Tomar', categoria: 'tips',
    enlace: 'https://x.com/hartdrawss/status/2026198305362083910',
    titulo: 'Vibe Coding 2.0: 18 reglas para estar en el top 1 %',
    resumen: 'Artículo con 18 reglas prácticas para programar con IA y estar entre el 1 % de los mejores creadores.',
  },
  {
    id: '2027579258328256574', fecha: '2026-02-28T13:10', cuenta: 'itsandrewgao', autor: 'Andrew Gao', categoria: 'diseno',
    enlace: 'https://x.com/itsandrewgao/status/2027579258328256574',
    titulo: 'Documento de referencia para diseños frontend',
    resumen: 'Publicación con un documento enlazado sobre diseño de interfaces; ideal para que una IA lo estudie y lo aplique en el frontend.',
    nota: 'Pídanle a una IA que estudie este documento. Chéquenlo, está muy interesante para los diseños de front end.',
  },
  {
    id: '2027781154729037932', fecha: '2026-02-28T20:28', cuenta: 'morganlinton', autor: 'Morgan', categoria: 'cursor',
    enlace: 'https://x.com/morganlinton/status/2027781154729037932',
    titulo: 'Lectura obligada del fundador de Cursor',
    resumen: 'Recomiendan un texto del fundador de Cursor sobre la dirección del producto y sus nuevas funciones.',
    nota: 'Nueva función de Cursor.',
  },
  {
    id: '2029604184002269662', fecha: '2026-03-05T13:17', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'agentes',
    enlace: 'https://x.com/cursor_ai/status/2029604184002269662',
    titulo: 'Automations: Cursor vigila y mejora tu código solo',
    resumen: 'Cursor ahora puede monitorear y mejorar tu código de forma continua. Las automatizaciones se ejecutan según los disparadores e instrucciones que tú defines.',
    nota: 'Revisen esto, importante.',
  },
  {
    id: '2029607757658411272', fecha: '2026-03-06T09:00', cuenta: 'austinnickpiel', autor: 'Austin Nick Piel', categoria: 'agentes',
    enlace: 'https://x.com/austinnickpiel/status/2029607757658411272',
    titulo: 'Revisión de código 100 % con Automations',
    resumen: 'Movieron todo su ciclo de revisión de código a Automations: Cursor aprueba los cambios de bajo riesgo y asigna revisores automáticamente, según el historial de commits, a los de riesgo medio o alto.',
    nota: 'Para todo el canal.',
  },
  {
    id: '2031784967685218684', fecha: '2026-03-11T16:14', cuenta: 'githubprojects', autor: 'GitHub Projects Community', categoria: 'tips',
    enlace: 'https://x.com/githubprojects/status/2031784967685218684',
    titulo: 'El “flujo real” del vibe coding (en humor)',
    resumen: 'Un árbol de carpetas en broma: preparar (abrir Cursor, abrir ChatGPT, café, “construyamos algo”), desarrollar (prompt, otro prompt, refinar prompt, uno más, copiar y pegar código) y depurar…',
  },
  {
    id: '2034075096495886477', fecha: '2026-03-19T08:00', cuenta: 'vercel_dev', autor: 'Vercel Developers', categoria: 'agentes',
    enlace: 'https://x.com/vercel_dev/status/2034075096495886477',
    titulo: 'Plugin de Vercel para agentes: 47+ habilidades con un comando',
    resumen: 'Un plugin, un comando, todas las habilidades: npx plugins add vercel/vercel-plugin. Convierte capacidades sueltas en experiencia coordinada con más de 47 habilidades especializadas, subagentes para despliegues y rendimiento, y contexto dinámico.',
    nota: 'Prueben implementar esto hoy.',
  },
  {
    id: '2035728142095339677', fecha: '2026-03-23T09:00', cuenta: 'ataiiam', autor: 'Atai Barkai', categoria: 'diseno',
    enlace: 'https://x.com/ataiiam/status/2035728142095339677',
    titulo: 'Shadify: interfaces generativas con ShadCN',
    resumen: 'Describe una interfaz y un agente de LangChain la arma al momento con componentes de ShadCN, usando AG-UI y CopilotKit. Después la exportas como código React.',
    nota: 'Chequen si se puede integrar esto para que sus agentes lo usen de forma automática.',
  },
  {
    id: '2034515384003694761', fecha: '2026-03-23T09:00', cuenta: '_vmlops', autor: 'Vaishnavi', categoria: 'diseno',
    enlace: 'https://x.com/_vmlops/status/2034515384003694761',
    titulo: 'UI/UX Pro Max: sistemas de diseño para tu IA',
    resumen: 'Aprender UI/UX suele ser adivinar qué se ve bien. Este repositorio lo cambia: la skill UI/UX Pro Max da sistemas de diseño, estilos y reglas estructuradas según tu producto. Menos adivinar, más construir.',
    nota: 'Agreguen esto para front end también.',
  },
  {
    id: '2036375450398892405', fecha: '2026-03-24T07:23', cuenta: 'ericzakariasson', autor: 'Eric Zakariasson', categoria: 'agentes',
    enlace: 'https://x.com/ericzakariasson/status/2036375450398892405',
    titulo: 'Artículo: cómo trabajar mejor con agentes',
    resumen: 'Enlace a un artículo completo de Eric Zakariasson (Cursor) sobre flujos de trabajo con agentes de IA.',
    nota: 'Pregunten a sus agentes que lean este artículo y cómo podrían usarlo para sus sistemas.',
  },
  {
    id: '2039476192169112027', fecha: '2026-04-08T09:00', cuenta: 'hasantoxr', autor: 'Hasan Toor', categoria: 'diseno',
    enlace: 'https://x.com/hasantoxr/status/2039476192169112027',
    titulo: 'awesome-design-md: “el Figma para agentes de IA”',
    resumen: 'Colección de archivos DESIGN.md extraídos de 31 sitios reales que los agentes de programación sí pueden leer. Sin exportar de Figma, sin esquemas JSON ni herramientas especiales: solo un archivo markdown.',
    nota: 'Chequen esto.',
  },
  {
    id: '2039768512894505086', fecha: '2026-04-09T09:00', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'cursor',
    enlace: 'https://x.com/cursor_ai/status/2039768512894505086',
    titulo: 'Llega Cursor 3',
    resumen: 'Cursor 3 es más simple, más potente y está hecho para un mundo donde todo el código lo escriben agentes, sin perder la profundidad de un entorno de desarrollo.',
    nota: 'Revisen el curso de Cursor para ver si se actualizó.',
  },
  {
    id: '2039573042553102659', fecha: '2026-04-10T09:00', cuenta: 'tom_doerr', autor: 'Tom Dörr', categoria: 'tips',
    enlace: 'https://x.com/tom_doerr/status/2039573042553102659',
    titulo: 'Búsqueda por palabras clave en árboles de documentos',
    resumen: 'Herramienta de código abierto para buscar por palabras clave dentro de estructuras de documentos.',
    nota: '¿Chequen si esto no les sirve?',
  },
  {
    id: '2043373611114020909', fecha: '2026-04-13T09:00', cuenta: 'ihtesham2005', autor: 'Ihtesham Ali', categoria: 'agentes',
    enlace: 'https://x.com/ihtesham2005/status/2043373611114020909',
    titulo: 'three-man-team: un equipo de 3 agentes de IA',
    resumen: 'Alguien construyó un equipo de desarrollo de 3 agentes basado en 20 años de experiencia en producción y lo liberó completo. Todo cabe en tres archivos de contexto. Resuelve que las herramientas de IA son potentes pero indisciplinadas.',
    nota: 'Revisen esto, se ve bien.',
  },
  {
    id: '2062689734321688920', fecha: '2026-06-05T08:25', cuenta: 'precisox', autor: 'precis0x', categoria: 'agentes',
    enlace: 'https://x.com/precisox/status/2062689734321688920',
    titulo: 'Memanto: memoria persistente para tus agentes',
    resumen: 'Un equipo de desarrolladores autodidactas creó Memanto, herramienta de código abierto que da memoria infinita y persistente a tus IAs, para que no olviden todo cada vez que cierras la pestaña.',
    nota: 'Para todo el canal.',
  },
  {
    id: '2067192475853180997', fecha: '2026-06-17T10:17', cuenta: 'opendesignhq', autor: 'Open Design', categoria: 'diseno',
    enlace: 'https://x.com/opendesignhq/status/2067192475853180997',
    titulo: 'Open Design: estudio de diseño con IA, de código abierto',
    resumen: 'El diseño estilo Cursor ya es real y lo liberaron para todos: señala, comenta, marca, edita, captura y remezcla. Deja que la IA diseñe por ti y toma el control cuando quieras.',
  },
  {
    id: '2067180054979936413', fecha: '2026-06-17T13:27', cuenta: 'vercel', autor: 'Vercel', categoria: 'agentes',
    enlace: 'https://x.com/vercel/status/2067180054979936413',
    titulo: 'Vercel lanza Eve, framework para construir agentes',
    resumen: 'Eve es un framework de código abierto para construir agentes. Cada agente tiene instrucciones (quién es y cómo se comporta), herramientas (para interactuar con sistemas externos) y skills (procedimientos reutilizables para tareas).',
    nota: 'Cárguenle esto a sus agentes. Pídanle que lo integre a su flujo de trabajo actual.',
  },
  {
    id: '2067310428682928358', fecha: '2026-06-17T21:27', cuenta: 'wholemars', autor: 'Whole Mars Catalog', categoria: 'modelos',
    enlace: 'https://x.com/wholemars/status/2067310428682928358',
    titulo: 'Cursor Composer ahora es Grok Composer',
    resumen: 'El modelo Composer de Cursor pasa a llamarse Grok Composer.',
  },
  {
    id: '2067996575817945197', fecha: '2026-06-20T12:08', cuenta: 'datachaz', autor: 'Charly Wargnier', categoria: 'tips',
    enlace: 'https://x.com/datachaz/status/2067996575817945197',
    titulo: 'Headroom: hasta 95 % menos tokens sin cambiar código',
    resumen: 'Un ingeniero de Netflix liberó Headroom, una de las formas más inteligentes de bajar costos de LLM: envuelve a Cursor o Claude en un proxy local que comprime lo que envías antes de llegar al modelo.',
    nota: 'A ver, chequen esto.',
  },
  {
    id: '2068328135611822149', fecha: '2026-06-21T08:57', cuenta: 'anatolikopadze', autor: 'Anatoli Kopadze', categoria: 'agentes',
    enlace: 'https://x.com/anatolikopadze/status/2068328135611822149',
    titulo: 'Loops explicados: Claude, GPT, Mira y lo que sí funciona',
    resumen: 'Artículo que explica los ciclos de trabajo de los agentes (loops) en Claude, GPT y Mira, y qué enfoques funcionan en la práctica.',
  },
  {
    id: '2069410910435991749', fecha: '2026-06-24T09:10', cuenta: 'connect24h', autor: 'connect24h', categoria: 'diseno',
    enlace: 'https://x.com/connect24h/status/2069410910435991749',
    titulo: 'DESIGN.md de Google: la IA entiende tu diseño a la primera',
    resumen: 'Decirle 10 veces a la IA “hazme una UI bonita” no funcionaba; con un solo archivo DESIGN.md de Google salió a la primera. Define los tokens en YAML y explica en prosa por qué cada valor. Adiós a las instrucciones que dependen de cada persona.',
    nota: 'Revisen si esto vale la pena.',
  },
  {
    id: '2070016711341040054', fecha: '2026-06-26T09:37', cuenta: 'aiedge_', autor: 'AI Edge', categoria: 'diseno',
    enlace: 'https://x.com/aiedge_/status/2070016711341040054',
    titulo: 'Skill “Taste”: adiós al diseño genérico de IA',
    resumen: 'Un framework frontend “anti-slop” impresionante: dale la skill “Taste” a tu agente (Hermes, Claude Code o Codex) para eliminar el diseño genérico de IA. Incluye skills de diseño, generación de imágenes y más.',
    nota: 'Quiero ver que probemos este.',
  },
  {
    id: '2075686268113916023', fecha: '2026-07-11T07:34', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'cursor',
    enlace: 'https://x.com/cursor_ai/status/2075686268113916023',
    titulo: 'Chats laterales en Cursor',
    resumen: 'Nueva forma de hacer preguntas y explorar ideas sin interrumpir tu conversación principal. Cada chat lateral es una conversación con el agente que perdura y puedes mencionar con @ para traer su contexto al hilo principal.',
  },
  {
    id: '2077552106014154846', fecha: '2026-07-15T21:39', cuenta: 'leerob', autor: 'Lee Robinson', categoria: 'modelos',
    enlace: 'https://x.com/leerob/status/2077552106014154846',
    titulo: 'Cursor duplica el uso incluido de sus modelos',
    resumen: 'Se duplicó el uso incluido de los modelos de Cursor en todos los planes: más acceso a Grok 4.5 y Composer 2.5.',
  },
  {
    id: '2077824029126504525', fecha: '2026-07-16T13:36', cuenta: 'arena', autor: 'Arena.ai', categoria: 'modelos',
    enlace: 'https://x.com/arena/status/2077824029126504525',
    titulo: 'Kimi-K3, #1 en la arena de código frontend',
    resumen: 'Kimi-K3 de Moonshot es ahora el #1 en Frontend Code Arena con 1679 puntos, superando a Claude Fable 5: un salto de 17 lugares desde Kimi-k2.6. Quedó #1 en 6 de 7 categorías, como marca y marketing, diseño con referencias y datos y analítica.',
  },
  {
    id: '2078774556249186345', fecha: '2026-07-20T09:00', cuenta: 'thesupermanmx', autor: 'Superman', categoria: 'modelos',
    enlace: 'https://x.com/thesupermanmx/status/2078774556249186345',
    titulo: 'Unlimited-OCR: lee PDFs de 100 páginas de una vez',
    resumen: 'China liberó un OCR diminuto que procesa PDFs completos de 100 páginas en una sola pasada. Se llama Unlimited-OCR, tiene solo 3B de parámetros y corre en local, sin perder el hilo entre páginas.',
  },
  {
    id: '2080001007979757618', fecha: '2026-07-23T10:27', cuenta: 'davep', autor: 'David Pan', categoria: 'cursor',
    enlace: 'https://x.com/davep/status/2080001007979757618',
    titulo: 'Cursor Router elige el mejor modelo para cada tarea',
    resumen: 'Ya no necesitas ser experto en benchmarks, niveles de razonamiento ni caché. Cursor Router elige el modelo para cada tarea según la calidad medida contra el costo, con rendimiento nivel Fable 5.',
  },
  {
    id: '2085464617694777762', fecha: '2026-08-06T16:09', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'agentes',
    enlace: 'https://x.com/cursor_ai/status/2085464617694777762',
    titulo: 'Cursor soporta Agent Plugins',
    resumen: 'Cursor ahora soporta Agent Plugins, un estándar abierto para empaquetar skills y servidores MCP y usarlos entre distintos agentes.',
  },
  {
    id: '2087296100545782192', fecha: '2026-08-12T01:35', cuenta: 'ericksky', autor: 'Erick', categoria: 'tips',
    enlace: 'https://x.com/ericksky/status/2087296100545782192',
    titulo: 'Depurar ya no es lo que era, gracias a la IA',
    resumen: 'Jarred Sumner (creador de Bun) recordó un tweet de 2022 donde pasó 3 horas depurando un bug de JavaScript; hoy dice que “eso ya no pasa”. Boris, creador de Claude Code, responde con una verdad incómoda sobre cómo cambió el trabajo.',
  },
  {
    id: '2087565405191635168', fecha: '2026-08-12T10:21', cuenta: 'ericksky', autor: 'Erick', categoria: 'modelos',
    enlace: 'https://x.com/ericksky/status/2087565405191635168',
    titulo: 'Grok 4.6 con uso doble en Cursor y Grok',
    resumen: 'Llega Grok 4.6 y por tiempo limitado duplicaron el uso en los planes de Cursor y Grok. Rinde como Fable 5 o GPT-5.6 SOL en MAX, pero pensado para uso intensivo.',
  },
  {
    id: '2087613483038683193', fecha: '2026-08-13T12:46', cuenta: 'mosheabram38005', autor: 'Moshe Abramovitch', categoria: 'agentes',
    enlace: 'https://x.com/mosheabram38005/status/2087613483038683193',
    titulo: 'Más de 300 skills de NVIDIA en Cursor',
    resumen: 'Agrega el plugin de NVIDIA y tu agente obtiene más de 300 skills en más de 30 productos (CUDA, NeMo, RAG). Dile qué construyes y propone la skill correcta.',
  },
  {
    id: '2089399059488350447', fecha: '2026-08-19T09:30', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'infra',
    enlace: 'https://x.com/cursor_ai/status/2089399059488350447',
    titulo: 'Origin se integra con Vercel, Buildkite y Depot',
    resumen: 'Se asociaron con algunas de las mejores integraciones de GitHub: Vercel, Buildkite y Depot ya están disponibles y vienen más.',
    nota: 'Arranquemos hoy. Revisen todos los que están marcados con anteriores; no me han confirmado si ya revisaron los anteriores.',
  },
  {
    id: '2089466749943152806', fecha: '2026-08-19T09:30', cuenta: 'ericzakariasson', autor: 'Eric Zakariasson', categoria: 'infra',
    enlace: 'https://x.com/ericzakariasson/status/2089466749943152806',
    titulo: 'Origin ya está disponible para alojar tu código',
    resumen: 'Origin está en vivo y listo para alojar tu código; incluye una guía de cómo empezar.',
    nota: 'Lean esto al respecto.',
  },
  {
    id: '2090136956101414982', fecha: '2026-08-19T13:27', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'agentes',
    enlace: 'https://x.com/cursor_ai/status/2090136956101414982',
    titulo: 'Agentes en la nube de Cursor, más autónomos',
    resumen: 'Siguen mejorando los agentes en la nube: toman trabajo a partir de eventos, mantienen un objetivo hasta cumplirlo y no se desvían en sesiones largas.',
  },
  {
    id: '2093077548649570777', fecha: '2026-08-27T17:01', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'infra',
    enlace: 'https://x.com/cursor_ai/status/2093077548649570777',
    titulo: 'Crea, guarda y publica apps: Cursor + Origin + Vercel',
    resumen: 'Ahora puedes crear apps web nuevas con Cursor, guardar el código en Origin y publicarlas en Vercel.',
  },
  {
    id: '2098162488013455784', fecha: '2026-09-11T09:00', cuenta: 'cursor_ai', autor: 'Cursor', categoria: 'cursor',
    enlace: 'https://x.com/cursor_ai/status/2098162488013455784',
    titulo: 'Projects: un agente coordinador siempre activo',
    resumen: 'En lugar de abrir un chat por tarea, trabajas con un agente coordinador en un solo hilo persistente. Siempre está activo, gestiona el trabajo con subagentes de forma proactiva y mejora con el tiempo.',
    nota: 'Revisen esto.',
  },
  {
    id: '2104949571789148416', fecha: '2026-09-29T12:47', cuenta: 'hanghuang_', autor: 'Hang Huang', categoria: 'infra',
    enlace: 'https://x.com/hanghuang_/status/2104949571789148416',
    titulo: 'InstaCloud: nube serverless pensada para agentes',
    resumen: 'Levantaron 8 millones de dólares para competir con AWS, GCP y Azure. InstaCloud es una nube serverless nativa para agentes que elimina el trabajo manual y tedioso de DevOps al desplegar.',
  },
]
