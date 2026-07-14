/** FAQ del portal alumno: inscripciones, colegiaturas y facturación. */

export type PortalAyudaCategoriaId =
  | 'inscripciones'
  | 'colegiaturas'
  | 'facturacion'
  | 'general'

export type PortalAyudaItem = {
  id: string
  categoria: PortalAyudaCategoriaId
  pregunta: string
  respuesta: string
}

export const PORTAL_AYUDA_CATEGORIAS: {
  id: PortalAyudaCategoriaId
  titulo: string
  subtitulo: string
}[] = [
  {
    id: 'inscripciones',
    titulo: 'Inscripciones y reinscripción',
    subtitulo: 'Solicitud, pagos de ficha y recibo final',
  },
  {
    id: 'colegiaturas',
    titulo: 'Colegiaturas',
    subtitulo: 'Cierre de ciclo, mensualidades y bauchers',
  },
  {
    id: 'facturacion',
    titulo: 'Alta de facturación',
    subtitulo: 'Datos fiscales y CFDI',
  },
  {
    id: 'general',
    titulo: 'General',
    subtitulo: 'Acceso, actualización y contacto',
  },
]

export const PORTAL_AYUDA_FAQ: PortalAyudaItem[] = [
  {
    id: 'ins-1',
    categoria: 'inscripciones',
    pregunta: '¿Dónde hago la inscripción o reinscripción?',
    respuesta:
      'En el dashboard elige «Portal de Inscripciones y Colegiaturas». Ahí concentrás solicitud, reglamento, pago de ficha, recibo final y colegiaturas del ciclo.',
  },
  {
    id: 'ins-2',
    categoria: 'inscripciones',
    pregunta: 'Me sale que debo liquidar el ciclo actual antes de reinscribirme. ¿Qué hago?',
    respuesta:
      'Si eres reinscrito, primero hay que pagar las colegiaturas pendientes del ciclo que termina (plan de 10 u 11 meses). Paga un concepto a la vez (baucher o pago en línea). Cuando todos digan Pagado, se desbloquean los 4 pasos de reinscripción. Usa «Actualizar» si acabas de pagar.',
  },
  {
    id: 'ins-3',
    categoria: 'inscripciones',
    pregunta: '¿Cuáles son los 4 pasos de reinscripción?',
    respuesta:
      '1) Solicitud de datos. 2) Reglamento escolar (ábrelo/descárgalo). 3) Pago de reinscripción (ventanilla, tarjeta Banorte o SPEI). 4) Recibo final (ábrelo al menos una vez). Mientras un paso diga Disponible, aún falta completarlo.',
  },
  {
    id: 'ins-4',
    categoria: 'inscripciones',
    pregunta: 'Ya pagué la reinscripción: ¿dónde está mi factura?',
    respuesta:
      'En el paso «Pago de reinscripción», cuando el pago ya está registrado y timbrado, verás botones PDF y XML (igual que en colegiaturas). Guárdalos: son tu CFDI. Si aún no aparecen, espera un momento y actualiza la página.',
  },
  {
    id: 'ins-5',
    categoria: 'inscripciones',
    pregunta: '¿Cuándo se desbloquean las colegiaturas del ciclo nuevo?',
    respuesta:
      'Solo cuando los 4 pasos están en Completado (incluido abrir el recibo final). Entonces verás la cuota de inicio de curso y las mensualidades del ciclo siguiente.',
  },
  {
    id: 'ins-6',
    categoria: 'inscripciones',
    pregunta: 'Soy de nuevo ingreso. ¿Es el mismo proceso?',
    respuesta:
      'Sí, usas el mismo portal. Completas solicitud, pago de inscripción, documentos si tu caso lo pide, y recibo final. No aplica el «cierre de ciclo anterior» típico de reinscritos.',
  },
  {
    id: 'col-1',
    categoria: 'colegiaturas',
    pregunta: '¿Cómo pago una colegiatura?',
    respuesta:
      'En el portal, en la fila del concepto: «Imprimir» genera baucher para ventanilla; «Pago en línea» abre comercio electrónico (Banorte) o SPEI. Se paga un concepto a la vez según tu plan.',
  },
  {
    id: 'col-2',
    categoria: 'colegiaturas',
    pregunta: '¿Qué es el recargo?',
    respuesta:
      'Las colegiaturas mensuales tienen fecha límite (día 10 del mes del concepto). A partir del día 11 se suma recargo ($75 por mes de atraso). La cuota de inicio de curso del ciclo nuevo no debe llevar recargo mientras ese mes aún no llega.',
  },
  {
    id: 'col-3',
    categoria: 'colegiaturas',
    pregunta: '¿Dónde descargo la factura de una colegiatura pagada?',
    respuesta:
      'En la columna Facturas de la matriz aparecen PDF y XML cuando el pago ya está timbrado y guardado. Ábrelos desde el portal; no hace falta buscarlos en otro sitio.',
  },
  {
    id: 'col-4',
    categoria: 'colegiaturas',
    pregunta: '¿Qué es el plan de 10 u 11 meses?',
    respuesta:
      'Depende del plan registrado del alumno (campo de meses). 10 meses cubre agosto a junio (+ material en enero según catálogo). 11 meses incluye también julio. El portal te muestra el plan en la etiqueta de la sección.',
  },
  {
    id: 'fac-1',
    categoria: 'facturacion',
    pregunta: '¿Para qué sirve Alta de Facturación?',
    respuesta:
      'Ahí registras o actualizas tu RFC, razón social, régimen fiscal, CP y constancia SAT. Esos datos se usan para timbrar los CFDI de los pagos del portal.',
  },
  {
    id: 'fac-2',
    categoria: 'facturacion',
    pregunta: '¿Cuándo debo actualizar mis datos fiscales?',
    respuesta:
      'Antes de pedir facturas nuevas, o si cambió tu constancia del SAT (razón social, régimen, código postal). Datos incorrectos pueden impedir el timbrado o generar facturas con error.',
  },
  {
    id: 'fac-3',
    categoria: 'facturacion',
    pregunta: 'Pagué pero no veo PDF/XML. ¿Falta el alta?',
    respuesta:
      'Puede ser demora de timbrado o datos fiscales incompletos. Revisa Alta de Facturación, pulsa Actualizar en el portal de pagos/inscripciones, y si persiste contacta a caja o servicios escolares con tu número de control y referencia de pago.',
  },
  {
    id: 'gen-1',
    categoria: 'general',
    pregunta: 'La pantalla no se actualiza después de pagar.',
    respuesta:
      'Usa el botón Actualizar del propio portal o recarga la página. El estatus “Pagado” y las facturas aparecen cuando el pago ya quedó registrado en el sistema.',
  },
  {
    id: 'gen-2',
    categoria: 'general',
    pregunta: '¿Qué navegador recomiendan?',
    respuesta:
      'Chrome o Edge actualizados, en computadora o celular con buena conexión. Evita cerrar la ventana del banco hasta ver la confirmación del pago.',
  },
  {
    id: 'gen-3',
    categoria: 'general',
    pregunta: '¿Con quién puedo pedir ayuda personalizada?',
    respuesta:
      'Acude a servicios escolares o caja de tu plantel con el nombre del alumno y su número de control. Lleva capturas del aviso o del paso que tengas bloqueado.',
  },
]
