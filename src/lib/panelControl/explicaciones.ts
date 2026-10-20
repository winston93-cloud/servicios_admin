import { UMBRALES_SALUD, type Diagnostico, type MedidorProceso, type PiezaMedida } from './tipos'

/* Textos de la ventana de análisis: qué es cada medidor y cómo se califica cada pieza. Deben seguir las reglas de panelControl.ts y uniformes.ts. */

export const DESCRIPCION_MEDIDOR: Record<string, string> = {
  pagos: 'Cobros en línea de colegiaturas y servicios: tarjeta con Banorte, transferencias SPEI con Openpay y los avisos de pago que Openpay manda de regreso.',
  facturacion:
    'Facturación de los dos planteles (Instituto Educativo Winston e Instituto Winston Churchill): aciertos y errores del timbrado, vigencia del sello digital con el que se timbra y de la e.firma con la que se renueva, el PAC FacturoPorTi y el archivo privado de XML y PDF.',
  reportes: 'Reportes RAC: los correos que salen a las familias y la agenda de citas en Google Calendar.',
  talleres: 'Talleres: registro de listas y la alerta automática de grupos debajo del mínimo, con su correo.',
  'open-house': 'Open House y sesiones informativas: la app de registro, el envío de prospectos a Kommo y los recordatorios programados.',
  insforge: 'La base de datos Winston Servicios en InsForge, donde viven casi todos los sistemas: qué tan rápido contesta y cuántas conexiones ocupa.',
  vercel: 'Las 12 apps de la escuela publicadas en Vercel y la tarea programada de recordatorios de documentos.',
  desarrollo: 'Las publicaciones (deploys) a producción del proyecto servicios-admin en los últimos 7 días.',
  'control-escolar': 'Control escolar: alumnos, inscripciones, grupos y expedientes. Se mide su app y cómo usa sus tablas en la base.',
  boletas: 'Boletas de calificaciones de kinder, primaria y secundaria: captura de maestros, publicación a papás y PDF.',
  caja: 'Caja de servicios: cobros, recibos y pagos de colegiaturas y servicios.',
  becas: 'Becas: renovaciones, solicitudes, permisos y bitácora, con su app de renovación.',
  acceso: 'Control de acceso y reloj checador: entradas y salidas registradas.',
  workshops: 'Workshops: inscripciones y listas de los talleres extracurriculares. No tiene app propia, se mide su base.',
  ssiw: 'SSIW: entrega de alumnos a pie y registro de salidas.',
  cheques: 'Cheques: emisión y control de cheques por empresa, con su app.',
  prorrogas: 'Prórrogas y ajustes de pago a familias, con su app.',
  'portal-inscripcion': 'Portal de inscripción: reinscripciones y altas que hacen los papás en línea.',
  'u-uso': 'Tienda de uniformes: ventas, devoluciones y operaciones, y que cada movimiento quede en la bitácora.',
  'u-stock': 'Existencias por talla y sucursal: sin stock negativo, sin tallas repetidas, pedidos coherentes y transferencias al día.',
  'u-funciones': 'Las funciones de la base con las que la app vende y devuelve, y los triggers que auditan cada cambio.',
  'u-eficiencia': 'Qué tan rápido contesta la base para Uniformes y si sus tablas usan índices y están limpias.',
  'u-enlace': 'La conexión de Uniformes con Winston: su app en Vercel, sus tablas, el ciclo escolar actual, los alumnos y el archivo fiscal.',
  'u-almacenamiento': 'El espacio que ocupa Uniformes en Winston: tablas, crecimiento de la bitácora y archivos fiscales.',
}

const servicio = (tiempo: string) =>
  `Se califica con sus operaciones reales de las últimas 24 h. Fallos del sistema (red, tiempo agotado, error del servidor o credenciales): cada 1% que falla resta 4 puntos. Tiempo: si el 95% contesta en ${tiempo} o menos vale 100, y baja hasta 0 al cuádruple. Un error de datos del usuario no cuenta. Sin operaciones no hay lectura.`

