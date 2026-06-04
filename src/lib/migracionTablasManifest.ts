/**
 * Tablas MySQL (winston_general) → InsForge (Winston Servicios).
 * Alcance: panel Servicios + portal de pagos (22 tablas), en orden de dependencias.
 */
export interface TablaMigracion {
  /** Identificador interno */
  id: string
  mysql: string
  /** Nombre de tabla en InsForge / Postgres */
  destino: string
  /** PK en InsForge */
  pk: string
  /** PK en MySQL si el nombre legacy difiere (ej. porroga_id → prorroga_id) */
  mysqlPk?: string
  /** Grupo para selección en UI */
  grupo: 'alumnos' | 'catalogos' | 'pagos' | 'boletas' | 'desayunos' | 'sistema'
  etiqueta: string
}

/** Nombre de la columna PK en MySQL (puede diferir del destino). */
export function pkMysql(def: TablaMigracion): string {
  return def.mysqlPk ?? def.pk
}

export const GRUPOS_MIGRACION: Record<TablaMigracion['grupo'], string> = {
  alumnos: 'Alumnos y familiares',
  catalogos: 'Catálogos y ciclos',
  pagos: 'Pagos (colegiaturas e internos)',
  boletas: 'Boletas / credenciales maestros',
  desayunos: 'Desayunos POS',
  sistema: 'Sistema',
}

export const TABLAS_MIGRACION: TablaMigracion[] = [
  // Catálogos base
  {
    id: 'ciclos_escolares',
    mysql: 'ciclos_escolares',
    destino: 'ciclos_escolares',
    pk: 'id',
    grupo: 'catalogos',
    etiqueta: 'Ciclos escolares',
  },
  {
    id: 'concepto_beca',
    mysql: 'concepto_beca',
    destino: 'concepto_beca',
    pk: 'beca_id',
    grupo: 'catalogos',
    etiqueta: 'Conceptos de beca',
  },
  {
    id: 'concepto_boucher',
    mysql: 'concepto_boucher',
    destino: 'concepto_boucher',
    pk: 'concepto_id',
    grupo: 'catalogos',
    etiqueta: 'Conceptos boucher',
  },
  {
    id: 'concepto_interno',
    mysql: 'concepto_interno',
    destino: 'concepto_interno',
    pk: 'concepto_id',
    grupo: 'catalogos',
    etiqueta: 'Conceptos pago interno',
  },
  {
    id: 'concepto_desayunos',
    mysql: 'concepto_desayunos',
    destino: 'concepto_desayunos',
    pk: 'id',
    grupo: 'desayunos',
    etiqueta: 'Conceptos desayunos',
  },
  // Alumnos
  {
    id: 'alumno',
    mysql: 'alumno',
    destino: 'alumno',
    pk: 'alumno_id',
    grupo: 'alumnos',
    etiqueta: 'Alumnos',
  },
  {
    id: 'alumno_detalles',
    mysql: 'alumno_detalles',
    destino: 'alumno_detalles',
    pk: 'detalle_id',
    grupo: 'alumnos',
    etiqueta: 'Detalles alumno',
  },
  {
    id: 'alumno_familiar',
    mysql: 'alumno_familiar',
    destino: 'alumno_familiar',
    pk: 'familiar_id',
    grupo: 'alumnos',
    etiqueta: 'Familiares',
  },
  {
    id: 'alumno_contacto',
    mysql: 'alumno_contacto',
    destino: 'alumno_contacto',
    pk: 'contacto_id',
    grupo: 'alumnos',
    etiqueta: 'Contactos autorizados',
  },
  {
    id: 'alumno_beca',
    mysql: 'alumno_beca',
    destino: 'alumno_beca',
    pk: 'alumno_beca_id',
    grupo: 'alumnos',
    etiqueta: 'Becas alumno',
  },
  // Precios
  {
    id: 'pago_boucher_precio',
    mysql: 'pago_boucher_precio',
    destino: 'pago_boucher_precio',
    pk: 'precio_id',
    grupo: 'pagos',
    etiqueta: 'Precios boucher',
  },
  {
    id: 'pago_interno_precio',
    mysql: 'pago_interno_precio',
    destino: 'pago_interno_precio',
    pk: 'precio_interno_id',
    grupo: 'pagos',
    etiqueta: 'Precios pago interno',
  },
  // Boletas
  {
    id: 'boleta_materia',
    mysql: 'boleta_materia',
    destino: 'boleta_materia',
    pk: 'materia_id',
    grupo: 'boletas',
    etiqueta: 'Materias boleta',
  },
  {
    id: 'boleta_maestro',
    mysql: 'boleta_maestro',
    destino: 'boleta_maestro',
    pk: 'maestro_id',
    grupo: 'boletas',
    etiqueta: 'Maestros boleta',
  },
  {
    id: 'boleta_maestro_grupo',
    mysql: 'boleta_maestro_grupo',
    destino: 'boleta_maestro_grupo',
    pk: 'grupo_id',
    grupo: 'boletas',
    etiqueta: 'Grupos maestro',
  },
  // Pagos (grandes)
  {
    id: 'pago_detalle',
    mysql: 'pago_detalle',
    destino: 'pago_detalle',
    pk: 'pago_id',
    grupo: 'pagos',
    etiqueta: 'Pagos colegiatura',
  },
  {
    id: 'pago_interno',
    mysql: 'pago_interno',
    destino: 'pago_interno',
    pk: 'pago_id',
    grupo: 'pagos',
    etiqueta: 'Pagos internos',
  },
  {
    id: 'pago_prorroga',
    mysql: 'pago_prorroga',
    destino: 'pago_prorroga',
    pk: 'prorroga_id',
    mysqlPk: 'porroga_id',
    grupo: 'pagos',
    etiqueta: 'Prórrogas',
  },
  // Desayunos
  {
    id: 'personal',
    mysql: 'personal',
    destino: 'personal',
    pk: 'id',
    grupo: 'desayunos',
    etiqueta: 'Personal',
  },
  {
    id: 'pago_desayunos',
    mysql: 'pago_desayunos',
    destino: 'pago_desayunos',
    pk: 'id',
    grupo: 'desayunos',
    etiqueta: 'Pagos desayunos',
  },
  {
    id: 'usuario',
    mysql: 'usuario',
    destino: 'usuario',
    pk: 'usuario_id',
    grupo: 'sistema',
    etiqueta: 'Usuarios',
  },
]

