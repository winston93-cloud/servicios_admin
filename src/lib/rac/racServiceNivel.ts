import { createHash, randomBytes } from 'crypto'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { grupoCoincide, letraDesdeGrupoNum } from '@/lib/boletasCiclo'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import { MATERIA_SLOT_ES } from '@/lib/catalogoMaestrosConstants'
import {
  RAC_TIPOS,
  etiquetaEscalon,
  etiquetaTipoCitatorio,
  etiquetaTipoReporte,
  fraseRegistroAvisoRac,
  motivoReporte,
} from '@/lib/racCatalogo'
import {
  asuntoReporte,
  enviarAvisoRac,
  escapeHtml,
  htmlCorreoRac,
  urlPublicaRac,
} from '@/lib/racCorreo'
import { filaPdfDesdeReporte, type FilaPdfReporte } from '@/lib/racPdf'
import { RacNivelAuthError, type RacSesionNivel } from './racAuthNivel'
import type { RacNivelConfig } from './racNivelConfig'
import { RAC_MATERNAL_KINDER, RAC_PRIMARIA } from './racNivelConfig'
import { puedeCapturarTipoNivel, puedeInformeNivel } from './racPermisosNivel'

const PERFIL_ETIQUETA: Record<number, string> = {
  1: 'MAESTRO',
  2: 'COORDINACIÓN',
  4: 'PSICOLOGÍA',
  5: 'PREFECTURA',
  6: 'DIRECCIÓN',
}

type AlumnoRow = {
  alumno_id: number
  alumno_ref: string | number | null
  alumno_app: string | null
  alumno_apm: string | null
  alumno_nombre: string | null
  alumno_nivel: number
  alumno_grado: number | string | null
  alumno_grupo: number | string | null
  alumno_status: number | null
  alumno_ciclo_escolar: number | string | null
}

function db() {
  return createDbAdmin()
}

function n(v: unknown, fallback = 0): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

function nombreAlumno(a: Pick<AlumnoRow, 'alumno_app' | 'alumno_apm' | 'alumno_nombre'>): string {
  return [a.alumno_app, a.alumno_apm, a.alumno_nombre].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
}

function mdv(prefix: string): string {
  return createHash('md5').update(`${prefix}${Date.now()}${randomBytes(8).toString('hex')}`).digest('hex')
}

export type AsignacionRacNivel = {
  grupo_id: number
  materia_id: number
  materia_nombre: string
  materia_grado: number
  materia_nivel: number
  grupo_letra: string
  /** Etiqueta amigable grado+grupo (sin materia). */
  etiqueta_grupo: string
}

function etiquetaGrado(cfg: RacNivelConfig, grado: number, nivelEscolar?: number): string {
  if (cfg.slug === 'maternal-kinder' && nivelEscolar != null) {
    // Maternal A/B son grados (1/2); Kinder 1–3 también. Misma nomenclatura que el resto del sistema.
    const label = etiquetaGradoEscolar(nivelEscolar, grado)
    if (label) return label
  }
  if (cfg.slug === 'maternal-kinder') {
    if (nivelEscolar === 1) {
      if (grado === 1) return 'Maternal A'
      if (grado === 2) return 'Maternal B'
      return `Maternal ${grado}`
    }
    if (nivelEscolar === 2) {
      if (grado === 1) return 'Kinder-1'
      if (grado === 2) return 'Kinder-2'
      if (grado === 3) return 'Kinder-3'
      return `Kinder-${grado}`
    }
  }
  return `${grado}° Primaria`
}

/** Grupo captura «*» = salón completo del grado (sin letra A/B/C en ficha). */
const GRUPO_SALON = '*'

function etiquetaAsignacionGrupo(
  cfg: RacNivelConfig,
  grado: number,
  nivelEscolar: number,
  grupoLetra: string
): string {
  const gradoLabel = etiquetaGrado(cfg, grado, nivelEscolar)
  const raw = String(grupoLetra ?? '').trim().toUpperCase()
  if (!raw || raw === GRUPO_SALON) return gradoLabel
  return `${gradoLabel} · Grupo ${raw}`
}

/**
 * Maternal: grado = Maternal A/B. `*` = solo ficha sin letra (grupo 0).
 * Letra A/B/C: solo esa letra — no repetir el salón en A y en B.
 */
function alumnoCoincideGrupoCaptura(
  nivelEscolar: number,
  grupoAlumno: number,
  grupoLetra: string
): boolean {
  const raw = String(grupoLetra ?? '').trim().toUpperCase()
  if (!raw || raw === GRUPO_SALON) {
    if (nivelEscolar === 1) return Number(grupoAlumno) === 0
    return true
  }
  return grupoCoincide(raw, grupoAlumno)
}