const REGLA_PIEZA: Record<string, string> = {
  banorte: servicio('8 s'),
  'openpay-api': servicio('4 s'),
  pac: servicio('8 s'),
  'storage-cfdi': servicio('3 s'),
  'timbrado-educativo': 'Califica los errores del sistema de los últimos 7 días: 2.5% ya es precaución y 10% alarma. Los errores por datos fiscales del cliente (RFC, nombre, código postal, régimen, uso de CFDI) se cuentan y se muestran, pero no bajan la calificación porque no son falla del sistema.',
  'timbrado-churchill': 'Califica los errores del sistema de los últimos 7 días: 2.5% ya es precaución y 10% alarma. Los errores por datos fiscales del cliente (RFC, nombre, código postal, régimen, uso de CFDI) se cuentan y se muestran, pero no bajan la calificación porque no son falla del sistema.',
  'sello-educativo': 'Sello digital (CSD) con el que se timbra. 100 con más de 90 días de vigencia; de 90 a 31 días precaución; 30 días o menos alarma; vencido 0. Se lee del certificado público, sin tocar al SAT ni al PAC.',
  'sello-churchill': 'Sello digital (CSD) con el que se timbra. 100 con más de 90 días de vigencia; de 90 a 31 días precaución; 30 días o menos alarma; vencido 0. Se lee del certificado público, sin tocar al SAT ni al PAC.',
  'efirma-educativo': 'e.firma (FIEL): sin ella vigente no se puede renovar el sello. 100 con más de 90 días de vigencia; de 90 a 31 días precaución; 30 días o menos alarma; vencido 0. Se lee del certificado público, sin tocar al SAT ni al PAC.',
  'efirma-churchill': 'e.firma (FIEL): sin ella vigente no se puede renovar el sello. 100 con más de 90 días de vigencia; de 90 a 31 días precaución; 30 días o menos alarma; vencido 0. Se lee del certificado público, sin tocar al SAT ni al PAC.',
  correo: servicio('15 s (incluye la espera por el límite de envío de Gmail)'),
  'google-calendar': servicio('4 s'),
  'openpay-avisos': 'Avisos de pago que Openpay manda al sistema en 24 h: cada 1% que falla resta 4 puntos. Sin avisos no hay lectura.',
  base: 'Tiempo que tarda la base en contestar la lectura del panel. Hasta 0.8 s vale 100; si tarda más baja poco a poco hasta 0.',
  conexiones: 'Conexiones abiertas contra el máximo de la base: debajo de 80% vale 100, de 80 a 90% entra en precaución y desde 90% en alarma (al 100% la base rechaza conexiones).',
  'cron-talleres-minimo': 'Latido de la tarea programada: 100 si corrió a su hora y salió bien; 0 si falló o no corrió (con 20 min de margen).',
  'cron-recordatorio-liberacion-docs': 'Latido de la tarea programada: 100 si corrió a su hora y salió bien; 0 si falló o no corrió (con 20 min de margen).',
  app: 'Estado de su publicación en producción en Vercel, solo lectura: publicada o publicándose vale 100; con error, cancelada o sin publicación vale 0.',
  'app-open-house': 'Estado de su publicación en producción en Vercel, solo lectura: publicada o publicándose vale 100; con error o cancelada vale 0.',
  apps: 'Las 12 apps en Vercel: cada app sin publicación lista resta 25 puntos.',
  deploys: 'Publicaciones de 7 días: porcentaje que terminaron bien. Si la última falló, vale 0.',
  kommo: 'Porcentaje de registros de los últimos 7 días que llegaron a Kommo como prospecto.',
  'recordatorios-oh': 'Vale 100 si ningún recordatorio lleva más de 2 h atrasado; 0 si hay atrasados.',
  indices: 'Tablas de 10 000 registros o más: porcentaje de veces que se leen completas en vez de usar su índice (contado desde que se arregló cada tabla). Hasta 10% no resta; cada punto arriba resta 1.',
  limpieza: 'Registros muertos (borrados o editados sin purgar) contra los vivos: hasta 20% no resta; cada punto arriba resta 2.',
  'u-uso:hoy': 'Informativo: muestra la actividad del día, siempre vale 100.',
  'u-uso:semana': 'Informativo: muestra la actividad de la semana, siempre vale 100.',
  'u-uso:pendientes': 'Informativo: pedidos por entregar, siempre vale 100.',
  'u-uso:bitacora': 'Porcentaje de movimientos de stock que quedaron registrados en la bitácora de auditoría.',
  'u-stock:negativos': 'Vale 0 si alguna talla tiene existencia debajo de cero.',
  'u-stock:duplicados': 'Vale 0 si una talla aparece repetida en la misma sucursal.',
  'u-stock:pedidos': 'Cada pedido incoherente con su stock resta 20 puntos.',
  'u-stock:ubicaciones': 'Cada ubicación desfasada de su existencia resta 5 puntos.',
  'u-stock:transito': 'Informativo: transferencias abiertas entre sucursales, siempre vale 100.',
  'u-funciones:presentes': 'Vale 100 si están en la base todas las funciones esperadas; 0 si falta alguna.',
  'u-funciones:venta': 'Vale 100 si la app puede ejecutar las 6 funciones de venta y devolución; 0 si falta alguna.',
  'u-funciones:internas': 'Las funciones internas de transferencia deben ser privadas: si alguna queda expuesta vale 40.',
  'u-funciones:auditoria': 'Porcentaje de las 32 tablas que registran cada cambio con su trigger de auditoría.',
  'u-eficiencia:base': 'Tiempo que tarda la base en contestar la lectura de Uniformes; si tarda más de lo aceptable baja poco a poco hasta 0.',
  'u-enlace:tablas': 'Vale 100 si existen en Winston todas las tablas de Uniformes; 0 si falta alguna.',
  'u-enlace:ciclo': 'Vale 100 si hay exactamente un ciclo escolar actual, 50 si hay varios y 0 si no hay ninguno.',
  'u-enlace:alumnos': 'Vale 100 si hay alumnos de Winston disponibles para vender.',
  'u-enlace:bucket': 'Vale 100 si existe el archivo privado de datos fiscales de clientes.',
  'u-almacenamiento:tablas': 'Espacio de las tablas contra 1 GB previsto: hasta la mitad vale 100 y baja hasta 0 al llenarse.',
  'u-almacenamiento:auditoria': 'La bitácora de hoy más lo que crecerá en un año, contra 1 GB previsto: hasta la mitad vale 100.',
  'u-almacenamiento:bucket': 'Archivos fiscales contra 1 GB previsto: hasta la mitad vale 100 y baja hasta 0 al llenarse.',
}

