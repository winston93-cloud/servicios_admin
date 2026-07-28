/**
 * Panel Control Escolar: pendientes (docs NI enviados sin a_inscritos)
 * y aprobados (ya liberados en a_inscritos).
 *
 * Solo cuenta envíos/autorizaciones desde el lanzamiento del módulo de liberar
 * (no el historial previo de portal_documentos_ni).
 */
import { supabase } from '@/lib/insforge'
import {
  construirNombreCompleto,
  grupoALetra,
} from '@/lib/alumnoBusquedaServicios'
import {
  CE_MODULO_LIBERAR_DESDE_ISO,
  ctrlDesdeAlumnoRef,
} from '@/lib/controlEscolarService'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'

/** @deprecated Preferir CE_MODULO_LIBERAR_DESDE_ISO */
export const CE_PANEL_DESDE_ISO = CE_MODULO_LIBERAR_DESDE_ISO

export type FilaPanelControlEscolar = {
  alumnoRef: string
  alumnoId: number | null
  nombre: string
  nivel: number | null
  nivelEtiqueta: string
  gradoEtiqueta: string
  grupoEtiqueta: string
  cicloValor: number | null
  estado: 'pendiente' | 'aprobado'
  docsEnviadoAt: string | null
  autorizadoEn: string | null
  autorizadoPor: string | null
  estatus: string | null
}

export type PanelControlEscolar = {
  pendientes: FilaPanelControlEscolar[]
  aprobados: FilaPanelControlEscolar[]
  resumen: {
    pendientes: number
    aprobados: number
    porNivel: Array<{
      nivel: number
      etiqueta: string
      pendientes: number
      aprobados: number
    }>
  }
}

type EnvioNi = {
  id: number
  alumno_id: number
  alumno_ref: number | string
  ciclo_valor: number
  nivel: number | null
  enviado_at: string
}

type InscritoRow = {
  id: number
  ctrl: string
  nombre: string | null
  estatus: string | null
  autorizado_por: string | null
  autorizado_en: string | null
  fecha: string | null
}

type AlumnoRow = {
  alumno_id: number
  alumno_ref: string | number
  alumno_nombre: string | null
  alumno_app: string | null
  alumno_apm: string | null
  alumno_nivel: number | null
  alumno_grado: string | number | null
  alumno_grupo: string | number | null
}

function limpiarNombreInscrito(nombre: string | null | undefined): string {
  return String(nombre ?? '')
    .replace(/\s*<\s*Registro Guardado\s*>\s*/i, '')
    .trim()
}

function filaBase(opts: {
  alumnoRef: string
  alumnoId: number | null
  nombre: string
  nivel: number | null
  grado: string | number | null
  grupo: string | number | null
  cicloValor: number | null
  estado: 'pendiente' | 'aprobado'
  docsEnviadoAt: string | null
  autorizadoEn: string | null
  autorizadoPor: string | null
  estatus: string | null
}): FilaPanelControlEscolar {
  const nivel = opts.nivel != null ? Number(opts.nivel) : null
  return {
    alumnoRef: opts.alumnoRef,
    alumnoId: opts.alumnoId,
    nombre: opts.nombre,
    nivel,
    nivelEtiqueta: nivel != null ? etiquetaNivelEscolar(nivel) || `Nivel ${nivel}` : '—',
    gradoEtiqueta:
      nivel != null
        ? etiquetaGradoEscolar(nivel, opts.grado) || '—'
        : opts.grado != null
          ? String(opts.grado)
          : '—',
    grupoEtiqueta: grupoALetra(opts.grupo) ?? '—',
    cicloValor: opts.cicloValor,
    estado: opts.estado,
    docsEnviadoAt: opts.docsEnviadoAt,
    autorizadoEn: opts.autorizadoEn,
    autorizadoPor: opts.autorizadoPor,
    estatus: opts.estatus,
  }
}