/** Orden inverso para borrar huérfanos (hijos antes que padres). */
export const TABLAS_MIGRACION_ELIMINAR = [...TABLAS_MIGRACION].reverse()

/**
 * Tablas en InsForge que referencian a otra del manifiesto pero no se migran desde MySQL.
 * Vacías antes que el padre en modo vaciar_copiar (p. ej. contratos RRHH en otros proyectos).
 */
export const TABLAS_VACIAR_ANTES: Partial<Record<string, string[]>> = {}

export const CAMPOS_SOLO_FECHA = new Set([
  'alumno_registro',
  'alumno_alta',
  'alumno_fecha_nac',
  'familiar_fecha_nac',
  'familiar_registro',
  'pago_fecha',
  'materia_registro',
  'maestro_registro',
  'grupo_registro',
  'prorroga_fecha',
])

export const CAMPOS_FECHA_HORA = new Set([
  'detalle_registro',
  'detalle_actualizacion',
  'alumno_actualizacion',
  'familiar_actualizacion',
  'contacto_actualizacion',
  'contacto_alta',
  'beca_registro',
  'beca_actualizacion',
  'pago_registro',
  'pago_actualizacion',
  'usuario_alta',
  'created_at',
  'updated_at',
])

/** NUMERIC(6,2) / NUMERIC(10,2) — comparar como decimal, no como texto. */
export function esCampoNumerico(clave: string): boolean {
  if (/^precio_(id|interno_id|ciclo)/.test(clave)) return false
  return (
    clave.startsWith('precio_') ||
    clave === 'pago_importe' ||
    clave === 'pago_recargo' ||
    clave === 'beca_porcentaje'
  )
}

/**
 * Columnas de auditoría que Postgres actualiza con triggers BEFORE UPDATE.
 * Tras un upsert en InsForge no coinciden con MySQL aunque el resto del espejo esté bien.
 */
export function debeCompararCampo(clave: string): boolean {
  if (clave.endsWith('_actualizacion')) return false
  if (clave === 'created_at' || clave === 'updated_at') return false
  return true
}