export function reglaPieza(medidorId: string, p: PiezaMedida): string | null {
  return REGLA_PIEZA[`${medidorId}:${p.id}`] ?? REGLA_PIEZA[p.id] ?? null
}

const lista = (nombres: string[]) =>
  nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`

/** Por qué el medidor marca lo que marca, en lenguaje llano. */
export function porQueMarca(m: MedidorProceso): string {
  const conValor = m.piezas.filter((p) => p.valor != null)
  const sinValor = m.piezas.filter((p) => p.valor == null)
  const notaSin = sinValor.length
    ? ` ${lista(sinValor.map((p) => p.nombre))} ${sinValor.length === 1 ? 'no tiene' : 'no tienen'} lectura por ahora y no ${sinValor.length === 1 ? 'cuenta' : 'cuentan'}.`
    : ''
  if (m.valor == null || !conValor.length) {
    return `Todavía no hay lectura: ninguna de sus piezas tuvo actividad que medir. Sin datos no se califica, por eso se ve en gris.`
  }
  const v = m.valor
  const zona =
    v >= UMBRALES_SALUD[1]
      ? `Está en verde (de ${UMBRALES_SALUD[1]} a 100).`
      : v >= UMBRALES_SALUD[0]
        ? `Está en ámbar, precaución (de ${UMBRALES_SALUD[0]} a ${UMBRALES_SALUD[1] - 1}).`
        : `Está en rojo, alarma (debajo de ${UMBRALES_SALUD[0]}).`
  if (conValor.every((p) => p.valor === 100)) {
    return `Marca 100% porque ${conValor.length === 1 ? 'su pieza está' : `sus ${conValor.length} piezas están`} al 100%: ${lista(conValor.map((p) => p.nombre))}. ${zona}${notaSin} El medidor siempre lo manda la pieza más débil: basta que una baje para que baje todo.`
  }
  const peor = conValor.reduce((a, b) => ((b.valor ?? 100) < (a.valor ?? 100) ? b : a))
  const resto = conValor.filter((p) => p !== peor)
  const restoTxt = resto.length
    ? ` ${resto.every((p) => (p.valor ?? 0) >= UMBRALES_SALUD[1]) ? `Lo demás está bien (${lista(resto.map((p) => p.nombre))}).` : `También vigila ${lista(resto.filter((p) => (p.valor ?? 100) < UMBRALES_SALUD[1]).map((p) => `${p.nombre} (${p.valor}%)`))}.`}`
    : ''
  return `Marca ${v}% porque la pieza más débil es ${peor.nombre}: ${peor.corto === 'bien' ? peor.lectura : peor.corto}. El medidor lo manda siempre la pieza más débil. ${zona}${restoTxt}${notaSin}`
}

/** Diagnóstico de la pieza; si el servidor no lo trae (p. ej. Uniformes), se arma con su estado y su lectura. */
export function diagnosticoPieza(p: PiezaMedida): Diagnostico {
  if (p.diag) return p.diag
  const operatividad =
    p.estado === 'normal'
      ? { texto: 'Operando con normalidad', estado: p.estado }
      : p.estado === 'precaucion'
        ? { texto: 'Opera, con detalles por revisar', estado: p.estado }
        : p.estado === 'alarma'
          ? { texto: 'Con falla', estado: p.estado }
          : { texto: 'Sin lectura por ahora', estado: p.estado }
  return {
    operatividad,
    eficiencia: { texto: p.lectura, estado: p.estado },
    errores: p.fallo
      ? { texto: p.fallo, estado: 'alarma' }
      : p.estado === 'alarma'
        ? { texto: p.corto, estado: 'alarma' }
        : { texto: 'Sin errores detectados', estado: 'normal' },
  }
}