async function cargarAlumnosPorIds(ids: number[]): Promise<Map<number, AlumnoRow>> {
  const map = new Map<number, AlumnoRow>()
  const unicos = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))]
  for (let i = 0; i < unicos.length; i += 200) {
    const chunk = unicos.slice(i, i + 200)
    const { data, error } = await supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .in('alumno_id', chunk)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      map.set(Number(row.alumno_id), row as AlumnoRow)
    }
  }
  return map
}

async function cargarAlumnosPorRefs(refs: string[]): Promise<Map<string, AlumnoRow>> {
  const map = new Map<string, AlumnoRow>()
  const unicos = [...new Set(refs.map((r) => String(r).trim()).filter(Boolean))]
  for (let i = 0; i < unicos.length; i += 200) {
    const chunk = unicos.slice(i, i + 200)
    const { data, error } = await supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .in('alumno_ref', chunk)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const ref = String(row.alumno_ref ?? '').trim()
      if (ref) map.set(ref, row as AlumnoRow)
      const ctrl = ctrlDesdeAlumnoRef(ref)
      if (ctrl) map.set(ctrl, row as AlumnoRow)
    }
  }
  return map
}

/**
 * Último envío de docs NI por alumno+ciclo, cruzado con a_inscritos.
 * Pendiente = envió docs (desde el lanzamiento del módulo) y aún no está liberado.
 * Aprobado = fila en a_inscritos desde el lanzamiento del módulo.
 */
