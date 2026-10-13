'use client'

import { Check, Printer, Save } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  KINDER_EN_DIAS_MAX,
  KINDER_EN_ESCALA_NOTA,
  type KinderEnIndicador,
} from '@/lib/boletasKinderEnCatalog'

export type KiProgreso = { capturadas: number; total: number } | null

export type KiAlumno = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  grupo_letra: string
  progreso?: KiProgreso
}

export type KiFila = KinderEnIndicador & { calificacion: string }

export type KiCapturaData = {
  alumno: KiAlumno
  modo: 'kinder' | 'maternal'
  subjects: KiFila[]
  behavioral: KiFila[]
  maternal: KiFila[]
  attendance: { school_days: string; days_absent: string }
  promedioSugerido?: string
}

export type KiGuardarPayload = {
  subjects: Record<number, string>
  behavioral: Record<number, string>
  maternal: Record<number, string>
  attendance?: { school_days: string; days_absent: string }
}

export type KiCapturaApi = {
  listar: () => Promise<KiAlumno[]>
  abrir: (alumnoId: number) => Promise<KiCapturaData>
  guardar: (alumnoId: number, payload: KiGuardarPayload) => Promise<void>
  pdfUrl: (alumnoId: number) => string
}

function completo(p: KiProgreso | undefined): boolean {
  return Boolean(p && p.total > 0 && p.capturadas >= p.total)
}

function promedioLocal(subjects: KiFila[]): string {
  const valores = subjects
    .filter((s) => s.enPromedio && s.calificacion)
    .map((s) => KINDER_EN_ESCALA_NOTA.find((e) => e.letra === s.calificacion)?.valor ?? 0)
    .filter((n) => n > 0)
  if (!valores.length) return ''
  const n = Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)
  return KINDER_EN_ESCALA_NOTA.find((e) => e.valor === n)?.letra ?? ''
}

function EscalaChips({
  id,
  valor,
  disabled,
  onChange,
}: {
  id: string
  valor: string
  disabled: boolean
  onChange: (v: string) => void
}) {
  return (
    <div className="ki-chips" role="radiogroup" aria-labelledby={id}>
      {KINDER_EN_ESCALA_NOTA.map((e) => {
        const activo = valor === e.letra
        return (
          <button
            key={e.letra}
            type="button"
            role="radio"
            aria-checked={activo}
            title={`${e.letra} · ${e.etiqueta} (${e.valor})`}
            className={`ki-chip${activo ? ' is-on' : ''}`}
            data-letra={e.letra}
            disabled={disabled}
            onClick={() => onChange(activo ? '' : e.letra)}
          >
            {e.letra}
          </button>
        )
      })}
    </div>
  )
}

function CampoDias({
  id,
  valor,
  disabled,
  onChange,
}: {
  id: string
  valor: string
  disabled: boolean
  onChange: (v: string) => void
}) {
  return (
    <input
      id={id}
      className="ki-dias"
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={3}
      value={valor}
      disabled={disabled}
      placeholder={`0–${KINDER_EN_DIAS_MAX}`}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
      autoComplete="off"
    />
  )
}

function Bloque({
  titulo,
  prefijo,
  filas,
  disabled,
  onChange,
  pie,
}: {
  titulo: string
  prefijo: string
  filas: KiFila[]
  disabled: boolean
  onChange: (id: number, v: string) => void
  pie?: ReactNode
}) {
  const hechas = filas.filter((f) => f.calificacion).length
  return (
    <section className="ki-section">
      <h3>
        {titulo}
        <span className="ki-section-count">
          {hechas}/{filas.length}
        </span>
      </h3>
      {filas.length === 0 ? (
        <p className="ki-hint">No hay indicadores activos para este grado. Revisa el catálogo.</p>
      ) : (
        <div className="ki-fields">
          {filas.map((f) => {
            const id = `${prefijo}-${f.id}`
            return (
              <div key={id} className={`ki-field${f.calificacion ? ' is-filled' : ''}`}>
                <span className="ki-field-label" id={id}>
                  {f.nombre}
                </span>
                {f.formato === 'numero' ? (
                  <CampoDias
                    id={`${id}-input`}
                    valor={f.calificacion}
                    disabled={disabled}
                    onChange={(v) => onChange(f.id, v)}
                  />
                ) : (
                  <EscalaChips id={id} valor={f.calificacion} disabled={disabled} onChange={(v) => onChange(f.id, v)} />
                )}
              </div>
            )
          })}
        </div>
      )}
      {pie}
    </section>
  )
}

