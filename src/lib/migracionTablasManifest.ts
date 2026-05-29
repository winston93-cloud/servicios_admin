/** Tablas MySQL (winston_general) → Supabase, en orden de dependencias (padres antes que hijos). */
export interface TablaMigracion {
  /** Identificador interno */
  id: string
  mysql: string
  supabase: string
  pk: string
  /** Grupo para selección en UI */
  grupo: 'alumnos' | 'catalogos' | 'pagos' | 'boletas' | 'desayunos' | 'sistema'
  etiqueta: string
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
    supabase: 'ciclos_escolares',
    pk: 'id',
    grupo: 'catalogos',
    etiqueta: 'Ciclos escolares',
  },
  {
    id: 'concepto_beca',
    mysql: 'concepto_beca',
    supabase: 'concepto_beca',
    pk: 'beca_id',
    grupo: 'catalogos',
    etiqueta: 'Conceptos de beca',
  },
  {
    id: 'concepto_boucher',
    mysql: 'concepto_boucher',
    supabase: 'concepto_boucher',
    pk: 'concepto_id',
    grupo: 'catalogos',
    etiqueta: 'Conceptos boucher',
  },
  {
    id: 'concepto_interno',
    mysql: 'concepto_interno',
    supabase: 'concepto_interno',
    pk: 'concepto_id',
    grupo: 'catalogos',
    etiqueta: 'Conceptos pago interno',
  },
  {
    id: 'concepto_desayunos',
    mysql: 'concepto_desayunos',
    supabase: 'concepto_desayunos',
    pk: 'concepto_id',
    grupo: 'desayunos',
    etiqueta: 'Conceptos desayunos',
  },
  // Alumnos
  {
    id: 'alumno',
    mysql: 'alumno',
    supabase: 'alumno',
    pk: 'alumno_id',
    grupo: 'alumnos',
    etiqueta: 'Alumnos',
  },
  {
    id: 'alumno_detalles',
    mysql: 'alumno_detalles',
    supabase: 'alumno_detalles',
    pk: 'detalle_id',
    grupo: 'alumnos',
    etiqueta: 'Detalles alumno',
  },
  {
    id: 'alumno_familiar',
    mysql: 'alumno_familiar',
    supabase: 'alumno_familiar',
    pk: 'familiar_id',
    grupo: 'alumnos',
    etiqueta: 'Familiares',
  },
  {
    id: 'alumno_contacto',
    mysql: 'alumno_contacto',
    supabase: 'alumno_contacto',
    pk: 'contacto_id',
    grupo: 'alumnos',
    etiqueta: 'Contactos autorizados',
  },
  {
    id: 'alumno_beca',
    mysql: 'alumno_beca',
    supabase: 'alumno_beca',
    pk: 'alumno_beca_id',
    grupo: 'alumnos',
    etiqueta: 'Becas alumno',
  },
  // Precios
  {
    id: 'pago_boucher_precio',
    mysql: 'pago_boucher_precio',
    supabase: 'pago_boucher_precio',
    pk: 'precio_id',
    grupo: 'pagos',
    etiqueta: 'Precios boucher',
  },
  {
    id: 'pago_interno_precio',
    mysql: 'pago_interno_precio',
    supabase: 'pago_interno_precio',
    pk: 'precio_interno_id',
    grupo: 'pagos',
    etiqueta: 'Precios pago interno',
  },
  // Boletas
  {
    id: 'boleta_materia',
    mysql: 'boleta_materia',
    supabase: 'boleta_materia',
    pk: 'materia_id',
    grupo: 'boletas',
    etiqueta: 'Materias boleta',
  },
  {
    id: 'boleta_maestro',
    mysql: 'boleta_maestro',
    supabase: 'boleta_maestro',
    pk: 'maestro_id',
    grupo: 'boletas',
    etiqueta: 'Maestros boleta',
  },
  {
    id: 'boleta_maestro_grupo',
    mysql: 'boleta_maestro_grupo',
    supabase: 'boleta_maestro_grupo',
    pk: 'grupo_id',
    grupo: 'boletas',
    etiqueta: 'Grupos maestro',
  },
  // Pagos (grandes)
  {
    id: 'pago_detalle',
    mysql: 'pago_detalle',
    supabase: 'pago_detalle',
    pk: 'pago_id',
    grupo: 'pagos',
    etiqueta: 'Pagos colegiatura',
  },
  {
    id: 'pago_interno',
    mysql: 'pago_interno',
    supabase: 'pago_interno',
    pk: 'pago_id',
    grupo: 'pagos',
    etiqueta: 'Pagos internos',
  },
  {
    id: 'pago_prorroga',
    mysql: 'pago_prorroga',
    supabase: 'pago_prorroga',
    pk: 'prorroga_id',
    grupo: 'pagos',
    etiqueta: 'Prórrogas',
  },
  // Desayunos
  {
    id: 'personal',
    mysql: 'personal',
    supabase: 'personal',
    pk: 'id',
    grupo: 'desayunos',
    etiqueta: 'Personal',
  },
  {
    id: 'pago_desayunos',
    mysql: 'pago_desayunos',
    supabase: 'pago_desayunos',
    pk: 'pago_id',
    grupo: 'desayunos',
    etiqueta: 'Pagos desayunos',
  },
  {
    id: 'usuario',
    mysql: 'usuario',
    supabase: 'usuario',
    pk: 'usuario_id',
    grupo: 'sistema',
    etiqueta: 'Usuarios',
  },
]

/** Orden inverso para borrar huérfanos (hijos antes que padres). */
export const TABLAS_MIGRACION_ELIMINAR = [...TABLAS_MIGRACION].reverse()

export const CAMPOS_SOLO_FECHA = new Set([
  'alumno_registro',
  'alumno_alta',
  'alumno_fecha_nac',
  'familiar_fecha_nac',
  'pago_fecha',
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
  'materia_registro',
  'maestro_registro',
  'grupo_registro',
  'prorroga_fecha',
  'created_at',
  'updated_at',
])