export async function listarPanelDocumentacionControlEscolar(): Promise<PanelControlEscolar> {
  const desde = CE_PANEL_DESDE_ISO
  const [
    { data: envios, error: errEnvios },
    { data: inscritos, error: errIns },
    { data: inscritosTodos, error: errInsTodos },
  ] = await Promise.all([
    supabase
      .from('portal_documentos_ni')
      .select('id, alumno_id, alumno_ref, ciclo_valor, nivel, enviado_at')
      .gte('enviado_at', desde)
      .order('enviado_at', { ascending: false })
      .limit(2500),
    supabase
      .from('a_inscritos')
      .select('id, ctrl, nombre, estatus, autorizado_por, autorizado_en, fecha')
      .gte('autorizado_en', desde)
      .order('autorizado_en', { ascending: false })
      .limit(2500),
    // Liberados reales (cualquier fecha) para no listar como pendiente a quien ya autorizaron.
    supabase.from('a_inscritos').select('ctrl').limit(5000),
  ])

  if (errEnvios) throw new Error(errEnvios.message)
  if (errIns) throw new Error(errIns.message)
  if (errInsTodos) throw new Error(errInsTodos.message)

  const latestEnvios = new Map<string, EnvioNi>()
  for (const row of (envios ?? []) as EnvioNi[]) {
    const key = `${row.alumno_id}:${row.ciclo_valor}`
    if (!latestEnvios.has(key)) latestEnvios.set(key, row)
  }

  const inscritosRows = (inscritos ?? []) as InscritoRow[]
  const ctrlsLiberados = new Set(
    (inscritosTodos ?? [])
      .map((r) => String(r.ctrl ?? '').replace(/\D/g, '').slice(-5))
      .filter(Boolean)
  )

  const envioPorCtrl = new Map<string, EnvioNi>()
  for (const envio of latestEnvios.values()) {
    const ctrl = ctrlDesdeAlumnoRef(envio.alumno_ref)
    if (ctrl && !envioPorCtrl.has(ctrl)) envioPorCtrl.set(ctrl, envio)
  }

  const alumnoIds = [
    ...new Set(
      [...latestEnvios.values()]
        .map((e) => Number(e.alumno_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ]
  const refsCandidatos = [
    ...new Set(
      inscritosRows
        .map((r) => String(r.ctrl ?? '').replace(/\D/g, '').slice(-5))
        .filter(Boolean)
    ),
  ]

  const [alumnosPorId, alumnosPorRef] = await Promise.all([
    cargarAlumnosPorIds(alumnoIds),
    cargarAlumnosPorRefs(refsCandidatos),
  ])

  const pendientes: FilaPanelControlEscolar[] = []
  for (const envio of latestEnvios.values()) {
    const ctrl = ctrlDesdeAlumnoRef(envio.alumno_ref)
    if (!ctrl || ctrlsLiberados.has(ctrl)) continue

    const alumno = alumnosPorId.get(Number(envio.alumno_id))
    const nombre = alumno
      ? construirNombreCompleto(
          alumno.alumno_nombre ?? '',
          alumno.alumno_app ?? '',
          alumno.alumno_apm ?? ''
        )
      : `Ref. ${envio.alumno_ref}`
    const nivel =
      envio.nivel != null
        ? Number(envio.nivel)
        : alumno?.alumno_nivel != null
          ? Number(alumno.alumno_nivel)
          : null

    pendientes.push(
      filaBase({
        alumnoRef: String(alumno?.alumno_ref ?? envio.alumno_ref).trim(),
        alumnoId: Number(envio.alumno_id) || null,
        nombre,
        nivel,
        grado: alumno?.alumno_grado ?? null,
        grupo: alumno?.alumno_grupo ?? null,
        cicloValor: Number(envio.ciclo_valor) || null,
        estado: 'pendiente',
        docsEnviadoAt: envio.enviado_at ? String(envio.enviado_at) : null,
        autorizadoEn: null,
        autorizadoPor: null,
        estatus: null,
      })
    )
  }

  pendientes.sort((a, b) => {
    const ta = a.docsEnviadoAt ? Date.parse(a.docsEnviadoAt) : 0
    const tb = b.docsEnviadoAt ? Date.parse(b.docsEnviadoAt) : 0
    return tb - ta
  })

  const aprobados: FilaPanelControlEscolar[] = []
  for (const row of inscritosRows) {
    const ctrl = String(row.ctrl ?? '').replace(/\D/g, '').slice(-5)
    if (!ctrl) continue

    const envio = envioPorCtrl.get(ctrl)
    const alumno =
      (envio ? alumnosPorId.get(Number(envio.alumno_id)) : undefined) ||
      alumnosPorRef.get(ctrl) ||
      null

    const nombre = alumno
      ? construirNombreCompleto(
          alumno.alumno_nombre ?? '',
          alumno.alumno_app ?? '',
          alumno.alumno_apm ?? ''
        )
      : limpiarNombreInscrito(row.nombre) || `Ctrl ${ctrl}`

    const nivel =
      envio?.nivel != null
        ? Number(envio.nivel)
        : alumno?.alumno_nivel != null
          ? Number(alumno.alumno_nivel)
          : null

    aprobados.push(
      filaBase({
        alumnoRef: String(alumno?.alumno_ref ?? envio?.alumno_ref ?? ctrl).trim(),
        alumnoId: alumno ? Number(alumno.alumno_id) : envio ? Number(envio.alumno_id) : null,
        nombre,
        nivel,
        grado: alumno?.alumno_grado ?? null,
        grupo: alumno?.alumno_grupo ?? null,
        cicloValor: envio ? Number(envio.ciclo_valor) || null : null,
        estado: 'aprobado',
        docsEnviadoAt: envio?.enviado_at ? String(envio.enviado_at) : null,
        autorizadoEn: row.autorizado_en ? String(row.autorizado_en) : null,
        autorizadoPor: row.autorizado_por ? String(row.autorizado_por) : null,
        estatus: row.estatus ? String(row.estatus) : null,
      })
    )
  }

  const niveles = [1, 2, 3, 4] as const
  const porNivel = niveles.map((nivel) => ({
    nivel,
    etiqueta: etiquetaNivelEscolar(nivel) || `Nivel ${nivel}`,
    pendientes: pendientes.filter((p) => p.nivel === nivel).length,
    aprobados: aprobados.filter((p) => p.nivel === nivel).length,
  }))

  return {
    pendientes,
    aprobados,
    resumen: {
      pendientes: pendientes.length,
      aprobados: aprobados.length,
      porNivel,
    },
  }
}
