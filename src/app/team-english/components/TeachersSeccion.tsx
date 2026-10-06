'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, Plus, Search, Trash2, Upload } from 'lucide-react'
import {
  ESTADOS_PLANEACION,
  RUBROS,
  TE_EMOJIS,
  TIPOS_ANTECEDENTE,
  TIPOS_INCIDENCIA,
  calcularDesempeno,
  etiquetaGrado,
  etiquetaNivelTe,
  fechaLarga,
  nivelDesempeno,
  textoSemana,
  type TeAntecedente,
  type TeTeacher,
  type TipoAntecedente,
} from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { teAbrirArchivo, teAccion, teSubir } from '../teApi'
import { ACEPTAR_DOCS, Avatar, Campo, Hoja, SelectorArchivo, Vacio } from './ui'

type Pestana = 'expediente' | 'perfil' | 'antecedentes'

export default function TeachersSeccion({ snap, recargar, avisar }: SeccionProps) {
  const [busqueda, setBusqueda] = useState('')
  const [verInactivas, setVerInactivas] = useState(false)
  const [abiertaId, setAbiertaId] = useState<number | null>(null)
  const [agregando, setAgregando] = useState(false)

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return snap.teachers.filter((t) => {
      if (!verInactivas && !t.activo) return false
      if (!q) return true
      const h = `${t.nombre} ${t.grupos.join(' ')} ${t.email ?? ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return h.includes(q)
    })
  }, [snap.teachers, busqueda, verInactivas])

  const abierta = snap.teachers.find((t) => t.maestro_id === abiertaId) ?? null
  const inactivas = snap.teachers.filter((t) => !t.activo).length

  return (
    <>
      <div className="te-toolbar">
        <label className="te-buscar">
          <Search size={16} aria-hidden />
          <input className="te-input" type="search" placeholder="Buscar teacher o grupo…" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar teacher" />
        </label>
        {inactivas ? (
          <label className="te-check">
            <input type="checkbox" checked={verInactivas} onChange={(e) => setVerInactivas(e.target.checked)} />
            Ver inactivas ({inactivas})
          </label>
        ) : null}
        <button type="button" className="te-btn te-btn-primary" onClick={() => setAgregando(true)}>
          <Plus size={16} aria-hidden /> Agregar teacher
        </button>
      </div>

      {!lista.length ? (
        <Vacio emoji="🔍" titulo="No encontré teachers">
          Prueba con otro nombre o grupo. Las teachers con asignación «Teacher» en el catálogo de maestros aparecen solas.
        </Vacio>
      ) : (
        <ul className="te-teachers">
          {lista.map((t, i) => (
            <li key={t.maestro_id} style={{ ['--i' as string]: i }}>
              <button type="button" className="te-teacher" data-inactiva={!t.activo || undefined} onClick={() => setAbiertaId(t.maestro_id)}>
                <Avatar emoji={t.emoji} fotoKey={t.foto_key} nombre={t.nombre} tam="lg" />
                <span className="te-teacher-nombre">{t.nombre}</span>
                <span className="te-teacher-grupos">
                  {t.grupos.length
                    ? t.grupos.map((g) => <span key={g} className="te-chip">{etiquetaGrado(snap.nivel, Number(g[0]))}{g.slice(1)}</span>)
                    : <span className="te-chip te-chip-suave">Sin grupo asignado</span>}
                </span>
                <span className="te-teacher-badges">
                  <span data-ok={!!t.cv_key || undefined}>{t.cv_key ? '📄 C.V.' : '📄 Sin C.V.'}</span>
                  <span>🗂️ {t.antecedentes}</span>
                  {!t.activo ? <span>💤 Inactiva</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PerfilTeacher teacher={abierta} snap={snap} onCerrar={() => setAbiertaId(null)} recargar={recargar} avisar={avisar} />
      <AgregarTeacher abierta={agregando} snap={snap} onCerrar={() => setAgregando(false)} recargar={recargar} avisar={avisar} />
    </>
  )
}

function AgregarTeacher({ abierta, snap, onCerrar, recargar, avisar }: SeccionProps & { abierta: boolean; onCerrar: () => void }) {
  const [candidatos, setCandidatos] = useState<{ maestro_id: number; nombre: string }[] | null>(null)
  const [sel, setSel] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierta) return
    setCandidatos(null)
    setSel('')
    teAccion<{ candidatos: { maestro_id: number; nombre: string }[] }>(snap.nivel, 'candidatos')
      .then((r) => setCandidatos(r.candidatos))
      .catch((e) => avisar(e instanceof Error ? e.message : 'Error', 'error'))
  }, [abierta, snap.nivel, avisar])

  const guardar = async () => {
    if (!sel) return
    setGuardando(true)
    try {
      await teAccion(snap.nivel, 'agregar_teacher', { maestro_id: Number(sel) })
      await recargar()
      avisar('Teacher agregada al equipo.')
      onCerrar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja abierta={abierta} titulo="Agregar teacher" emoji="🌱" onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="te-btn te-btn-ghost" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="te-btn te-btn-primary" disabled={!sel || guardando} onClick={() => void guardar()}>
            {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : <Plus size={16} aria-hidden />} Agregar
          </button>
        </>
      }>
      <p className="te-nota">
        Las teachers con asignación «Teacher» ya aparecen solas. Aquí puedes sumar a otra maestra del catálogo (por ejemplo,
        una teacher de apoyo o de nuevo ingreso).
      </p>
      {candidatos == null ? (
        <p className="te-cargando"><Loader2 size={18} className="te-spin" aria-hidden /> Buscando maestras…</p>
      ) : candidatos.length ? (
        <Campo etiqueta="Maestra del catálogo">
          <select className="te-input" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Selecciona…</option>
            {candidatos.map((c) => <option key={c.maestro_id} value={c.maestro_id}>{c.nombre}</option>)}
          </select>
        </Campo>
      ) : (
        <Vacio emoji="🙌" titulo="Todas las maestras del nivel ya están en el equipo" />
      )}
    </Hoja>
  )
}

function PerfilTeacher({ teacher, snap, onCerrar, recargar, avisar }: SeccionProps & { teacher: TeTeacher | null; onCerrar: () => void }) {
  const [pestana, setPestana] = useState<Pestana>('expediente')
  useEffect(() => {
    if (teacher) setPestana('expediente')
  }, [teacher?.maestro_id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!teacher) return null
  return (
    <Hoja abierta ancho titulo={`Expediente · ${teacher.nombre}`} emoji="🗂️" onCerrar={onCerrar}>
      <CabezaExpediente teacher={teacher} snap={snap} recargar={recargar} avisar={avisar} />
      <div className="te-pestanas" role="tablist">
        {([
          ['expediente', '📋 Expediente'],
          ['perfil', '✏️ Editar datos'],
          ['antecedentes', `🗂️ Historial (${teacher.antecedentes})`],
        ] as [Pestana, string][]).map(([id, txt]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} data-activo={pestana === id || undefined} onClick={() => setPestana(id)}>
            {txt}
          </button>
        ))}
      </div>
      {pestana === 'expediente' ? <Expediente teacher={teacher} snap={snap} avisar={avisar} onEditar={() => setPestana('perfil')} /> : null}
      {pestana === 'perfil' ? <FormPerfil teacher={teacher} snap={snap} recargar={recargar} avisar={avisar} /> : null}
      {pestana === 'antecedentes' ? <Antecedentes teacher={teacher} snap={snap} recargar={recargar} avisar={avisar} /> : null}
    </Hoja>
  )
}

function antiguedad(desde: string | null, hoy: string): string | null {
  if (!desde) return null
  const [a1, m1] = desde.split('-').map(Number)
  const [a2, m2] = hoy.split('-').map(Number)
  const meses = (a2 - a1) * 12 + (m2 - m1)
  if (meses < 1) return 'menos de un mes'
  const a = Math.floor(meses / 12)
  const m = meses % 12
  return [a ? `${a} año${a === 1 ? '' : 's'}` : '', m ? `${m} mes${m === 1 ? '' : 'es'}` : ''].filter(Boolean).join(' y ')
}

function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 100)}%` : '—'
}

function CabezaExpediente({ teacher, snap, recargar, avisar }: SeccionProps & { teacher: TeTeacher }) {
  const reloj = snap.reloj.vinculos.find((v) => v.maestro_id === teacher.maestro_id)
  const ficha = reloj?.ficha
  const d = calcularDesempeno(teacher.maestro_id, snap.incidencias, snap.inicio_ciclo, snap.hoy, snap.ponderadores)
  const nd = nivelDesempeno(d.total)
  const planes = snap.planeaciones.filter((p) => p.maestro_id === teacher.maestro_id)
  const caps = snap.capacitaciones.filter((c) => c.estado === 'realizada' && c.participantes.some((p) => p.maestro_id === teacher.maestro_id && p.asistio !== false))
  const horas = caps.reduce((s, c) => s + (c.horas ?? 0), 0)
  const ingreso = teacher.fecha_ingreso ?? null
  const ant = antiguedad(ingreso, snap.hoy)
  const llega = ficha?.minutos_vs_entrada

  const kpis: { e: string; k: string; v: string; s?: string; tono?: string }[] = [
    { e: nd.emoji, k: 'Desempeño del ciclo', v: `${d.total.toFixed(1)}%`, s: nd.etiqueta, tono: nd.tono },
    {
      e: '🕐',
      k: 'Asistencia (Reloj)',
      v: ficha ? pct(ficha.dias_asistidos, ficha.dias_laborables) : '—',
      s: ficha ? `${ficha.dias_asistidos} de ${ficha.dias_laborables} días` : 'Sin vincular',
    },
    {
      e: '⏱️',
      k: 'Puntualidad',
      v: ficha ? pct(ficha.puntuales, ficha.dias_asistidos) : '—',
      s: llega == null ? undefined : llega <= 0 ? `Llega ${Math.abs(llega)} min antes, en promedio` : `Llega ${llega} min tarde, en promedio`,
    },
    { e: '⏰', k: 'Retardos / faltas', v: `${d.conteos.retardo} / ${d.conteos.falta}`, s: `🚪 ${d.conteos.permiso_llegada + d.conteos.permiso_salida} permisos · 🤒 ${d.conteos.enfermedad}` },
    { e: '📚', k: 'Planeaciones aprobadas', v: `${planes.filter((p) => p.estado === 'aprobada').length}/${planes.length}`, s: `⏳ ${planes.filter((p) => p.estado === 'pendiente').length} por revisar` },
    { e: '🎓', k: 'Capacitación', v: `${horas} h`, s: `${caps.length} curso${caps.length === 1 ? '' : 's'} realizados` },
  ]

  return (
    <section className="te-exp-hero" data-inactiva={!teacher.activo || undefined}>
      <div className="te-exp-id">
        <div className="te-exp-foto"><Avatar emoji={teacher.emoji} fotoKey={teacher.foto_key} nombre={teacher.nombre} tam="lg" /></div>
        <div className="te-min0">
          <h3>{teacher.nombre}</h3>
          <p className="te-exp-puesto">
            {teacher.puesto || 'Teacher'} · {etiquetaNivelTe(snap.nivel)}
            {!teacher.activo ? ' · 💤 Inactiva' : ''}
          </p>
          <div className="te-teacher-grupos te-exp-grupos">
            {teacher.grupos.length
              ? teacher.grupos.map((g) => <span key={g} className="te-chip">{etiquetaGrado(snap.nivel, Number(g[0]))}{g.slice(1)}</span>)
              : <span className="te-chip te-chip-suave">Sin grupo asignado</span>}
          </div>
          <p className="te-perfil-contacto">
            {teacher.email ? <a href={`mailto:${teacher.email}`}>✉️ {teacher.email}</a> : null}
            {teacher.celular ? <a href={`tel:${teacher.celular}`}>📱 {teacher.celular}</a> : null}
            {teacher.telefono && teacher.telefono !== teacher.celular ? <a href={`tel:${teacher.telefono}`}>☎️ {teacher.telefono}</a> : null}
          </p>
          <p className="te-exp-meta">
            {reloj?.empleado ? <span>🪪 Empleada #{reloj.empleado}</span> : <span>🪪 Sin vincular al Reloj</span>}
            {ficha?.horario ? <span>🕐 {ficha.horario}</span> : null}
            {ingreso ? <span>📅 Ingresó {fechaLarga(ingreso)}{ant ? ` (${ant})` : ''}</span> : null}
          </p>
        </div>
      </div>
      <BloqueCV teacher={teacher} snap={snap} recargar={recargar} avisar={avisar} />
      <ul className="te-exp-kpis">
        {kpis.map((x) => (
          <li key={x.k} data-tono={x.tono}>
            <span aria-hidden>{x.e}</span>
            <small>{x.k}</small>
            <b>{x.v}</b>
            {x.s ? <em>{x.s}</em> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function BloqueCV({ teacher, snap, recargar, avisar }: SeccionProps & { teacher: TeTeacher }) {
  const [subiendo, setSubiendo] = useState(false)
  const subir = async (file: File | null) => {
    if (!file) return
    setSubiendo(true)
    try {
      await teSubir(snap.nivel, { tipo: 'cv', maestro_id: teacher.maestro_id, archivo: file })
      await recargar()
      avisar('C.V. subido.')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setSubiendo(false)
    }
  }
  const quitar = async () => {
    if (!window.confirm('¿Quitar el C.V.?')) return
    try {
      await teAccion(snap.nivel, 'quitar_archivo_perfil', { maestro_id: teacher.maestro_id, campo: 'cv' })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }
  return (
    <div className="te-cv" data-ok={!!teacher.cv_key || undefined}>
      <FileText size={22} aria-hidden />
      <div className="te-min0">
        <strong>Currículum (C.V.)</strong>
        <span>{teacher.cv_nombre ?? 'Aún no se ha subido'}</span>
      </div>
      <div className="te-fila-botones">
        {teacher.cv_key ? (
          <button type="button" className="te-btn te-btn-sm" onClick={() => teAbrirArchivo(teacher.cv_key!).catch((e) => avisar(e.message, 'error'))}>
            Ver
          </button>
        ) : null}
        <label className="te-btn te-btn-primary te-btn-sm">
          <input type="file" accept={ACEPTAR_DOCS} hidden onChange={(e) => void subir(e.target.files?.[0] ?? null)} />
          {subiendo ? <Loader2 size={14} className="te-spin" aria-hidden /> : <Upload size={14} aria-hidden />} {teacher.cv_key ? 'Reemplazar' : 'Subir'}
        </label>
        {teacher.cv_key ? (
          <button type="button" className="te-icon-btn" aria-label="Quitar C.V." onClick={() => void quitar()}>
            <Trash2 size={16} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Dato({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd data-vacio={!v || undefined}>{v || 'Sin capturar'}</dd>
    </div>
  )
}

function Expediente({ teacher, snap, avisar, onEditar }: { teacher: TeTeacher; snap: SeccionProps['snap']; avisar: SeccionProps['avisar']; onEditar: () => void }) {
  const reloj = snap.reloj.vinculos.find((v) => v.maestro_id === teacher.maestro_id)
  const ficha = reloj?.ficha
  const d = calcularDesempeno(teacher.maestro_id, snap.incidencias, snap.inicio_ciclo, snap.hoy, snap.ponderadores)
  const incid = snap.incidencias.filter((i) => i.maestro_id === teacher.maestro_id && i.fecha >= snap.inicio_ciclo)
  const planes = snap.planeaciones.filter((p) => p.maestro_id === teacher.maestro_id).sort((a, b) => b.semana.localeCompare(a.semana))
  const caps = snap.capacitaciones
    .filter((c) => c.participantes.some((p) => p.maestro_id === teacher.maestro_id))
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
  const cls = snap.classroom.filter((c) => c.maestro_id === teacher.maestro_id).sort((a, b) => b.semana.localeCompare(a.semana))
  const [verInc, setVerInc] = useState(false)
  const incVisibles = verInc ? incid : incid.slice(0, 6)

  return (
    <div className="te-exp-grid">
      <section className="te-exp-card">
        <header><h4>🪪 Datos personales y laborales</h4><button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={onEditar}>✏️ Editar</button></header>
        <dl className="te-exp-datos">
          <Dato k="Nombre completo" v={teacher.nombre} />
          <Dato k="Correo institucional" v={teacher.email} />
          <Dato k="Celular" v={teacher.celular} />
          <Dato k="Teléfono" v={teacher.telefono} />
          <Dato k="Usuario del sistema" v={teacher.usuario} />
          <Dato k="Puesto" v={teacher.puesto} />
          <Dato k="Fecha de ingreso" v={teacher.fecha_ingreso ? `${fechaLarga(teacher.fecha_ingreso)} · ${antiguedad(teacher.fecha_ingreso, snap.hoy) ?? ''}` : null} />
          <Dato k="Grupos" v={teacher.grupos.map((g) => `${etiquetaGrado(snap.nivel, Number(g[0]))}${g.slice(1)}`).join(', ')} />
          <Dato k="No. de empleada (Reloj)" v={reloj?.empleado ? `#${reloj.empleado} · ${reloj.nombre}` : null} />
          <Dato k="Departamento" v={ficha?.departamento} />
          <Dato k="Institución" v={ficha?.institucion ? ficha.institucion[0].toUpperCase() + ficha.institucion.slice(1) : null} />
          <Dato k="Horario" v={ficha?.horario} />
          <Dato k="Primera checada registrada" v={ficha?.primera_checada ? fechaLarga(ficha.primera_checada) : null} />
        </dl>
      </section>

      <section className="te-exp-card">
        <header><h4>🎓 Formación y perfil profesional</h4></header>
        <dl className="te-exp-datos te-exp-datos-1">
          <Dato k="Nivel de inglés" v={teacher.nivel_ingles} />
          <Dato k="Formación académica" v={teacher.formacion} />
          <Dato k="Certificaciones" v={teacher.certificaciones} />
        </dl>
        <div className="te-exp-notas">
          <small>📝 Notas de la directora</small>
          <p>{teacher.notas || 'Sin notas todavía.'}</p>
        </div>
      </section>

      <section className="te-exp-card">
        <header><h4>📈 Desempeño del ciclo</h4><small>desde {fechaLarga(snap.inicio_ciclo)}</small></header>
        <ul className="te-exp-rubros">
          {RUBROS.map((r) => (
            <li key={r.clave}>
              <span>{r.emoji} {r.etiqueta}</span>
              <i style={{ ['--p' as string]: d.rubros[r.clave] / 100 }} aria-hidden />
              <b>{d.rubros[r.clave].toFixed(1)}%</b>
            </li>
          ))}
        </ul>
        {incid.length ? (
          <>
            <ul className="te-incidencias">
              {incVisibles.map((x) => {
                const tipo = TIPOS_INCIDENCIA.find((y) => y.valor === x.tipo)
                return (
                  <li key={x.id}>
                    <span aria-hidden>{tipo?.emoji}</span>
                    <span className="te-min0">
                      <b>{tipo?.etiqueta}</b> · {fechaLarga(x.fecha)}
                      {x.minutos ? ` · ${x.minutos} min` : ''}
                      {x.justificada ? ' · ✔️ Justificada' : ''}
                      {x.origen === 'reloj' ? <span className="te-reloj-badge">🕐 Reloj</span> : null}
                      {x.notas ? <small>{x.notas}</small> : null}
                    </span>
                  </li>
                )
              })}
            </ul>
            {incid.length > 6 ? (
              <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => setVerInc((v) => !v)}>
                {verInc ? 'Ver menos' : `Ver las ${incid.length} incidencias`}
              </button>
            ) : null}
          </>
        ) : (
          <p className="te-nota">🌟 Sin incidencias en el ciclo.</p>
        )}
      </section>

      <section className="te-exp-card">
        <header><h4>📚 Planeaciones</h4><small>{planes.length} en el ciclo</small></header>
        {planes.length ? (
          <ul className="te-exp-lista">
            {planes.slice(0, 8).map((p) => {
              const e = ESTADOS_PLANEACION[p.estado]
              return (
                <li key={p.id}>
                  <span className="te-min0">
                    <b>{textoSemana(p.semana)}</b> · Grado {etiquetaGrado(snap.nivel, p.grado)}
                    {p.titulo ? <small>{p.titulo}</small> : null}
                  </span>
                  <span className="te-sello">{e.emoji} {e.etiqueta}</span>
                  {p.archivo_key ? (
                    <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(p.archivo_key!).catch((er) => avisar(er.message, 'error'))}>📎</button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="te-nota">Aún no hay planeaciones registradas en el sistema.</p>
        )}
      </section>

      <section className="te-exp-card">
        <header><h4>🎓 Capacitaciones</h4><small>{caps.length}</small></header>
        {caps.length ? (
          <ul className="te-exp-lista">
            {caps.map((c) => {
              const yo = c.participantes.find((p) => p.maestro_id === teacher.maestro_id)
              return (
                <li key={c.id}>
                  <span className="te-min0">
                    <b>{c.titulo}</b>
                    <small>{fechaLarga(c.fecha_inicio)}{c.horas ? ` · ${c.horas} h` : ''}{c.proveedor ? ` · ${c.proveedor}` : ''}</small>
                  </span>
                  <span className="te-sello">
                    {c.estado === 'programada' ? '🗓️ Programada' : c.estado === 'cancelada' ? '🚫 Cancelada' : yo?.asistio === false ? '❌ No asistió' : '✅ Realizada'}
                  </span>
                  {yo?.constancia_key ? (
                    <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(yo.constancia_key!).catch((er) => avisar(er.message, 'error'))}>📜</button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="te-nota">Sin capacitaciones registradas.</p>
        )}
      </section>

      <section className="te-exp-card">
        <header><h4>💻 Revisiones de Classroom</h4><small>{cls.length}</small></header>
        {cls.length ? (
          <ul className="te-exp-lista">
            {cls.slice(0, 8).map((c) => {
              const ok = [c.actualizado, c.actividades_calificadas, c.trabajos_revisados].filter(Boolean).length
              return (
                <li key={c.id}>
                  <span className="te-min0">
                    <b>{textoSemana(c.semana)}</b> · {c.grupo}
                    {c.notas ? <small>{c.notas}</small> : null}
                  </span>
                  <span className="te-sello">{ok === 3 ? '✅ 100%' : `${ok}/3`}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="te-nota">Sin revisiones de Classroom registradas.</p>
        )}
      </section>
    </div>
  )
}

function FormPerfil({ teacher, snap, recargar, avisar }: SeccionProps & { teacher: TeTeacher }) {
  const [f, setF] = useState(() => ({
    emoji: teacher.emoji,
    puesto: teacher.puesto ?? '',
    fecha_ingreso: teacher.fecha_ingreso ?? '',
    telefono: teacher.telefono ?? '',
    nivel_ingles: teacher.nivel_ingles ?? '',
    formacion: teacher.formacion ?? '',
    certificaciones: teacher.certificaciones ?? '',
    notas: teacher.notas ?? '',
  }))
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState<'cv' | 'foto' | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const guardar = async () => {
    setGuardando(true)
    try {
      await teAccion(snap.nivel, 'perfil', { maestro_id: teacher.maestro_id, ...f })
      await recargar()
      avisar('Perfil guardado.')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const subir = async (tipo: 'cv' | 'foto', file: File | null) => {
    if (!file) return
    setSubiendo(tipo)
    try {
      await teSubir(snap.nivel, { tipo, maestro_id: teacher.maestro_id, archivo: file })
      await recargar()
      avisar(tipo === 'cv' ? 'C.V. subido.' : 'Foto actualizada.')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setSubiendo(null)
    }
  }

  const quitar = async (campo: 'cv' | 'foto') => {
    if (!window.confirm(campo === 'cv' ? '¿Quitar el C.V.?' : '¿Quitar la foto?')) return
    try {
      await teAccion(snap.nivel, 'quitar_archivo_perfil', { maestro_id: teacher.maestro_id, campo })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const cambiarActivo = async () => {
    const msg = teacher.activo ? '¿Marcar como inactiva? Ya no aparecerá en planeación, desempeño ni classrooms.' : '¿Reactivar a esta teacher?'
    if (!window.confirm(msg)) return
    try {
      await teAccion(snap.nivel, 'activo', { maestro_id: teacher.maestro_id, activo: !teacher.activo })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  return (
    <div className="te-perfil">
      <div className="te-perfil-cabeza">
        <Avatar emoji={f.emoji} fotoKey={teacher.foto_key} nombre={teacher.nombre} tam="lg" />
        <div className="te-min0">
          <p className="te-perfil-contacto">
            {teacher.email ? <a href={`mailto:${teacher.email}`}>✉️ {teacher.email}</a> : null}
            {teacher.celular ? <a href={`tel:${teacher.celular}`}>📱 {teacher.celular}</a> : null}
          </p>
          <div className="te-fila-botones">
            <label className="te-btn te-btn-ghost te-btn-sm">
              <input type="file" accept="image/*" hidden onChange={(e) => void subir('foto', e.target.files?.[0] ?? null)} />
              {subiendo === 'foto' ? <Loader2 size={14} className="te-spin" aria-hidden /> : '📷'} {teacher.foto_key ? 'Cambiar foto' : 'Subir foto'}
            </label>
            {teacher.foto_key ? <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => void quitar('foto')}>Quitar foto</button> : null}
          </div>
        </div>
      </div>

      <fieldset className="te-emojis">
        <legend>Su sticker</legend>
        {TE_EMOJIS.map((e) => (
          <button key={e} type="button" aria-pressed={f.emoji === e} data-activo={f.emoji === e || undefined} onClick={() => set('emoji', e)}>
            {e}
          </button>
        ))}
      </fieldset>

      <div className="te-form">
        <Campo etiqueta="Puesto"><input className="te-input" value={f.puesto} onChange={(e) => set('puesto', e.target.value)} placeholder="Homeroom teacher 3°" /></Campo>
        <Campo etiqueta="Fecha de ingreso"><input className="te-input" type="date" value={f.fecha_ingreso} onChange={(e) => set('fecha_ingreso', e.target.value)} /></Campo>
        <Campo etiqueta="Teléfono"><input className="te-input" value={f.telefono} onChange={(e) => set('telefono', e.target.value)} inputMode="tel" /></Campo>
        <Campo etiqueta="Nivel de inglés"><input className="te-input" value={f.nivel_ingles} onChange={(e) => set('nivel_ingles', e.target.value)} placeholder="C1 · TOEFL 600" /></Campo>
        <Campo etiqueta="Formación académica" completo><textarea className="te-input" rows={3} value={f.formacion} onChange={(e) => set('formacion', e.target.value)} /></Campo>
        <Campo etiqueta="Certificaciones" completo><textarea className="te-input" rows={2} value={f.certificaciones} onChange={(e) => set('certificaciones', e.target.value)} placeholder="TKT, CELTA, Cambridge…" /></Campo>
        <Campo etiqueta="Notas de la directora" completo><textarea className="te-input" rows={3} value={f.notas} onChange={(e) => set('notas', e.target.value)} /></Campo>
      </div>
      <div className="te-fila-botones te-fila-fin">
        <button type="button" className="te-btn te-btn-ghost" onClick={() => void cambiarActivo()}>
          {teacher.activo ? '💤 Marcar inactiva' : '🌱 Reactivar'}
        </button>
        <button type="button" className="te-btn te-btn-primary" disabled={guardando} onClick={() => void guardar()}>
          {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '💾'} Guardar perfil
        </button>
      </div>
    </div>
  )
}

function Antecedentes({ teacher, snap, recargar, avisar }: SeccionProps & { teacher: TeTeacher }) {
  const [lista, setLista] = useState<TeAntecedente[] | null>(null)
  const [nuevo, setNuevo] = useState({ fecha: snap.hoy, tipo: 'observacion' as TipoAntecedente, titulo: '', descripcion: '' })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [formAbierto, setFormAbierto] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await teAccion<{ antecedentes: TeAntecedente[] }>(snap.nivel, 'antecedentes', { maestro_id: teacher.maestro_id })
      setLista(r.antecedentes)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }, [snap.nivel, teacher.maestro_id, avisar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = async () => {
    setGuardando(true)
    try {
      const r = await teAccion<{ id: number }>(snap.nivel, 'antecedente', { maestro_id: teacher.maestro_id, ...nuevo })
      if (archivo) await teSubir(snap.nivel, { tipo: 'antecedente', maestro_id: teacher.maestro_id, antecedente_id: r.id, archivo })
      setNuevo({ fecha: snap.hoy, tipo: 'observacion', titulo: '', descripcion: '' })
      setArchivo(null)
      setFormAbierto(false)
      await Promise.all([cargar(), recargar()])
      avisar('Antecedente registrado.')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (a: TeAntecedente) => {
    if (!window.confirm(`¿Eliminar «${a.titulo}» del historial?`)) return
    try {
      await teAccion(snap.nivel, 'eliminar_antecedente', { id: a.id })
      await Promise.all([cargar(), recargar()])
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  return (
    <div className="te-antecedentes">
      {!formAbierto ? (
        <button type="button" className="te-btn te-btn-primary" onClick={() => setFormAbierto(true)}>
          <Plus size={16} aria-hidden /> Nuevo antecedente
        </button>
      ) : (
        <div className="te-form te-form-caja">
          <Campo etiqueta="Fecha"><input className="te-input" type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} /></Campo>
          <Campo etiqueta="Tipo">
            <select className="te-input" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as TipoAntecedente })}>
              {TIPOS_ANTECEDENTE.map((t) => <option key={t.valor} value={t.valor}>{t.emoji} {t.etiqueta}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Título" completo><input className="te-input" value={nuevo.titulo} maxLength={200} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} placeholder="Observación de clase 3°A" /></Campo>
          <Campo etiqueta="Descripción" completo><textarea className="te-input" rows={4} value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} /></Campo>
          <div data-completo className="te-campo">
            <SelectorArchivo etiqueta="Adjuntar evidencia (opcional)" archivo={archivo} onArchivo={setArchivo} aceptar={ACEPTAR_DOCS} />
          </div>
          <div className="te-fila-botones te-fila-fin" data-completo>
            <button type="button" className="te-btn te-btn-ghost" onClick={() => setFormAbierto(false)}>Cancelar</button>
            <button type="button" className="te-btn te-btn-primary" disabled={guardando || !nuevo.titulo.trim()} onClick={() => void guardar()}>
              {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '💾'} Guardar
            </button>
          </div>
        </div>
      )}

      {lista == null ? (
        <p className="te-cargando"><Loader2 size={18} className="te-spin" aria-hidden /> Cargando historial…</p>
      ) : !lista.length ? (
        <Vacio emoji="🗂️" titulo="Historial limpio">Registra observaciones de clase, reconocimientos, reuniones o actas para llevar su expediente.</Vacio>
      ) : (
        <ol className="te-timeline">
          {lista.map((a) => {
            const t = TIPOS_ANTECEDENTE.find((x) => x.valor === a.tipo)
            return (
              <li key={a.id} data-tipo={a.tipo}>
                <span className="te-timeline-emoji" aria-hidden>{t?.emoji}</span>
                <div className="te-min0">
                  <p className="te-timeline-meta">{fechaLarga(a.fecha)} · {t?.etiqueta}</p>
                  <p className="te-timeline-titulo">{a.titulo}</p>
                  {a.descripcion ? <p className="te-timeline-desc">{a.descripcion}</p> : null}
                  <div className="te-fila-botones">
                    {a.archivo_key ? (
                      <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(a.archivo_key!).catch((e) => avisar(e.message, 'error'))}>
                        📎 {a.archivo_nombre ?? 'Evidencia'}
                      </button>
                    ) : null}
                    {a.registrado_por ? <span className="te-quien">por {a.registrado_por}</span> : null}
                  </div>
                </div>
                <button type="button" className="te-icon-btn" aria-label="Eliminar antecedente" onClick={() => void eliminar(a)}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
