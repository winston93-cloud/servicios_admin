'use client'

import { Check, Printer, Save } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  KINDER_EN_DIAS_MAX,
  KINDER_EN_ESCALA_NOTA,
  type KinderEnIndicador,
} from '@/lib/boletasKinderEnCatalog'
import {
  KINDER_ES_ESCALA_HINT,
  KINDER_ES_NO_APLICA,
  normalizarCalificacionKinderEs,
} from '@/lib/boletasKinderEsCatalog'
import { normalizarCalificacionPrimaria, promedioPrimaria } from '@/lib/boletasPrimariaCatalog'

export type KiProgreso = { capturadas: number; total: number } | null

export type KiEscala = { letra: string; etiqueta: string; valor?: number }[]

/** Mínimo 5 = primaria (5 a 10); si no, 0 a 10 como Kinder Español. */
function normalizarDecimal(v: string, minimo: number, decimales = 1): string | null {
  return minimo > 0 ? normalizarCalificacionPrimaria(v, decimales) : normalizarCalificacionKinderEs(v)
}

export type KiAlumno = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  grupo_letra: string
  progreso?: KiProgreso
}

export type KiFila = Pick<KinderEnIndicador, 'id' | 'nombre'> & {
  /** decimal = Kinder Español (0 a 10 con un decimal o N/A). */
  formato: KinderEnIndicador['formato'] | 'decimal'
  enPromedio?: boolean
  /** Segundo nombre de la fila (p. ej. traducción al español en Primaria Inglés). */
  detalle?: string
  calificacion: string
}

export type KiSeccion = {
  id: string
  titulo: string
  filas: KiFila[]
  /** Filas con formato escala usan estas letras. */
  escala?: KiEscala
  promedio?: boolean
}