export function createRacNivelService(cfg: RacNivelConfig) {
  async function cicloRac(): Promise<number> {
    return resolverCicloEscolarSistemaValor()
  }

  function esAlumnoDeNivel(nivel: number): boolean {
    return cfg.nivelesEscolares.includes(nivel as (typeof cfg.nivelesEscolares)[number])
  }

  async function nextMateriaId(): Promise<number> {
    const { data } = await db()
      .from('boleta_materia')
      .select('materia_id')
      .order('materia_id', { ascending: false })
      .limit(1)
    return n(data?.[0]?.materia_id, 0) + 1
  }

  /** Crea slot Maestro(a) si falta — inline para no depender del módulo Servicios en runtime. */
  async function ensureSlotEs(nivelEscolar: number, grado: number): Promise<number> {
    const client = db()
    const { data: existente } = await client
      .from('boleta_materia')
      .select('materia_id, materia_nombre, materia_nivel, materia_grado, materia_orden')
      .eq('materia_nivel', nivelEscolar)
      .eq('materia_grado', grado)
      .eq('materia_orden', MATERIA_SLOT_ES.orden)
      .maybeSingle()
    if (existente) return n(existente.materia_id)

    const materiaId = await nextMateriaId()
    const { error } = await client.from('boleta_materia').insert([
      {
        materia_id: materiaId,
        materia_nombre: MATERIA_SLOT_ES.nombre,
        materia_nivel: nivelEscolar,
        materia_grado: grado,
        materia_orden: MATERIA_SLOT_ES.orden,
      },
    ])
    if (error) throw new Error(error.message)
    return materiaId
  }

  async function gradosYGruposDesdeAlumnos(): Promise<
    { nivelEscolar: number; grado: number; grupos: string[] }[]
  > {
    const ciclo = await cicloRac()
    const { data } = await db()
      .from('alumno')
      .select('alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar')
      .in('alumno_nivel', cfg.nivelesEscolares)
      .neq('alumno_status', 0)
    const map = new Map<
      string,
      { nivelEscolar: number; grado: number; letras: Set<string>; tieneSinLetra: boolean }
    >()
    for (const a of data ?? []) {
      if (n(a.alumno_status) === 2 && n(a.alumno_ciclo_escolar) !== ciclo) continue
      const nivelEscolar = n(a.alumno_nivel)
      const grado = n(a.alumno_grado)
      if (!grado) continue
      const letra = letraDesdeGrupoNum(n(a.alumno_grupo))
      // Maternal A/B: grupo 0 = salón del grado (sin letra). Kinder/primaria sin letra se omiten.
      if (!letra && nivelEscolar !== 1) continue
      const key = `${nivelEscolar}-${grado}`
      let entry = map.get(key)
      if (!entry) {
        entry = { nivelEscolar, grado, letras: new Set<string>(), tieneSinLetra: false }
        map.set(key, entry)
      }
      if (letra) entry.letras.add(letra)
      else entry.tieneSinLetra = true
    }
    const rows = [...map.values()]
      .map((e) => {
        // Maternal sin letras reales → un solo salón (no inventar Grupo A y B idénticos).
        if (e.nivelEscolar === 1) {
          const grupos: string[] = []
          if (e.tieneSinLetra || e.letras.size === 0) grupos.push(GRUPO_SALON)
          grupos.push(...[...e.letras].sort())
          return { nivelEscolar: e.nivelEscolar, grado: e.grado, grupos }
        }
        return {
          nivelEscolar: e.nivelEscolar,
          grado: e.grado,
          grupos: e.letras.size ? [...e.letras].sort() : [...cfg.gruposCaptura],
        }
      })
      .sort((a, b) => a.nivelEscolar - b.nivelEscolar || a.grado - b.grado)
    if (rows.length) return rows
    return cfg.gradosFallback.map((g) => ({
      nivelEscolar: g.nivelEscolar,
      grado: g.grado,
      grupos: g.nivelEscolar === 1 ? [GRUPO_SALON] : [...cfg.gruposCaptura],
    }))
  }

  async function asignacionesDesdeGrados(
    grados: { nivelEscolar: number; grado: number; grupos?: readonly string[] }[]
  ): Promise<AsignacionRacNivel[]> {
    const asignaciones: AsignacionRacNivel[] = []
    await Promise.all(
      grados.map(async (g) => {
        try {
          const materiaId = await ensureSlotEs(g.nivelEscolar, g.grado)
          const grupos = g.grupos?.length
            ? g.grupos
            : g.nivelEscolar === 1
              ? [GRUPO_SALON]
              : cfg.gruposCaptura
          for (const letra of grupos) {
            asignaciones.push({
              grupo_id: 0,
              materia_id: materiaId,
              materia_nombre: MATERIA_SLOT_ES.nombre,
              materia_grado: g.grado,
              materia_nivel: g.nivelEscolar,
              grupo_letra: letra,
              etiqueta_grupo: etiquetaAsignacionGrupo(cfg, g.grado, g.nivelEscolar, letra),
            })
          }
        } catch {
          /* otro grado puede seguir */
        }
      })
    )
    return asignaciones.sort(
      (a, b) =>
        a.materia_nivel - b.materia_nivel ||
        a.materia_grado - b.materia_grado ||
        (a.grupo_letra === GRUPO_SALON ? '' : a.grupo_letra).localeCompare(
          b.grupo_letra === GRUPO_SALON ? '' : b.grupo_letra
        )
    )
  }

  async function listarAsignaciones(session: RacSesionNivel): Promise<{
    asignaciones: AsignacionRacNivel[]
    fisica: boolean
    ingles: boolean
  }> {
    const client = db()
    if (session.role === 'maestro') {
      const { data: grupos, error } = await client
        .from('boleta_maestro_grupo')
        .select('grupo_id, maestro_id, materia_id, grupo_letra')
        .eq('maestro_id', session.id)
      if (error) throw new Error(error.message)
      const materiaIds = [...new Set((grupos ?? []).map((g) => n(g.materia_id)))]
      if (materiaIds.length) {
        const { data: materias } = await client
          .from('boleta_materia')
          .select('materia_id, materia_nombre, materia_grado, materia_nivel, materia_orden')
          .in('materia_id', materiaIds)
          .in('materia_nivel', cfg.nivelesEscolares)
        const map = new Map((materias ?? []).map((m) => [n(m.materia_id), m]))
        const asignaciones = (grupos ?? [])
          .map((g) => {
            const m = map.get(n(g.materia_id))
            if (!m) return null
            const grado = n(m.materia_grado)
            const nivelMat = n(m.materia_nivel)
            const letra = String(g.grupo_letra ?? 'A')
            return {
              grupo_id: n(g.grupo_id),
              materia_id: n(g.materia_id),
              materia_nombre: String(m.materia_nombre ?? ''),
              materia_grado: grado,
              materia_nivel: nivelMat,
              grupo_letra: letra,
              etiqueta_grupo: `${etiquetaGrado(cfg, grado, nivelMat)} · Grupo ${letra}`,
            }
          })
          .filter(Boolean) as AsignacionRacNivel[]
        if (asignaciones.length) return { asignaciones, fisica: true, ingles: true }
      }
    }

    // Staff: grados/grupos reales desde alumnos (1=A, 2=B, 3=C…), no solo cfg.gruposCaptura.
    const gradosGrupos = await gradosYGruposDesdeAlumnos()
    const asignaciones = await asignacionesDesdeGrados(gradosGrupos)
    return { asignaciones, fisica: true, ingles: true }
  }

  async function alumnosDeGrupo(
    grado: number,
    grupoLetra: string,
    ciclo: number,
    nivelEscolar?: number
  ): Promise<AlumnoRow[]> {
    const niveles = nivelEscolar ? [nivelEscolar] : cfg.nivelesEscolares
    const { data, error } = await db()
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar'
      )
      .in('alumno_nivel', niveles)
      .eq('alumno_grado', grado)
      .neq('alumno_status', 0)
      .order('alumno_app')
    if (error) throw new Error(error.message)
    return ((data ?? []) as AlumnoRow[]).filter((a) => {
      if (n(a.alumno_status) === 2 && n(a.alumno_ciclo_escolar) !== ciclo) return false
      const niv = n(a.alumno_nivel)
      return alumnoCoincideGrupoCaptura(niv, n(a.alumno_grupo), grupoLetra)
    })
  }

  async function marcasPorAlumnos(
    alumnoIds: number[],
    tipo: number,
    ciclo: number,
    materiaId: number | null
  ): Promise<Map<number, Record<number, string>>> {
    const out = new Map<number, Record<number, string>>()
    for (const id of alumnoIds) out.set(id, {})
    if (!alumnoIds.length) return out

    let q = db()
      .from('reporte_escolar')
      .select('alumno_id, reporte_no, reporte_registro, reporte_ciclo')
      .in('alumno_id', alumnoIds)
      .eq('reporte_tipo', tipo)
      .eq('reporte_status', 1)
      .eq('reporte_ciclo_escolar', ciclo)
    if (materiaId) q = q.eq('materia_id', materiaId)
    const { data, error } = await q
    if (error) throw new Error(error.message)

    const byAlumno = new Map<number, { reporte_no: unknown; reporte_registro: unknown; reporte_ciclo: unknown }[]>()
    for (const r of data ?? []) {
      const aid = n(r.alumno_id)
      const list = byAlumno.get(aid) ?? []
      list.push(r)
      byAlumno.set(aid, list)
    }
    for (const [aid, rows] of byAlumno) {
      const maxC = rows.reduce((acc, r) => Math.max(acc, n(r.reporte_ciclo)), 0)
      const cur = rows.filter((r) => n(r.reporte_ciclo) === maxC)
      const fechas: Record<number, string> = {}
      for (const r of cur) fechas[n(r.reporte_no)] = String(r.reporte_registro ?? '').slice(0, 10)
      out.set(aid, fechas)
    }
    return out
  }

  async function listarGrupoCaptura(opts: {
    materiaId?: number
    grupoLetra: string
    tipo: number
    nivelEscolar?: number
    grado?: number
  }) {
    const ciclo = await cicloRac()
    let materiaId = n(opts.materiaId)
    let grado = n(opts.grado)
    let nivelMat = n(opts.nivelEscolar)

    if (materiaId) {
      const { data: materia } = await db()
        .from('boleta_materia')
        .select('materia_id, materia_nombre, materia_grado, materia_nivel')
        .eq('materia_id', materiaId)
        .maybeSingle()
      if (!materia) throw new Error('Grupo no encontrado')
      nivelMat = n(materia.materia_nivel)
      grado = n(materia.materia_grado)
    } else if (nivelMat && grado) {
      materiaId = await ensureSlotEs(nivelMat, grado)
    } else {
      throw new Error('materiaId o nivel+grado requeridos')
    }

    if (!cfg.nivelesEscolares.includes(nivelMat as (typeof cfg.nivelesEscolares)[number])) {
      throw new Error('Grupo no corresponde a este nivel')
    }

    const alumnos = await alumnosDeGrupo(grado, opts.grupoLetra, ciclo, nivelMat)
    const matFiltro = opts.tipo === 1 ? materiaId : null
    const marcasMap = await marcasPorAlumnos(
      alumnos.map((a) => a.alumno_id),
      opts.tipo,
      ciclo,
      matFiltro
    )
    const filas = alumnos.map((a) => {
      const f = marcasMap.get(a.alumno_id) ?? {}
      return {
        alumno_id: a.alumno_id,
        alumno_ref: a.alumno_ref,
        nombre: nombreAlumno(a),
        grado: n(a.alumno_grado),
        grupo: letraDesdeGrupoNum(n(a.alumno_grupo)),
        aviso: f[0] ?? '',
        r1: f[1] ?? '',
        r2: f[2] ?? '',
        r3: f[3] ?? '',
      }
    })
    return {
      ciclo,
      materia: {
        materia_id: materiaId,
        materia_nombre: `${etiquetaGrado(cfg, grado, nivelMat)} · Grupo ${opts.grupoLetra}`,
        materia_grado: grado,
      },
      filas,
    }
  }

  async function emailsFamilia(alumnoId: number): Promise<string[]> {
    const { data } = await db()
      .from('alumno_familiar')
      .select('familiar_email, familiar_recibir_email')
      .eq('alumno_id', alumnoId)
    const rows = data ?? []
    const pref = rows
      .filter((r) => n(r.familiar_recibir_email) === 1)
      .map((r) => String(r.familiar_email ?? '').trim().toLowerCase())
      .filter((e) => e.includes('@'))
    if (pref.length) return [...new Set(pref)]
    return [
      ...new Set(
        rows.map((r) => String(r.familiar_email ?? '').trim().toLowerCase()).filter((e) => e.includes('@'))
      ),
    ]
  }

  async function cargarAlumno(id: number): Promise<AlumnoRow> {
    const { data } = await db()
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar'
      )
      .eq('alumno_id', id)
      .maybeSingle()
    if (!data) throw new Error('Alumno no encontrado')
    if (!cfg.nivelesEscolares.includes(n(data.alumno_nivel) as (typeof cfg.nivelesEscolares)[number])) {
      throw new Error('Alumno no pertenece a este nivel')
    }
    return data as AlumnoRow
  }

  async function sincronizarCitaGoogleCalendar(opts: {
    citaId: number
    alumnoId: number
    tipo: number
    mensaje: string
    fecha: string
    hora: string
    actorRole: RacSesionNivel['role']
  }) {
    if (opts.actorRole !== 'psicologia') return
    if (!opts.fecha || !opts.hora) return
    const alumno = await cargarAlumno(opts.alumnoId)
    const nombre = nombreAlumno(alumno)
    const ref = alumno.alumno_ref ?? ''
    const level = cfg.slug === 'primaria' ? 'primaria' : 'maternal-kinder'
    const { createRacCitaCalendarEvent, etiquetaNivelRacCalendar } = await import(
      '@/lib/racGoogleCalendar'
    )
    const nivelEtiqueta = etiquetaNivelRacCalendar(level)
    const cal = await createRacCitaCalendarEvent({
      level,
      summary: `Cita papás RAC — ${nombre}${ref ? ` (${ref})` : ''}`,
      description: [
        `Citatorio RAC ${nivelEtiqueta}`,
        `Tipo: ${etiquetaTipoCitatorio(opts.tipo)}`,
        `Alumno: ${nombre}`,
        ref ? `No. control: ${ref}` : '',
        opts.mensaje ? `Mensaje: ${opts.mensaje}` : '',
        `cita_id: ${opts.citaId}`,
      ]
        .filter(Boolean)
        .join('\n'),
      date: opts.fecha,
      time: opts.hora.slice(0, 5),
      durationMinutes: 45,
    })
    if (cal.ok && cal.eventId) {
      await db()
        .from('reporte_cita')
        .update({ cita_google_event_id: cal.eventId })
        .eq('cita_id', opts.citaId)
    } else if (!cal.skipped) {
      console.warn(`[rac-nivel:${cfg.slug}] Google Calendar cita falló:`, cal.error)
    }
  }

  async function enviarCorreoReporte(reporteId: number) {
    const client = db()
    const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_id', reporteId).maybeSingle()
    if (!r) throw new Error('Reporte no encontrado')
    const alumno = await cargarAlumno(n(r.alumno_id))
    const to = await emailsFamilia(alumno.alumno_id)
    if (!to.length) return { ok: false, error: 'La familia no tiene correo registrado' }
    const tipo = n(r.reporte_tipo)
    const no = n(r.reporte_no)
    const alt = tipo === 5 ? 3 : tipo === 8 ? 4 : 1
    let materiaNombre = ''
    if (r.materia_id) {
      const { data: m } = await client
        .from('boleta_materia')
        .select('materia_nombre, materia_grado, materia_nivel')
        .eq('materia_id', r.materia_id)
        .maybeSingle()
      materiaNombre = m
        ? `${etiquetaGrado(cfg, n(m.materia_grado), n(m.materia_nivel))} · ${String(m.materia_nombre ?? '')}`
        : ''
    }
    const enlace = urlPublicaRac(String(r.reporte_mdv), alt)
    const subject = asuntoReporte(tipo, no)
    const frase = fraseRegistroAvisoRac(tipo, no)
    const motivoTxt = motivoReporte(tipo, n(r.reporte_motivo))
    const mostrarMotivo = tipo !== 5
    const html = htmlCorreoRac({
      titulo: subject,
      enlace,
      cuerpoHtml: `<p>Estimada familia:</p>
      <p>Se registró un <b>${escapeHtml(frase)}</b>
      para <b>${escapeHtml(nombreAlumno(alumno))}</b> (control ${escapeHtml(String(alumno.alumno_ref ?? ''))}).</p>
      ${
        mostrarMotivo
          ? `<p>Motivo: <b>${escapeHtml(motivoTxt)}</b>${
              materiaNombre ? ` · Grupo: <b>${escapeHtml(materiaNombre)}</b>` : ''
            }</p>`
          : materiaNombre
            ? `<p>Grupo: <b>${escapeHtml(materiaNombre)}</b></p>`
            : ''
      }
      <p>${escapeHtml(String(r.reporte_mensaje ?? '')).replace(/\n/g, '<br>')}</p>`,
    })
    const envio = await enviarAvisoRac({ to, subject, html })
    if (envio.ok) await client.from('reporte_escolar').update({ reporte_enviado: 1 }).eq('reporte_id', reporteId)
    return envio
  }

  async function enviarCorreoCita(citaId: number) {
    const client = db()
    const { data: c } = await client.from('reporte_cita').select('*').eq('cita_id', citaId).maybeSingle()
    if (!c) throw new Error('Cita no encontrada')
    const alumno = await cargarAlumno(n(c.alumno_id))
    const to = await emailsFamilia(alumno.alumno_id)
    if (!to.length) return { ok: false, error: 'La familia no tiene correo registrado' }
    const enlace = urlPublicaRac(String(c.cita_mdv), 2)
    const fecha = c.cita_fecha ? String(c.cita_fecha).replace('T', ' ').slice(0, 16) : 'por confirmar'
    const subject = `Citatorio ${etiquetaTipoCitatorio(n(c.cita_tipo))}`
    const html = htmlCorreoRac({
      titulo: subject,
      enlace,
      cuerpoHtml: `<p>Estimada familia:</p>
      <p>Citatorio <b>${escapeHtml(etiquetaTipoCitatorio(n(c.cita_tipo)))}</b> para
      <b>${escapeHtml(nombreAlumno(alumno))}</b>.</p>
      <p>Fecha y hora: <b>${escapeHtml(fecha)}</b></p>
      <p>${escapeHtml(String(c.cita_mensaje ?? ''))}</p>`,
    })
    const envio = await enviarAvisoRac({ to, subject, html })
    if (envio.ok) await client.from('reporte_cita').update({ cita_enviada: 1 }).eq('cita_id', citaId)
    return envio
  }

  async function enviarCorreoSuspension(suspensionId: number) {
    const client = db()
    const { data: s } = await client
      .from('reporte_suspension')
      .select('*')
      .eq('suspension_id', suspensionId)
      .maybeSingle()
    if (!s) throw new Error('Suspensión no encontrada')
    const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_id', s.reporte_id).maybeSingle()
    const alumno = await cargarAlumno(n(s.alumno_id))
    const to = await emailsFamilia(alumno.alumno_id)
    if (!to.length) return { ok: false, error: 'La familia no tiene correo registrado' }
    const enlace = urlPublicaRac(String(r?.reporte_mdv ?? ''), 5)
    const subject = 'Aviso de suspensión'
    const html = htmlCorreoRac({
      titulo: subject,
      enlace,
      cuerpoHtml: `<p>Estimada familia:</p>
      <p>El alumno <b>${escapeHtml(nombreAlumno(alumno))}</b> queda suspendido el día
      <b>${escapeHtml(String(s.suspension_fecha ?? ''))}</b> por acumular tres reportes
      ${escapeHtml(etiquetaTipoCitatorio(n(r?.reporte_tipo ?? 2)).toLowerCase())}.</p>`,
    })
    const envio = await enviarAvisoRac({ to, subject, html })
    if (envio.ok) {
      await client.from('reporte_suspension').update({ suspension_enviada: 1 }).eq('suspension_id', suspensionId)
    }
    return envio
  }

  async function capturarReporte(opts: {
    session: RacSesionNivel
    alumnoId: number
    materiaId: number
    tipo: number
    motivo: number
    mensaje: string
  }) {
    const { fisica } = await listarAsignaciones(opts.session)
    if (!puedeCapturarTipoNivel(opts.session.role, opts.tipo, fisica, cfg)) {
      throw new RacNivelAuthError('Este tipo de reporte no corresponde a tu cuenta', 403)
    }
    const ciclo = await cicloRac()
    const client = db()
    await cargarAlumno(opts.alumnoId)
    const materiaId =
      opts.tipo === RAC_TIPOS.academico || opts.tipo === RAC_TIPOS.informeAcademico ? opts.materiaId : opts.materiaId
    const token = mdv('rep')

    let q = client
      .from('reporte_escolar')
      .select('reporte_no, reporte_ciclo')
      .eq('alumno_id', opts.alumnoId)
      .eq('reporte_tipo', opts.tipo)
      .eq('reporte_status', 1)
      .eq('reporte_ciclo_escolar', ciclo)
    if (opts.tipo === 1 && materiaId) q = q.eq('materia_id', materiaId)
    const { data: prev } = await q
    let reporteCiclo = 0
    let reporteNo = opts.tipo > 2 ? 1 : 0
    if (prev?.length) {
      reporteCiclo = prev.reduce((acc, r) => Math.max(acc, n(r.reporte_ciclo)), 0)
      reporteNo =
        prev.filter((r) => n(r.reporte_ciclo) === reporteCiclo).reduce((acc, r) => Math.max(acc, n(r.reporte_no)), -1) +
        1
    }
    if (reporteNo === 4) {
      reporteCiclo += 1
      reporteNo = opts.tipo > 2 ? 1 : 0
    }

    let status = 1
    if (opts.tipo === 2 && opts.session.perfil !== 4) status = 2

    const insert: Record<string, unknown> = {
      alumno_id: opts.alumnoId,
      perfil_id: opts.session.perfil,
      usuario_id: opts.session.id,
      reporte_tipo: opts.tipo,
      reporte_motivo: opts.motivo,
      reporte_no: reporteNo,
      reporte_mensaje: opts.mensaje,
      reporte_status: status,
      reporte_ciclo: reporteCiclo,
      reporte_ciclo_escolar: ciclo,
      reporte_mdv: token,
    }
    if (materiaId) insert.materia_id = materiaId

    const { data: created, error } = await client.from('reporte_escolar').insert(insert).select('reporte_id').maybeSingle()
    if (error || !created) throw new Error(error?.message || 'No se pudo guardar el reporte')
    const reporteId = n(created.reporte_id)

    if (status === 2) {
      return { reporteId, reporteNo, pendienteValidacion: true, envio: { ok: true } }
    }
    if (reporteNo === 2) {
      await client.from('reporte_cita').insert({
        alumno_id: opts.alumnoId,
        materia_id: materiaId || null,
        perfil_id: opts.session.perfil,
        usuario_id: opts.session.id,
        cita_tipo: opts.tipo,
        cita_mensaje: `Citatorio generado por ${etiquetaEscalon(opts.tipo, 2)}.`,
        cita_status: 2,
        cita_ciclo_escolar: ciclo,
        cita_mdv: token,
      })
    }
    if (reporteNo === 3) {
      await client.from('reporte_suspension').insert({
        alumno_id: opts.alumnoId,
        reporte_id: reporteId,
        suspension_ciclo_escolar: ciclo,
      })
    }
    const envio = await enviarCorreoReporte(reporteId)
    return { reporteId, reporteNo, pendienteValidacion: false, envio }
  }

  async function capturarInforme(opts: {
    session: RacSesionNivel
    alumnoId: number
    materiaId: number
    mensaje: string
    /** Motivo del aviso de Psicología (tipo 8). Informe académico usa 0. */
    motivo?: number
  }) {
    const ciclo = await cicloRac()
    if (!puedeInformeNivel(opts.session.role)) {
      throw new RacNivelAuthError('Tu cuenta no captura informes', 403)
    }
    await cargarAlumno(opts.alumnoId)
    const psico = opts.session.role === 'psicologia'
    const motivoPsico = n(opts.motivo)
    const insert: Record<string, unknown> = {
      alumno_id: opts.alumnoId,
      perfil_id: opts.session.perfil,
      usuario_id: opts.session.id,
      reporte_tipo: psico ? RAC_TIPOS.avisoPsicologia : RAC_TIPOS.informeAcademico,
      reporte_motivo: psico ? (motivoPsico > 0 ? motivoPsico : 1) : 0,
      reporte_no: 0,
      reporte_mensaje: opts.mensaje,
      reporte_status: 1,
      reporte_ciclo: 0,
      reporte_ciclo_escolar: ciclo,
      reporte_mdv: mdv('inf'),
    }
    if (!psico && opts.materiaId) insert.materia_id = opts.materiaId
    const { data, error } = await db().from('reporte_escolar').insert(insert).select('reporte_id').maybeSingle()
    if (error || !data) throw new Error(error?.message || 'No se guardó el informe')
    return { reporteId: n(data.reporte_id), envio: await enviarCorreoReporte(n(data.reporte_id)) }
  }

  async function capturarCita(opts: {
    session: RacSesionNivel
    alumnoId: number
    materiaId: number
    tipo: number
    mensaje: string
    fecha: string
    hora: string
  }) {
    const ciclo = await cicloRac()
    await cargarAlumno(opts.alumnoId)
    const { data, error } = await db()
      .from('reporte_cita')
      .insert({
        alumno_id: opts.alumnoId,
        materia_id: opts.materiaId || null,
        perfil_id: opts.session.perfil,
        usuario_id: opts.session.id,
        cita_tipo: opts.tipo,
        cita_mensaje: opts.mensaje,
        cita_status: 1,
        cita_ciclo_escolar: ciclo,
        cita_mdv: mdv('cit'),
        cita_fecha: `${opts.fecha}T${opts.hora}:00`,
      })
      .select('cita_id')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message || 'No se guardó la cita')
    const citaId = n(data.cita_id)
    await sincronizarCitaGoogleCalendar({
      citaId,
      alumnoId: opts.alumnoId,
      tipo: opts.tipo,
      mensaje: opts.mensaje,
      fecha: opts.fecha,
      hora: opts.hora,
      actorRole: opts.session.role,
    })
    return { citaId, envio: await enviarCorreoCita(citaId) }
  }

  async function hidratar(rows: Record<string, unknown>[]) {
    if (!rows.length) return []
    const client = db()
    const alumnoIds = [...new Set(rows.map((r) => n(r.alumno_id)))]
    const materiaIds = [...new Set(rows.map((r) => n(r.materia_id)).filter(Boolean))]
    const { data: alumnos } = await client
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar, alumno_nivel'
      )
      .in('alumno_id', alumnoIds)
    const aMap = new Map((alumnos ?? []).map((a) => [n(a.alumno_id), a as AlumnoRow]))
    let mMap = new Map<number, string>()
    if (materiaIds.length) {
      const { data: mats } = await client
        .from('boleta_materia')
        .select('materia_id, materia_nombre, materia_grado')
        .in('materia_id', materiaIds)
      mMap = new Map(
        (mats ?? []).map((m) => [
          n(m.materia_id),
          `${etiquetaGrado(cfg, n(m.materia_grado))} · ${String(m.materia_nombre ?? '')}`,
        ])
      )
    }
    return rows
      .map((r) => {
        const a = aMap.get(n(r.alumno_id))
        if (a && !cfg.nivelesEscolares.includes(n(a.alumno_nivel) as (typeof cfg.nivelesEscolares)[number])) {
          return null
        }
        return {
          reporte_id: n(r.reporte_id),
          alumno_id: n(r.alumno_id),
          alumno_ref: a?.alumno_ref ?? null,
          nombre: a ? nombreAlumno(a) : '',
          grado: a ? n(a.alumno_grado) : 0,
          grupo: a ? letraDesdeGrupoNum(n(a.alumno_grupo)) : '',
          materia: mMap.get(n(r.materia_id)) ?? '',
          tipo: n(r.reporte_tipo),
          tipoEtiqueta: etiquetaTipoReporte(n(r.reporte_tipo)),
          escalon: etiquetaEscalon(n(r.reporte_tipo), n(r.reporte_no)),
          motivo: motivoReporte(n(r.reporte_tipo), n(r.reporte_motivo)),
          mensaje: String(r.reporte_mensaje ?? ''),
          no: n(r.reporte_no),
          vuelta: n(r.reporte_ciclo),
          fecha: String(r.reporte_registro ?? '').slice(0, 10),
          enviado: n(r.reporte_enviado) === 1,
          confirmado: n(r.reporte_confirmado) === 1,
          status: n(r.reporte_status),
          mdv: String(r.reporte_mdv ?? ''),
        }
      })
      .filter(Boolean)
  }

  async function inboxReportes(session: RacSesionNivel, filtro: 'pendientes' | 'informes' | 'todos') {
    const ciclo = await cicloRac()
    // Sin .in(alumno_id, miles de ids): eso tumba OpenResty (502) en primaria (~800+).
    // Se filtra por nivel al hidratar, igual que el resto del módulo.
    let q = db().from('reporte_escolar').select('*').eq('reporte_ciclo_escolar', ciclo)
    if (session.role === 'psicologia' && filtro === 'pendientes') {
      q = q.eq('reporte_status', 2).eq('reporte_tipo', RAC_TIPOS.conducta)
    } else {
      q = q.eq('reporte_status', 1)
      if (filtro === 'pendientes') q = q.lte('reporte_tipo', 5).eq('reporte_confirmado', 0)
      if (filtro === 'informes') {
        q = q.eq('reporte_tipo', session.role === 'psicologia' ? RAC_TIPOS.avisoPsicologia : RAC_TIPOS.informeAcademico)
      }
    }
    if (session.role === 'maestro') {
      const { asignaciones } = await listarAsignaciones(session)
      const ids = asignaciones.map((a) => a.materia_id)
      if (!ids.length) return []
      q = q.in('materia_id', ids)
    }
    const { data, error } = await q.order('reporte_registro', { ascending: false }).limit(400)
    if (error) throw new Error(error.message)
    return hidratar((data ?? []) as Record<string, unknown>[])
  }

  async function inboxCitas(session: RacSesionNivel) {
    const ciclo = await cicloRac()
    let q = db()
      .from('reporte_cita')
      .select('*')
      .eq('cita_ciclo_escolar', ciclo)
      .gt('cita_status', 0)
    if (session.role === 'maestro') {
      const { asignaciones } = await listarAsignaciones(session)
      const ids = asignaciones.map((a) => a.materia_id)
      if (ids.length) q = q.in('materia_id', ids)
    }
    const { data, error } = await q.order('cita_registro', { ascending: false }).limit(300)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    const ids = [...new Set(rows.map((r) => n(r.alumno_id)))]
    const { data: alumnos } = await db()
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel')
      .in('alumno_id', ids.length ? ids : [0])
    const aMap = new Map((alumnos ?? []).map((a) => [n(a.alumno_id), a]))
    return rows
      .map((c) => {
        const a = aMap.get(n(c.alumno_id))
        if (a && !esAlumnoDeNivel(n(a.alumno_nivel))) return null
        return {
          cita_id: n(c.cita_id),
          alumno_ref: a?.alumno_ref ?? null,
          nombre: a ? nombreAlumno(a as AlumnoRow) : '',
          grado: n(a?.alumno_grado),
          grupo: letraDesdeGrupoNum(n(a?.alumno_grupo)),
          tipo: n(c.cita_tipo),
          tipoEtiqueta: etiquetaTipoCitatorio(n(c.cita_tipo)),
          mensaje: String(c.cita_mensaje ?? ''),
          fecha: c.cita_fecha ? String(c.cita_fecha).replace('T', ' ').slice(0, 16) : '',
          enviada: n(c.cita_enviada) === 1,
          confirmada: n(c.cita_confirmada) === 1,
          status: n(c.cita_status),
          mdv: String(c.cita_mdv ?? ''),
        }
      })
      .filter(Boolean)
  }

  async function inboxSuspensiones() {
    const ciclo = await cicloRac()
    const { data, error } = await db()
      .from('reporte_suspension')
      .select('*')
      .eq('suspension_ciclo_escolar', ciclo)
      .order('suspension_id', { ascending: false })
      .limit(300)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    const alumnoIds = [...new Set(rows.map((r) => n(r.alumno_id)).filter(Boolean))]
    const reporteIds = [...new Set(rows.map((r) => n(r.reporte_id)).filter(Boolean))]
    const { data: alumnos } = await db()
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel')
      .in('alumno_id', alumnoIds.length ? alumnoIds : [0])
    const { data: reps } = await db()
      .from('reporte_escolar')
      .select('reporte_id, reporte_tipo')
      .in('reporte_id', reporteIds.length ? reporteIds : [0])
    const aMap = new Map((alumnos ?? []).map((a) => [n(a.alumno_id), a]))
    const rMap = new Map((reps ?? []).map((r) => [n(r.reporte_id), r]))
    return rows
      .map((s) => {
        const a = aMap.get(n(s.alumno_id))
        if (a && !esAlumnoDeNivel(n(a.alumno_nivel))) return null
        const r = rMap.get(n(s.reporte_id))
        return {
          suspension_id: n(s.suspension_id),
          alumno_ref: a?.alumno_ref ?? null,
          nombre: a ? nombreAlumno(a as AlumnoRow) : '',
          grado: n(a?.alumno_grado),
          grupo: letraDesdeGrupoNum(n(a?.alumno_grupo)),
          tipoEtiqueta: etiquetaTipoCitatorio(n(r?.reporte_tipo ?? 0)),
          fecha: s.suspension_fecha ? String(s.suspension_fecha).slice(0, 10) : '',
          enviada: n(s.suspension_enviada) === 1,
        }
      })
      .filter(Boolean)
  }

  async function accionReporte(
    id: number,
    accion: 'reenviar' | 'detener' | 'confirmar' | 'denegar' | 'validar'
  ) {
    const client = db()
    if (accion === 'reenviar') return enviarCorreoReporte(id)
    if (accion === 'confirmar') {
      const { error } = await client.from('reporte_escolar').update({ reporte_confirmado: 1 }).eq('reporte_id', id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }
    if (accion === 'denegar') {
      const { error } = await client.from('reporte_escolar').update({ reporte_status: 0 }).eq('reporte_id', id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }
    if (accion === 'detener') {
      const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_id', id).maybeSingle()
      if (!r) throw new Error('Reporte no encontrado')
      await client.from('reporte_escolar').update({ reporte_status: 3 }).eq('reporte_id', id)
      const { data: later } = await client
        .from('reporte_escolar')
        .select('reporte_id, reporte_no')
        .eq('alumno_id', r.alumno_id)
        .eq('reporte_tipo', r.reporte_tipo)
        .eq('reporte_ciclo', r.reporte_ciclo)
        .gt('reporte_no', r.reporte_no)
      for (const row of later ?? []) {
        await client.from('reporte_escolar').update({ reporte_no: n(row.reporte_no) - 1 }).eq('reporte_id', row.reporte_id)
      }
      return { ok: true }
    }
    const ciclo = await cicloRac()
    const { data: r } = await client.from('reporte_escolar').select('*').eq('reporte_id', id).maybeSingle()
    if (!r) throw new Error('Reporte no encontrado')
    const { data: prev } = await client
      .from('reporte_escolar')
      .select('reporte_no, reporte_ciclo')
      .eq('alumno_id', r.alumno_id)
      .eq('reporte_tipo', 2)
      .eq('reporte_status', 1)
      .eq('reporte_ciclo_escolar', ciclo)
    let reporteCiclo = 0
    let reporteNo = 0
    let pivot = 0
    if (prev?.length) {
      pivot = 1
      reporteCiclo = prev.reduce((acc, x) => Math.max(acc, n(x.reporte_ciclo)), 0)
      reporteNo = prev
        .filter((x) => n(x.reporte_ciclo) === reporteCiclo)
        .reduce((acc, x) => Math.max(acc, n(x.reporte_no)), 0)
    }
    if (reporteNo === 3) {
      await client
        .from('reporte_escolar')
        .update({ reporte_status: 1, reporte_no: 0, reporte_ciclo: reporteCiclo + 1 })
        .eq('reporte_id', id)
    } else {
      await client
        .from('reporte_escolar')
        .update({ reporte_status: 1, reporte_no: reporteNo + pivot, reporte_ciclo: reporteCiclo })
        .eq('reporte_id', id)
    }
    return enviarCorreoReporte(id)
  }

  async function accionCita(
    id: number,
    accion: 'reenviar' | 'confirmar' | 'detener' | 'validar',
    opts?: { fecha?: string; hora?: string; mensaje?: string }
  ) {
    const client = db()
    if (accion === 'reenviar') return enviarCorreoCita(id)
    if (accion === 'confirmar') {
      const { error } = await client.from('reporte_cita').update({ cita_confirmada: 1 }).eq('cita_id', id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }
    if (accion === 'detener') {
      const { error } = await client.from('reporte_cita').update({ cita_status: 0 }).eq('cita_id', id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }
    const update: Record<string, unknown> = { cita_status: 1 }
    if (opts?.fecha && opts?.hora) update.cita_fecha = `${opts.fecha}T${opts.hora}:00`
    if (opts?.mensaje !== undefined) update.cita_mensaje = opts.mensaje
    const { data: citaRow, error } = await client
      .from('reporte_cita')
      .update(update)
      .eq('cita_id', id)
      .select('cita_id, alumno_id, cita_tipo, cita_mensaje, cita_fecha, perfil_id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (citaRow && opts?.fecha && opts?.hora && n(citaRow.perfil_id) === 4) {
      await sincronizarCitaGoogleCalendar({
        citaId: id,
        alumnoId: n(citaRow.alumno_id),
        tipo: n(citaRow.cita_tipo),
        mensaje: String(opts.mensaje ?? citaRow.cita_mensaje ?? ''),
        fecha: opts.fecha,
        hora: opts.hora,
        actorRole: 'psicologia',
      })
    }
    return enviarCorreoCita(id)
  }

  async function aplicarSuspension(id: number, fecha: string) {
    const { error } = await db().from('reporte_suspension').update({ suspension_fecha: fecha }).eq('suspension_id', id)
    if (error) throw new Error(error.message)
    return enviarCorreoSuspension(id)
  }

  async function historialAlumno(query: string) {
    const ciclo = await cicloRac()
    const q = query.trim()
    if (q.length < 2) return { alumnos: [], reportes: [] }
    const safe = q.replace(/[%_,]/g, '')
    const { data: alumnos } = await db()
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel')
      .in('alumno_nivel', cfg.nivelesEscolares)
      .or(`alumno_ref.ilike.%${safe}%,alumno_app.ilike.%${safe}%,alumno_apm.ilike.%${safe}%,alumno_nombre.ilike.%${safe}%`)
      .limit(20)
    const ids = (alumnos ?? []).map((a) => n(a.alumno_id))
    if (!ids.length) return { alumnos: alumnos ?? [], reportes: [] }
    const { data: reps } = await db()
      .from('reporte_escolar')
      .select('*')
      .in('alumno_id', ids)
      .eq('reporte_ciclo_escolar', ciclo)
      .eq('reporte_status', 1)
      .order('reporte_registro', { ascending: false })
      .limit(200)
    return { alumnos: alumnos ?? [], reportes: await hidratar((reps ?? []) as Record<string, unknown>[]) }
  }

  /** Historial de un alumno (kardex): materia, motivo, observaciones, vuelta. */
  async function historialDetalleAlumno(alumnoId: number) {
    const ciclo = await cicloRac()
    const alumno = await cargarAlumno(alumnoId)
    const { data: reps, error } = await db()
      .from('reporte_escolar')
      .select('*')
      .eq('alumno_id', alumnoId)
      .eq('reporte_ciclo_escolar', ciclo)
      .eq('reporte_status', 1)
      .order('reporte_ciclo', { ascending: true })
      .order('reporte_registro', { ascending: false })
      .limit(300)
    if (error) throw new Error(error.message)
    return {
      alumno: {
        alumno_id: n(alumno.alumno_id),
        alumno_ref: alumno.alumno_ref,
        nombre: nombreAlumno(alumno),
        grado: n(alumno.alumno_grado),
        grupo: letraDesdeGrupoNum(n(alumno.alumno_grupo)),
      },
      reportes: await hidratar((reps ?? []) as Record<string, unknown>[]),
    }
  }

  async function filasPdfDesdeQuery(rows: Record<string, unknown>[]): Promise<FilaPdfReporte[]> {
    if (!rows.length) return []
    const byId = new Map(rows.map((r) => [n(r.reporte_id), r]))
    const hidratados = (await hidratar(rows)).filter(Boolean) as NonNullable<
      Awaited<ReturnType<typeof hidratar>>[number]
    >[]
    return hidratados.map((row) => {
      const raw = byId.get(row.reporte_id)
      return filaPdfDesdeReporte({
        reporte_id: row.reporte_id,
        nombre: row.nombre,
        materia: row.materia,
        departamento: PERFIL_ETIQUETA[n(raw?.perfil_id)] ?? '',
        tipo: row.tipo,
        no: row.no,
        motivo: row.motivo,
        fecha: row.fecha,
        enviado: row.enviado,
        confirmado: row.confirmado,
        vuelta: n(raw?.reporte_ciclo),
      })
    })
  }

  async function datosPdfPendientes() {
    const ciclo = await cicloRac()
    const client = db()
    const { data: reportes } = await client
      .from('reporte_escolar')
      .select('*')
      .eq('reporte_ciclo_escolar', ciclo)
      .eq('reporte_confirmado', 0)
      .eq('reporte_status', 1)
      .neq('reporte_tipo', RAC_TIPOS.informeAcademico)
      .lt('reporte_tipo', RAC_TIPOS.seguimiento)
      .order('reporte_registro', { ascending: true })
      .limit(400)
    const { data: informes } = await client
      .from('reporte_escolar')
      .select('*')
      .eq('reporte_ciclo_escolar', ciclo)
      .eq('reporte_confirmado', 0)
      .eq('reporte_status', 1)
      .eq('reporte_tipo', RAC_TIPOS.informeAcademico)
      .order('reporte_registro', { ascending: true })
      .limit(400)
    return {
      ciclo,
      reportes: await filasPdfDesdeQuery((reportes ?? []) as Record<string, unknown>[]),
      informes: await filasPdfDesdeQuery((informes ?? []) as Record<string, unknown>[]),
    }
  }

  async function datosPdfHistorial(alumnoId: number, reporteTipo: number, materiaId?: number) {
    const ciclo = await cicloRac()
    const alumno = await cargarAlumno(alumnoId)
    let q = db()
      .from('reporte_escolar')
      .select('*')
      .eq('alumno_id', alumnoId)
      .eq('reporte_tipo', reporteTipo)
      .eq('reporte_ciclo_escolar', ciclo)
      .eq('reporte_status', 1)
    if (reporteTipo === RAC_TIPOS.academico && materiaId) q = q.eq('materia_id', materiaId)
    const { data, error } = await q.order('reporte_ciclo').order('reporte_no')
    if (error) throw new Error(error.message)
    return {
      ciclo,
      alumnoNombre: nombreAlumno(alumno),
      filas: await filasPdfDesdeQuery((data ?? []) as Record<string, unknown>[]),
    }
  }

  return {
    cicloRac,
    listarAsignaciones,
    listarGrupoCaptura,
    capturarReporte,
    capturarInforme,
    capturarCita,
    inboxReportes,
    inboxCitas,
    inboxSuspensiones,
    accionReporte,
    accionCita,
    aplicarSuspension,
    historialAlumno,
    historialDetalleAlumno,
    datosPdfPendientes,
    datosPdfHistorial,
  }
}

export const racPrimariaService = createRacNivelService(RAC_PRIMARIA)
export const racMaternalKinderService = createRacNivelService(RAC_MATERNAL_KINDER)

export function getServiceForSlug(slug: string) {
  if (slug === 'primaria') return racPrimariaService
  if (slug === 'maternal-kinder') return racMaternalKinderService
  throw new RacNivelAuthError('Nivel no válido', 400)
}