/** Lista de alumnos + boleta del alumno. La escala solo se elige con botones (no se puede escribir). */
export default function KiCaptura({
  api,
  claveRecarga,
  editable,
  avisoNoEditable,
  onCambio,
  alumnosVacio,
}: {
  api: KiCapturaApi
  /** Cambia cuando cambian grado/grupo/trimestre para recargar. */
  claveRecarga: string
  editable: boolean
  avisoNoEditable?: ReactNode
  /** Tras guardar (para refrescar avance en el padre). */
  onCambio?: (alumnos: KiAlumno[]) => void
  alumnosVacio?: ReactNode
}) {
  const [alumnos, setAlumnos] = useState<KiAlumno[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [data, setData] = useState<KiCapturaData | null>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [sucio, setSucio] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const apiRef = useRef(api)
  const onCambioRef = useRef(onCambio)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiRef.current = api
    onCambioRef.current = onCambio
  })

  const recargarLista = useCallback(async () => {
    const lista = await apiRef.current.listar()
    setAlumnos(lista)
    onCambioRef.current?.(lista)
    return lista
  }, [])

  useEffect(() => {
    let vivo = true
    setCargandoLista(true)
    setAlumnoId(null)
    setData(null)
    setSucio(false)
    setMsg('')
    setErr('')
    apiRef.current
      .listar()
      .then((lista) => {
        if (!vivo) return
        setAlumnos(lista)
        onCambioRef.current?.(lista)
      })
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'No se pudo cargar la lista.'))
      .finally(() => vivo && setCargandoLista(false))
    return () => {
      vivo = false
    }
  }, [claveRecarga])

  useEffect(() => {
    if (!sucio) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio])

  async function abrir(id: number) {
    if (sucio && !window.confirm('Tienes cambios sin guardar en esta boleta. ¿Salir sin guardar?')) return
    setAlumnoId(id)
    setCargando(true)
    setErr('')
    setMsg('')
    setSucio(false)
    try {
      setData(await apiRef.current.abrir(id))
      if (window.matchMedia('(max-width: 768px)').matches) {
        requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    } catch (e) {
      setData(null)
      setErr(e instanceof Error ? e.message : 'No se pudo abrir la boleta.')
    } finally {
      setCargando(false)
    }
  }

  function cambiar(campo: 'subjects' | 'behavioral' | 'maternal', id: number, v: string) {
    setData((d) => (d ? { ...d, [campo]: d[campo].map((f) => (f.id === id ? { ...f, calificacion: v } : f)) } : d))
    setSucio(true)
    setMsg('')
  }

  async function guardar(siguiente: boolean) {
    if (!data || alumnoId == null) return
    setGuardando(true)
    setErr('')
    setMsg('')
    const mapa = (filas: KiFila[]) => Object.fromEntries(filas.map((f) => [f.id, f.calificacion]))
    try {
      await apiRef.current.guardar(alumnoId, {
        subjects: mapa(data.subjects),
        behavioral: mapa(data.behavioral),
        maternal: mapa(data.maternal),
        attendance: data.modo === 'kinder' ? data.attendance : undefined,
      })
      setSucio(false)
      const lista = await recargarLista().catch(() => alumnos)
      if (siguiente) {
        const idx = lista.findIndex((a) => a.alumno_id === alumnoId)
        const prox = lista.slice(idx + 1).find((a) => !completo(a.progreso)) ?? lista[idx + 1]
        if (prox) {
          await abrir(prox.alumno_id)
          setMsg(`Guardado. Sigue: ${prox.nombre}`)
          return
        }
      }
      setMsg('Boleta guardada.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const bloqueado = !editable || guardando
  const listos = alumnos.filter((a) => completo(a.progreso)).length

  return (
    <div className="ki-layout bm-layout">
      <div className="ki-col-lista">
        {alumnos.length > 0 && (
          <p className="bm-count">
            {alumnos.length} alumno{alumnos.length === 1 ? '' : 's'} · {listos} completo{listos === 1 ? '' : 's'}
          </p>
        )}
        {cargandoLista ? (
          <p className="ki-empty bm-empty">Cargando alumnos…</p>
        ) : alumnos.length === 0 ? (
          <p className="ki-empty bm-empty">
            {alumnosVacio ?? (
              <>
                <strong>Sin alumnos</strong>
                No hay alumnos activos en este grupo.
              </>
            )}
          </p>
        ) : (
          <ul className="ki-list bm-list">
            {alumnos.map((a) => {
              const ok = completo(a.progreso)
              return (
                <li key={a.alumno_id}>
                  <button
                    type="button"
                    className={alumnoId === a.alumno_id ? 'is-active' : undefined}
                    onClick={() => void abrir(a.alumno_id)}
                  >
                    <span className="ki-list-nombre">{a.nombre}</span>
                    <span className="ki-list-meta bm-list-meta">
                      Ref {String(a.alumno_ref ?? '').padStart(5, '0')}
                      {a.progreso ? (
                        <span className={`ki-avance${ok ? ' is-ok' : a.progreso.capturadas ? ' is-medio' : ''}`}>
                          {ok ? (
                            <>
                              <Check size={12} aria-hidden /> Completa
                            </>
                          ) : (
                            `${a.progreso.capturadas}/${a.progreso.total}`
                          )}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div ref={formRef} className="ki-col-form">
        {(msg || err) && (
          <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'}>
            {err || msg}
          </p>
        )}
        {alumnoId == null ? (
          <p className="ki-empty bm-empty">
            <strong>Boleta</strong>
            Elige un alumno de la lista.
          </p>
        ) : cargando || !data ? (
          <p className="ki-empty bm-empty">{cargando ? 'Abriendo boleta…' : 'No se pudo abrir la boleta.'}</p>
        ) : (
          <div className="ki-form">
            <div className="ki-form-head bm-form-head">
              <h2>{data.alumno.nombre}</h2>
              <div className="ki-actions">
                {editable && (
                  <>
                    <button
                      type="button"
                      className="ki-btn primary"
                      onClick={() => void guardar(false)}
                      disabled={guardando}
                    >
                      <Save size={16} aria-hidden />
                      {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button type="button" className="ki-btn" onClick={() => void guardar(true)} disabled={guardando}>
                      Guardar y siguiente
                    </button>
                  </>
                )}
                <a className="ki-btn" href={api.pdfUrl(alumnoId)} target="_blank" rel="noopener noreferrer">
                  <Printer size={16} aria-hidden />
                  PDF
                </a>
              </div>
            </div>

            {!editable && avisoNoEditable ? <div className="ki-aviso">{avisoNoEditable}</div> : null}
            {sucio && <p className="ki-sucio">Cambios sin guardar</p>}

            <p className="ki-hint ki-escala">
              {KINDER_EN_ESCALA_NOTA.map((e) => (
                <span key={e.letra}>
                  <strong>{e.letra}</strong> {e.etiqueta}
                </span>
              ))}
            </p>

            {data.modo === 'maternal' ? (
              <Bloque
                titulo="Maternal"
                prefijo="mat"
                filas={data.maternal}
                disabled={bloqueado}
                onChange={(id, v) => cambiar('maternal', id, v)}
              />
            ) : (
              <>
                <Bloque
                  titulo="Subjects"
                  prefijo="sub"
                  filas={data.subjects}
                  disabled={bloqueado}
                  onChange={(id, v) => cambiar('subjects', id, v)}
                  pie={
                    promedioLocal(data.subjects) ? (
                      <p className="ki-promedio">
                        Average: <strong>{promedioLocal(data.subjects)}</strong>
                      </p>
                    ) : null
                  }
                />
                <Bloque
                  titulo="Behavioral skills"
                  prefijo="beh"
                  filas={data.behavioral}
                  disabled={bloqueado}
                  onChange={(id, v) => cambiar('behavioral', id, v)}
                />
                <section className="ki-section">
                  <h3>Attendance</h3>
                  <div className="ki-fields">
                    <div className={`ki-field${data.attendance.school_days ? ' is-filled' : ''}`}>
                      <label className="ki-field-label" htmlFor="att-school">
                        SCHOOL DAYS
                      </label>
                      <CampoDias
                        id="att-school"
                        valor={data.attendance.school_days}
                        disabled={bloqueado}
                        onChange={(v) => {
                          setData((d) => (d ? { ...d, attendance: { ...d.attendance, school_days: v } } : d))
                          setSucio(true)
                        }}
                      />
                    </div>
                    <div className={`ki-field${data.attendance.days_absent ? ' is-filled' : ''}`}>
                      <label className="ki-field-label" htmlFor="att-absent">
                        DAYS ABSENT
                      </label>
                      <CampoDias
                        id="att-absent"
                        valor={data.attendance.days_absent}
                        disabled={bloqueado}
                        onChange={(v) => {
                          setData((d) => (d ? { ...d, attendance: { ...d.attendance, days_absent: v } } : d))
                          setSucio(true)
                        }}
                      />
                    </div>
                  </div>
                </section>
              </>
            )}

            {editable && (
              <div className="ki-actions ki-actions-pie">
                <button type="button" className="ki-btn primary" onClick={() => void guardar(false)} disabled={guardando}>
                  <Save size={16} aria-hidden />
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" className="ki-btn" onClick={() => void guardar(true)} disabled={guardando}>
                  Guardar y siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