export type KiCapturaData = {
  alumno: KiAlumno
  /**
   * academico = Kinder Español (solo campos académicos con calificación numérica).
   * secciones = Primaria (materias por sección, decimales 5–10 y escalas).
   */
  modo: 'kinder' | 'maternal' | 'academico' | 'secciones'
  academicos?: KiFila[]
  secciones?: KiSeccion[]
  califMin?: number
  /** Decimales permitidos en calificaciones (Primaria Inglés: 2). */
  decimales?: number
  hint?: string
  /** En modo secciones: captura días de clase y faltas. */
  asistencia?: boolean
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
  academicos?: Record<number, string>
  /** Modo secciones: todas las materias por id. */
  valores?: Record<number, string>
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
  escala = KINDER_EN_ESCALA_NOTA,
}: {
  id: string
  valor: string
  disabled: boolean
  onChange: (v: string) => void
  escala?: KiEscala
}) {
  return (
    <div className="ki-chips" role="radiogroup" aria-labelledby={id}>
      {escala.map((e, idx) => {
        const activo = valor === e.letra
        return (
          <button
            key={e.letra}
            type="button"
            role="radio"
            aria-checked={activo}
            title={`${e.letra} · ${e.etiqueta}${e.valor != null ? ` (${e.valor})` : ''}`}
            className={`ki-chip${activo ? ' is-on' : ''}`}
            data-nivel={idx + 1}
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

function CampoDecimal({
  id,
  labelId,
  valor,
  disabled,
  onChange,
  minimo,
  decimales,
}: {
  id: string
  labelId: string
  valor: string
  disabled: boolean
  onChange: (v: string) => void
  minimo: number
  decimales: number
}) {
  const [foco, setFoco] = useState(false)
  const noAplica = valor === KINDER_ES_NO_APLICA
  const invalido = !foco && !noAplica && normalizarDecimal(valor, minimo, decimales) === null
  return (
    <div className="ki-decimal">
      <input
        id={id}
        className={`ki-dias ki-decimal-input${invalido ? ' is-invalid' : ''}`}
        type="text"
        inputMode="decimal"
        maxLength={4}
        aria-labelledby={labelId}
        aria-invalid={invalido || undefined}
        value={noAplica ? '' : valor}
        disabled={disabled || noAplica}
        placeholder={noAplica ? 'N/A' : `${minimo}–10`}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, '').slice(0, 4))}
        onFocus={() => setFoco(true)}
        onBlur={() => {
          setFoco(false)
          const n = normalizarDecimal(valor, minimo, decimales)
          if (n !== null && n !== valor) onChange(n)
        }}
        autoComplete="off"
      />
      <button
        type="button"
        className={`ki-chip ki-chip-na${noAplica ? ' is-on' : ''}`}
        aria-pressed={noAplica}
        title="No se evaluó este trimestre"
        disabled={disabled}
        onClick={() => onChange(noAplica ? '' : KINDER_ES_NO_APLICA)}
      >
        N/A
      </button>
    </div>
  )
}

function Bloque({
  titulo,
  prefijo,
  filas,
  disabled,
  onChange,
  pie,
  escala,
  minimo = 0,
  decimales = 1,
}: {
  titulo: string
  prefijo: string
  filas: KiFila[]
  disabled: boolean
  onChange: (id: number, v: string) => void
  pie?: ReactNode
  escala?: KiEscala
  minimo?: number
  decimales?: number
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
                  {f.detalle ? <small className="ki-field-detalle">{f.detalle}</small> : null}
                </span>
                {f.formato === 'decimal' ? (
                  <CampoDecimal
                    id={`${id}-input`}
                    labelId={id}
                    valor={f.calificacion}
                    disabled={disabled}
                    minimo={minimo}
                    decimales={decimales}
                    onChange={(v) => onChange(f.id, v)}
                  />
                ) : f.formato === 'numero' ? (
                  <CampoDias
                    id={`${id}-input`}
                    valor={f.calificacion}
                    disabled={disabled}
                    onChange={(v) => onChange(f.id, v)}
                  />
                ) : (
                  <EscalaChips
                    id={id}
                    valor={f.calificacion}
                    disabled={disabled}
                    escala={escala}
                    onChange={(v) => onChange(f.id, v)}
                  />
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
  claveRefresco,
}: {
  api: KiCapturaApi
  /** Cambia cuando cambian grado/grupo/trimestre para recargar. */
  claveRecarga: string
  /** Cambia cuando llegan datos nuevos de fuera: refresca lista y boleta abierta sin cerrarla ni pisar cambios sin guardar. */
  claveRefresco?: number
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

  const abiertoRef = useRef<{ id: number | null; sucio: boolean }>({ id: null, sucio: false })
  useEffect(() => {
    abiertoRef.current = { id: alumnoId, sucio }
  })

  useEffect(() => {
    if (!claveRefresco) return
    let vivo = true
    void recargarLista().catch(() => null)
    const { id, sucio: conCambios } = abiertoRef.current
    if (id != null && !conCambios) {
      apiRef.current
        .abrir(id)
        .then((d) => {
          if (vivo && abiertoRef.current.id === id && !abiertoRef.current.sucio) setData(d)
        })
        .catch(() => null)
    }
    return () => {
      vivo = false
    }
  }, [claveRefresco, recargarLista])

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

  function cambiar(campo: 'subjects' | 'behavioral' | 'maternal' | 'academicos', id: number, v: string) {
    setData((d) =>
      d ? { ...d, [campo]: (d[campo] ?? []).map((f) => (f.id === id ? { ...f, calificacion: v } : f)) } : d
    )
    setSucio(true)
    setMsg('')
  }

  function cambiarEnSeccion(seccionId: string, id: number, v: string) {
    setData((d) =>
      d
        ? {
            ...d,
            secciones: (d.secciones ?? []).map((s) =>
              s.id === seccionId
                ? { ...s, filas: s.filas.map((f) => (f.id === id ? { ...f, calificacion: v } : f)) }
                : s
            ),
          }
        : d
    )
    setSucio(true)
    setMsg('')
  }

  function cambiarAsistencia(campo: 'school_days' | 'days_absent', v: string) {
    setData((d) => (d ? { ...d, attendance: { ...d.attendance, [campo]: v } } : d))
    setSucio(true)
  }

  async function guardar(siguiente: boolean) {
    if (!data || alumnoId == null) return
    const minimo = data.califMin ?? 0
    const decimales = [
      ...(data.academicos ?? []),
      ...(data.secciones ?? []).flatMap((s) => s.filas.filter((f) => f.formato === 'decimal')),
    ]
    const dec = data.decimales ?? 1
    const malo = decimales.find((f) => normalizarDecimal(f.calificacion, minimo, dec) === null)
    if (malo) {
      const formato = dec === 2 ? 'hasta dos decimales, ej. 9.75' : 'un decimal, ej. 9.5'
      setErr(`«${malo.nombre}»: escribe una calificación de ${minimo} a 10 (${formato}) o marca N/A.`)
      setMsg('')
      return
    }
    const conAsistencia = data.modo === 'kinder' || Boolean(data.asistencia)
    const { school_days, days_absent } = data.attendance
    if (conAsistencia && school_days && days_absent && Number(days_absent) > Number(school_days)) {
      setErr('Las faltas (days absent) no pueden ser más que los días de clase (school days).')
      setMsg('')
      return
    }
    setGuardando(true)
    setErr('')
    setMsg('')
    const mapa = (filas: KiFila[]) => Object.fromEntries(filas.map((f) => [f.id, f.calificacion]))
    try {
      await apiRef.current.guardar(alumnoId, {
        subjects: mapa(data.subjects),
        behavioral: mapa(data.behavioral),
        maternal: mapa(data.maternal),
        academicos: data.academicos ? mapa(data.academicos) : undefined,
        valores: data.secciones ? mapa(data.secciones.flatMap((s) => s.filas)) : undefined,
        attendance: conAsistencia ? data.attendance : undefined,
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
  const escalaSecciones = data?.secciones?.find((s) => s.escala)?.escala

  const bloqueAsistencia = data ? (
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
            onChange={(v) => cambiarAsistencia('school_days', v)}
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
            onChange={(v) => cambiarAsistencia('days_absent', v)}
          />
        </div>
      </div>
    </section>
  ) : null

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

            {data.modo === 'secciones' ? (
              <>
                {data.hint ? <p className="ki-hint">{data.hint}</p> : null}
                {escalaSecciones ? (
                  <p className="ki-hint ki-escala">
                    {escalaSecciones.map((e) => (
                      <span key={e.letra}>
                        <strong>{e.letra}</strong> {e.etiqueta}
                      </span>
                    ))}
                  </p>
                ) : null}
              </>
            ) : data.modo === 'academico' ? (
              <p className="ki-hint ki-escala">{KINDER_ES_ESCALA_HINT}</p>
            ) : (
              <p className="ki-hint ki-escala">
                {KINDER_EN_ESCALA_NOTA.map((e) => (
                  <span key={e.letra}>
                    <strong>{e.letra}</strong> {e.etiqueta}
                  </span>
                ))}
              </p>
            )}

            {data.modo === 'secciones' ? (
              <>
                {(data.secciones ?? []).map((s) => {
                  const prom = s.promedio
                    ? promedioPrimaria(
                        s.filas.filter((f) => f.enPromedio).map((f) => f.calificacion),
                        data.decimales ?? 1
                      )
                    : ''
                  return (
                    <Bloque
                      key={s.id}
                      titulo={s.titulo}
                      prefijo={`sec-${s.id}`}
                      filas={s.filas}
                      escala={s.escala}
                      minimo={data.califMin ?? 0}
                      decimales={data.decimales ?? 1}
                      disabled={bloqueado}
                      onChange={(id, v) => cambiarEnSeccion(s.id, id, v)}
                      pie={
                        prom ? (
                          <p className="ki-promedio">
                            Promedio: <strong>{prom}</strong>
                          </p>
                        ) : null
                      }
                    />
                  )
                })}
                {data.asistencia ? bloqueAsistencia : null}
              </>
            ) : data.modo === 'academico' ? (
              <Bloque
                titulo="Campos académicos"
                prefijo="aca"
                filas={data.academicos ?? []}
                disabled={bloqueado}
                onChange={(id, v) => cambiar('academicos', id, v)}
              />
            ) : data.modo === 'maternal' ? (
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
                {bloqueAsistencia}
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
