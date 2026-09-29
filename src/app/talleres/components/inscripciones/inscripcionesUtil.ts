import {
  DIAS_TALLER,
  estadoCupo,
  etiquetaDia,
  etiquetaGradoAlumno,
  gradoGlobal,
  gradosPermitidos,
  hora12,
  lugarDeHorario,
  minutosDeHora,
  nombreMaestroTaller,
  nombreTallerCompleto,
  rangosSeTraslapan,
  type AlumnoTaller,
  type Taller,
  type TallerAsignacion,
  type TallerHorario,
  type TallerInscripcion,
  type TallerMaestro,
} from '@/lib/talleres/talleresTypes'

const DIA_CORTO: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' }

function rango(ini: string, fin: string): string {
  const a = hora12(ini)
  const b = hora12(fin)
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`
}

/** «Lun, Mié · 3:00 – 4:00 PM · Vie · 4:30 – 6:00 PM» */
export function horarioCorto(horarios: TallerHorario[]): string {
  const grupos = new Map<string, number[]>()
  for (const h of [...horarios].sort((a, b) => a.dia - b.dia)) {
    const k = `${h.hora_inicio}|${h.hora_fin}`
    grupos.set(k, [...(grupos.get(k) ?? []), h.dia])
  }
  return [...grupos.entries()]
    .sort((a, b) => minutosDeHora(a[0].split('|')[0]) - minutosDeHora(b[0].split('|')[0]))
    .map(([k, dias]) => {
      const [ini, fin] = k.split('|')
      return `${dias.map((d) => DIA_CORTO[d] ?? etiquetaDia(d)).join(', ')} · ${rango(ini, fin)}`
    })
    .join('  ·  ')
}

export function nombreGrupo(a: TallerAsignacion, tallerPorId: Map<number, Taller>): string {
  const t = tallerPorId.get(a.taller_id)
  return t ? nombreTallerCompleto(t) : 'Taller'
}

/** Revisión previa en el navegador (el servidor vuelve a validar todo). */
export function evaluarAlumnoEnGrupo(opts: {
  alumno: Pick<AlumnoTaller, 'nombre' | 'nivel' | 'grado' | 'grupo'> & { asignaciones: number[] }
  grupo: TallerAsignacion
  asignaciones: TallerAsignacion[]
  tallerPorId: Map<number, Taller>
  ignorarAsignacionId?: number
}): { bloqueado?: string; avisos: string[] } {
  const { alumno, grupo, asignaciones, tallerPorId, ignorarAsignacionId } = opts
  if (alumno.asignaciones.includes(grupo.id)) return { bloqueado: 'Ya está inscrito en este grupo', avisos: [] }
  if (!grupo.niveles.includes(alumno.nivel)) return { bloqueado: 'Es de otro nivel', avisos: [] }
  const avisos: string[] = []
  for (const id of alumno.asignaciones) {
    if (id === ignorarAsignacionId) continue
    const otra = asignaciones.find((a) => a.id === id)
    if (!otra) continue
    const c = grupo.horarios.map((h) => otra.horarios.find((o) => rangosSeTraslapan(o, h))).find(Boolean)
    if (c) avisos.push(`Choca con ${nombreGrupo(otra, tallerPorId)} (${DIA_CORTO[c.dia]} ${hora12(c.hora_inicio)})`)
  }
  const t = tallerPorId.get(grupo.taller_id)
  const permitidos = gradosPermitidos(t?.grados ?? null)
  const g = gradoGlobal(alumno.nivel, alumno.grado)
  if (permitidos && g != null && !permitidos.has(g)) avisos.push(`Es de ${etiquetaGradoAlumno(alumno)}; el taller es para ${t?.grados}`)
  if (estadoCupo(grupo) === 'lleno') avisos.push('Cupo lleno')
  return { avisos }
}

function csvCelda(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function fechaCorta(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export { fechaCorta }

export function descargarCsv(opts: {
  grupo: TallerAsignacion
  taller: Taller | undefined
  maestro: TallerMaestro | undefined
  inscripciones: TallerInscripcion[]
}): void {
  const { grupo, taller, maestro, inscripciones } = opts
  const filas = [
    ['#', 'Alumno', 'No. control', 'Grado', 'Fecha de alta', 'Notas'],
    ...inscripciones
      .filter((i) => i.estado === 'inscrito')
      .map((i, k) => [
        String(k + 1),
        i.alumno.nombre,
        String(i.alumno.alumno_ref ?? ''),
        etiquetaGradoAlumno(i.alumno),
        fechaCorta(i.fecha_alta),
        i.notas ?? '',
      ]),
  ]
  const encabezado = [
    [taller ? nombreTallerCompleto(taller) : 'Taller'],
    [`Maestro: ${maestro ? nombreMaestroTaller(maestro) : ''}`],
    [`Horario: ${horarioCorto(grupo.horarios)}`],
    [],
  ]
  const csv = [...encabezado, ...filas].map((f) => f.map(csvCelda).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(taller ? nombreTallerCompleto(taller) : 'taller').replace(/[^\w\-° ]+/g, '').trim()} - lista.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

export function imprimirLista(opts: {
  grupo: TallerAsignacion
  taller: Taller | undefined
  maestro: TallerMaestro | undefined
  inscripciones: TallerInscripcion[]
  ciclo: string
}): void {
  const { grupo, taller, maestro, inscripciones, ciclo } = opts
  const activos = inscripciones.filter((i) => i.estado === 'inscrito')
  const lugares = [...new Set(grupo.horarios.map((h) => lugarDeHorario(grupo, h)).filter(Boolean))].join(' / ')
  const dias = DIAS_TALLER.filter((d) => grupo.horarios.some((h) => h.dia === d.valor))
  const filas = activos
    .map(
      (i, k) =>
        `<tr><td>${k + 1}</td><td>${esc(i.alumno.nombre)}</td><td>${i.alumno.alumno_ref ?? ''}</td><td>${esc(etiquetaGradoAlumno(i.alumno))}</td>${dias.map(() => '<td></td>').join('')}</tr>`
    )
    .join('')
  const titulo = taller ? nombreTallerCompleto(taller) : 'Taller'
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
body{font-family:Inter,Arial,sans-serif;color:#13233a;margin:24px}
h1{font-size:20px;margin:0 0 4px}p{margin:2px 0;font-size:13px;color:#475569}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f4f9}
td:first-child{width:28px;text-align:center}.dia{width:56px;text-align:center}
</style></head><body>
<h1>${esc(titulo)}</h1>
<p><strong>Maestro:</strong> ${esc(maestro ? nombreMaestroTaller(maestro) : '')}</p>
<p><strong>Horario:</strong> ${esc(horarioCorto(grupo.horarios))}${lugares ? ` · <strong>Lugar:</strong> ${esc(lugares)}` : ''}</p>
<p><strong>Ciclo:</strong> ${esc(ciclo)} · <strong>Inscritos:</strong> ${activos.length}${grupo.cupo ? ` de ${grupo.cupo}` : ''}</p>
<table><thead><tr><th>#</th><th>Alumno</th><th>No. control</th><th>Grado</th>${dias.map((d) => `<th class="dia">${DIA_CORTO[d.valor]}</th>`).join('')}</tr></thead>
<tbody>${filas || `<tr><td colspan="${4 + dias.length}">Sin alumnos inscritos</td></tr>`}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}
