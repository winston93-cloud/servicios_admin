/**
 * 2026-10-02: Traduce eventos de `alumno_contacto_auditoria` a una vista en lenguaje
 * llano para la pestaña Historial (sin códigos técnicos tipo "contacto.snapshot").
 */
import type { AlumnoContactoAuditoriaRegistro } from './alumnoContactoAuditoriaService'

export type CategoriaHistorial = 'mama' | 'papa' | 'familiar' | 'recoge' | 'emergencia'

/** inicial = foto de cómo estaba el contacto cuando arrancó el historial. */
export type TipoHistorial = 'inicial' | 'agregado' | 'modificado' | 'quitado' | 'comunicados'

export interface CambioCampoHistorial {
  campo: string
  antes: string
  despues: string
}

export interface VistaEventoHistorial {
  id: number
  fecha: string
  categoria: CategoriaHistorial
  tipo: TipoHistorial
  persona: string
  parentesco: string
  telefono: string
  /** true/false solo en tipo "comunicados". */
  recibeComunicados: boolean | null
  cambios: CambioCampoHistorial[]
  /** Quién hizo el cambio, listo para mostrar. Vacío en registros iniciales. */
  hechoPor: string
}

type Fila = Record<string, unknown>

function texto(v: unknown): string {
  return String(v ?? '').trim()
}

function nombreFamiliar(f: Fila): string {
  return [f.familiar_nombre, f.familiar_app, f.familiar_apm].map(texto).filter(Boolean).join(' ')
}

function siNo(v: unknown): string {
  if (v == null || v === '') return ''
  return Number(v) === 1 ? 'Sí' : 'No'
}

interface CampoComparable {
  campo: string
  /** Columnas de origen; si "before" no trae ninguna, no se compara (evita cambios falsos). */
  claves: string[]
  leer: (f: Fila) => string
}

const CAMPOS_FAMILIAR: CampoComparable[] = [
  {
    campo: 'Nombre',
    claves: ['familiar_nombre', 'familiar_app', 'familiar_apm'],
    leer: nombreFamiliar,
  },
  { campo: 'Correo', claves: ['familiar_email'], leer: (f) => texto(f.familiar_email) },
  { campo: 'Celular', claves: ['familiar_cel'], leer: (f) => texto(f.familiar_cel) },
  { campo: 'Teléfono de casa', claves: ['familiar_tel'], leer: (f) => texto(f.familiar_tel) },
  {
    campo: 'Teléfono del trabajo',
    claves: ['familiar_empresa_tel'],
    leer: (f) => texto(f.familiar_empresa_tel),
  },
  { campo: 'CURP', claves: ['familiar_curp'], leer: (f) => texto(f.familiar_curp) },
  {
    campo: 'Recibe comunicados',
    claves: ['familiar_recibir_email'],
    leer: (f) => siNo(f.familiar_recibir_email),
  },
]

const CAMPOS_CONTACTO: CampoComparable[] = [
  { campo: 'Nombre', claves: ['contacto_nombre'], leer: (f) => texto(f.contacto_nombre) },
  { campo: 'Parentesco', claves: ['tutor_clase'], leer: (f) => texto(f.tutor_clase) },
  { campo: 'Celular', claves: ['contacto_cel'], leer: (f) => texto(f.contacto_cel) },
  { campo: 'Teléfono de casa', claves: ['contacto_tel'], leer: (f) => texto(f.contacto_tel) },
]

function diferencias(
  campos: CampoComparable[],
  before: Fila,
  after: Fila
): CambioCampoHistorial[] {
  const out: CambioCampoHistorial[] = []
  for (const c of campos) {
    const tieneAmbos = (f: Fila) => c.claves.some((k) => k in f)
    if (!tieneAmbos(before) || !tieneAmbos(after)) continue
    const antes = c.leer(before)
    const despues = c.leer(after)
    if (antes !== despues) out.push({ campo: c.campo, antes, despues })
  }
  return out
}

function hechoPor(ev: AlumnoContactoAuditoriaRegistro): string {
  if (ev.actor_tipo === 'sistema') return ''
  if (ev.actor_tipo === 'portal') return 'Familia (portal de padres)'
  return ev.actor_label ? `Escuela · ${ev.actor_label}` : 'Escuela'
}

function capitalizar(s: string): string {
  const t = s.trim().toLowerCase()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

export function vistaEventoHistorial(ev: AlumnoContactoAuditoriaRegistro): VistaEventoHistorial {
  const d = (ev.detalle ?? {}) as Fila
  const before = (d.before as Fila | null | undefined) ?? {}
  const after = (d.after as Fila | null | undefined) ?? {}
  const actual = Object.keys(after).length ? after : before

  const base = {
    id: ev.id,
    fecha: ev.created_at,
    hechoPor: hechoPor(ev),
    recibeComunicados: null as boolean | null,
    cambios: [] as CambioCampoHistorial[],
  }

  const tipoPorAccion = (accion: string): TipoHistorial => {
    if (accion.endsWith('.snapshot')) return 'inicial'
    if (accion.endsWith('.insert')) return 'agregado'
    if (accion.endsWith('.delete')) return 'quitado'
    if (accion === 'familiar.recibir_email') return 'comunicados'
    return 'modificado'
  }

  if (ev.accion.startsWith('familiar.')) {
    const tutorId = Number(d.tutor_id ?? actual.tutor_id ?? 0)
    const categoria: CategoriaHistorial = tutorId === 1 ? 'mama' : tutorId === 2 ? 'papa' : 'familiar'
    const tipo = tipoPorAccion(ev.accion)
    return {
      ...base,
      categoria,
      tipo,
      persona: nombreFamiliar(actual) || 'Sin nombre',
      parentesco: categoria === 'mama' ? 'Mamá' : categoria === 'papa' ? 'Papá' : 'Otro familiar',
      telefono: texto(actual.familiar_cel) || texto(actual.familiar_tel),
      recibeComunicados:
        tipo === 'comunicados' ? Number(after.familiar_recibir_email) === 1 : null,
      cambios: tipo === 'modificado' ? diferencias(CAMPOS_FAMILIAR, before, after) : [],
    }
  }

  const contactoTipo = Number(d.contacto_tipo ?? actual.contacto_tipo ?? 0)
  const tipo = tipoPorAccion(ev.accion)
  return {
    ...base,
    categoria: contactoTipo === 1 ? 'emergencia' : 'recoge',
    tipo,
    persona: texto(actual.contacto_nombre) || 'Sin nombre',
    parentesco: capitalizar(texto(d.parentesco) || texto(actual.tutor_clase)),
    telefono: texto(actual.contacto_cel) || texto(actual.contacto_tel),
    cambios: tipo === 'modificado' ? diferencias(CAMPOS_CONTACTO, before, after) : [],
  }
}
