'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
  UserRoundSearch,
  X,
  XCircle,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import {
  CicloEscolarProvider,
  useCicloEscolar,
} from '@/contexts/CicloEscolarContext'
import AlumnoAutocomplete from '@/app/servicios/components/AlumnoAutocomplete'
import {
  grupoALetra,
  type AlumnoBusquedaResultado,
} from '@/lib/alumnoBusquedaServicios'
import type {
  RevisionGrupoResultado,
  NivelEntradaClave,
} from '@/lib/revisionPagadosGrupo'
import { GUIA_CODIGOS_GRUPO_ENTRADA } from '@/lib/revisionPagadosGrupo'
import type { RevisionInscripcionResultado } from '@/lib/revisionPagadosInscripcion'
import './revision-pagados.css'

const LOGO_EDUCATIVO = '/logos/logo-winston-educativo.png'
const LOGO_WINSTON = '/logos/logo-winston-w.png'

type ModoBusqueda = 'grupo' | 'individual'

function normalizarCodigoGrupo(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

export default function RevisionPagadosPage() {
  return (
    <CicloEscolarProvider>
      <RevisionPagadosView />
    </CicloEscolarProvider>
  )
}

function RevisionPagadosView() {
  const { cicloInscripcionSistema, etiquetaCicloInscripcionSistema } =
    useCicloEscolar()
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const resultadoRef = useRef<HTMLElement>(null)

  const [modo, setModo] = useState<ModoBusqueda>('grupo')
  const [guiaAbierta, setGuiaAbierta] = useState(false)
  const [nivelEntrada, setNivelEntrada] =
    useState<NivelEntradaClave>('maternal_kinder')
  const [dataGrupo, setDataGrupo] = useState<RevisionGrupoResultado | null>(null)
  const [alumno, setAlumno] = useState<AlumnoBusquedaResultado | null>(null)
  const [dataAlumno, setDataAlumno] =
    useState<RevisionInscripcionResultado | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hayResultado = Boolean(dataGrupo || dataAlumno)

  const scrollAlResultado = useCallback(() => {
    const el = resultadoRef.current
    if (!el) return
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }, [])

  useEffect(() => {
    if (!loading && (dataGrupo || dataAlumno || error)) scrollAlResultado()
  }, [loading, dataGrupo, dataAlumno, error, scrollAlResultado])

  useEffect(() => {
    if (loading) scrollAlResultado()
  }, [loading, scrollAlResultado])

  const buscarGrupo = useCallback(
    async (raw: string, nivel?: number | null) => {
      const grupo = normalizarCodigoGrupo(raw)
      if (!grupo) {
        setError('Escribe un grupo, por ejemplo K2A, 2A o 7B.')
        setDataGrupo(null)
        return
      }
      setLoading(true)
      setError(null)
      setDataGrupo(null)
      setDataAlumno(null)
      setAlumno(null)
      try {
        const res = await fetch('/api/revision-pagados/grupo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grupo, nivel: nivel ?? undefined }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'No se pudo consultar el grupo.')
        }
        setDataGrupo(json as RevisionGrupoResultado)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al consultar')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const buscarNivelEntrada = useCallback(async (nivel: NivelEntradaClave) => {
    setLoading(true)
    setError(null)
    setDataGrupo(null)
    setDataAlumno(null)
    setAlumno(null)
    try {
      const res = await fetch('/api/revision-pagados/pendientes-nivel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'No se pudo consultar el nivel.')
      }
      setDataGrupo(json as RevisionGrupoResultado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar')
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarAlumno = useCallback(async (a: AlumnoBusquedaResultado) => {
    setLoading(true)
    setError(null)
    setDataAlumno(null)
    setDataGrupo(null)
    try {
      const res = await fetch('/api/revision-pagados/inscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId: a.alumno_id }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'No se pudo consultar la inscripción.')
      }
      setDataAlumno(json as RevisionInscripcionResultado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar')
    } finally {
      setLoading(false)
    }
  }, [])

  const irAIndividual = useCallback(() => {
    setModo('individual')
    setDataGrupo(null)
    setDataAlumno(null)
    setAlumno(null)
    setError(null)
  }, [])

  const irAGrupo = useCallback(() => {
    setModo('grupo')
    setAlumno(null)
    setDataAlumno(null)
    setDataGrupo(null)
    setError(null)
  }, [])

  const revisarOtro = useCallback(() => {
    setDataGrupo(null)
    setDataAlumno(null)
    setAlumno(null)
    setError(null)

    // En modo "nivel" recargamos automáticamente el select para que el flujo siga
    // siendo de "pendientes" (rojos).
    if (modo === 'grupo') {
      void buscarNivelEntrada(nivelEntrada)
    }
  }, [modo, buscarNivelEntrada, nivelEntrada])

  useEffect(() => {
    if (modo !== 'grupo') return
    void buscarNivelEntrada(nivelEntrada)
  }, [modo, nivelEntrada, buscarNivelEntrada])

  const onSeleccionarAlumno = useCallback(
    (a: AlumnoBusquedaResultado | null) => {
      setAlumno(a)
      setError(null)
      setDataAlumno(null)
      if (a) void cargarAlumno(a)
    },
    [cargarAlumno]
  )

  const cicloEscolarLabel =
    etiquetaCicloInscripcionSistema ||
    (cicloInscripcionSistema != null
      ? `${cicloInscripcionSistema + 2003}-${cicloInscripcionSistema + 2004}`
      : null)
  const cicloHint = cicloEscolarLabel
    ? `Ciclo escolar ${cicloEscolarLabel}`
    : 'Ciclo vigente'

  return (
    <div
      className={`rev-pag-page${hayResultado ? ' rev-pag-page--con-resultado' : ''}`}
    >
      <div className="rev-pag-bg" aria-hidden>
        <span className="rev-pag-orb rev-pag-orb--a" />
        <span className="rev-pag-orb rev-pag-orb--b" />
      </div>

      <header className="rev-pag-top">
        <Link href="/dashboard" className="rev-pag-back">
          <ArrowLeft size={16} aria-hidden />
          Dashboard
        </Link>
        <div className="rev-pag-top-meta">
          <span className="rev-pag-pill">{cicloHint}</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="rev-pag-main">
        <section className="rev-pag-hero">
          <div className="rev-pag-hero-line">
            <div className="rev-pag-hero-copy">
              <p className="rev-pag-kicker">Entrada al colegio</p>
              <h1>Revisión Pagados / No Pagados</h1>
            </div>
            <div className="rev-pag-planteles-legend">
              <span className="rev-pag-plantel-tag rev-pag-plantel-tag--educativo">
                <Image
                  src={LOGO_EDUCATIVO}
                  alt=""
                  width={36}
                  height={28}
                  className="rev-pag-plantel-logo"
                />
                Educativo
              </span>
              <span className="rev-pag-plantel-tag rev-pag-plantel-tag--winston">
                <Image
                  src={LOGO_WINSTON}
                  alt=""
                  width={36}
                  height={28}
                  className="rev-pag-plantel-logo rev-pag-plantel-logo--winston"
                />
                Winston
              </span>
            </div>
          </div>
        </section>

        <section
          className="rev-pag-panel rev-pag-panel--buscar"
          ref={searchWrapRef}
        >
          <header className="rev-pag-panel-head rev-pag-panel-head--inline">
            <span className="rev-pag-panel-step">1</span>
            <h2 className="rev-pag-panel-title">
              {modo === 'grupo' ? 'Nivel' : 'Alumno'}
            </h2>
            <p className="rev-pag-panel-sub">
              {modo === 'grupo'
                ? 'Maternal/Kinder · Primaria · Secundaria'
                : 'Nombre o No. de control'}
            </p>
          </header>

          {modo === 'grupo' ? (
            <div className="rev-pag-grupo-form">
              <label
                className="rev-pag-grupo-label"
                htmlFor="rev-pag-nivel-select"
              >
                Seleccionar nivel
              </label>
              <div className="rev-pag-grupo-row">
                <div className="rev-pag-grupo-ac">
                  <select
                    id="rev-pag-nivel-select"
                    className="rev-pag-nivel-select"
                    value={nivelEntrada}
                    onChange={(e) =>
                      setNivelEntrada(e.target.value as NivelEntradaClave)
                    }
                    aria-label="Seleccionar nivel"
                  >
                    <option value="maternal_kinder">Maternal/Kinder</option>
                    <option value="primaria">Primaria</option>
                    <option value="secundaria">Secundaria</option>
                  </select>

                  <p className="rev-pag-grupo-hint">
                    Solo aparecen <strong>alumnos en rojo</strong> (inscripción
                    pendiente).
                  </p>
                </div>

                <div className="rev-pag-grupo-actions">
                  <button
                    type="button"
                    className="rev-pag-grupo-btn rev-pag-grupo-btn--individual"
                    onClick={irAIndividual}
                  >
                    <UserRoundSearch size={18} aria-hidden />
                    <span>Individual</span>
                  </button>
                  <button
                    type="button"
                    className="rev-pag-grupo-btn rev-pag-grupo-btn--guia"
                    onClick={() => setGuiaAbierta(true)}
                  >
                    <Layers3 size={18} aria-hidden />
                    <span>Ver Grado/Grupo</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rev-pag-individual-wrap">
              <div className="rev-pag-search-box">
                <AlumnoAutocomplete
                  key={alumno?.alumno_id ?? 'empty-ind'}
                  onSeleccionar={onSeleccionarAlumno}
                  alumnoSeleccionado={alumno}
                  autoFocus
                  etiqueta="Escribe nombre o No. de control"
                  apiBusqueda="/api/revision-pagados/buscar"
                />
              </div>
              <button
                type="button"
                className="rev-pag-grupo-btn rev-pag-grupo-btn--volver"
                onClick={irAGrupo}
              >
                <Search size={18} aria-hidden />
                Volver a grupo
              </button>
            </div>
          )}
        </section>

        <section
          ref={resultadoRef}
          className="rev-pag-panel rev-pag-panel--resultado"
          aria-live="polite"
        >
          <header className="rev-pag-panel-head rev-pag-panel-head--inline">
            <span className="rev-pag-panel-step">2</span>
            <h2 className="rev-pag-panel-title">Resultado</h2>
            <p className="rev-pag-panel-sub">Pendientes (inscripción no pagada)</p>
          </header>

          {loading ? (
            <div className="rev-pag-loading" role="status">
              <Loader2 className="rev-pag-spin" size={32} aria-hidden />
              {modo === 'grupo'
                ? 'Cargando pendientes…'
                : 'Consultando inscripción…'}
            </div>
          ) : null}

          {error ? (
            <div className="rev-pag-error" role="alert">
              {error}
            </div>
          ) : null}

          {!loading && !error && !dataGrupo && !dataAlumno ? (
            <div className="rev-pag-idle">
              {modo === 'grupo'
                ? 'Selecciona un nivel para ver pendientes.'
                : 'Busca un alumno por nombre o No. de control.'}
            </div>
          ) : null}

          {dataGrupo ? (
            <ResultadoGrupo data={dataGrupo} onOtro={revisarOtro} />
          ) : null}
          {dataAlumno ? (
            <ResultadoAlumno data={dataAlumno} onOtro={revisarOtro} />
          ) : null}
        </section>
      </main>

      {guiaAbierta ? (
        <GuiaCodigosModal
          onCerrar={() => setGuiaAbierta(false)}
          onElegir={(codigo) => {
            setGuiaAbierta(false)
            setModo('grupo')
            void buscarGrupo(codigo)
          }}
        />
      ) : null}
    </div>
  )
}

function GuiaCodigosModal({
  onCerrar,
  onElegir,
}: {
  onCerrar: () => void
  onElegir: (codigo: string) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCerrar])

  return (
    <div
      className="rev-pag-guia-backdrop"
      role="presentation"
      onClick={onCerrar}
    >
      <div
        className="rev-pag-guia-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rev-pag-guia-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rev-pag-guia-head">
          <div>
            <p className="rev-pag-guia-kicker">Orden de entrada</p>
            <h2 id="rev-pag-guia-title">Grado / Grupo</h2>
          </div>
          <button
            type="button"
            className="rev-pag-guia-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar guía"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <p className="rev-pag-guia-lead">
          Maternal A → 9° C. Toca un código para abrir ese salón.
        </p>
        <nav className="rev-pag-guia-nav" aria-label="Niveles">
          {GUIA_CODIGOS_GRUPO_ENTRADA.map((bloque) => (
            <button
              key={bloque.id}
              type="button"
              className={`rev-pag-guia-nav-chip rev-pag-guia-nav-chip--n${bloque.nivel_num}`}
              onClick={() => {
                document
                  .getElementById(`rev-pag-guia-${bloque.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {bloque.nivel}
            </button>
          ))}
        </nav>
        <div className="rev-pag-guia-body">
          {GUIA_CODIGOS_GRUPO_ENTRADA.map((bloque, i) => (
            <section
              key={bloque.id}
              id={`rev-pag-guia-${bloque.id}`}
              className={`rev-pag-guia-bloque rev-pag-guia-bloque--n${bloque.nivel_num}`}
            >
              <header className="rev-pag-guia-bloque-head">
                <div className="rev-pag-guia-bloque-title">
                  <span
                    className={`rev-pag-guia-bloque-index rev-pag-guia-bloque-index--n${bloque.nivel_num}`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div>
                    <strong>{bloque.nivel}</strong>
                    <span className="rev-pag-guia-bloque-plantel">
                      {bloque.plantel}
                    </span>
                  </div>
                </div>
                <span className="rev-pag-guia-bloque-count">
                  {bloque.ejemplos.length} códigos
                </span>
              </header>
              <p>{bloque.nota}</p>
              <div className="rev-pag-guia-chips">
                {bloque.ejemplos.map((codigo) => (
                  <button
                    key={codigo}
                    type="button"
                    className={`rev-pag-guia-chip rev-pag-guia-chip--n${bloque.nivel_num}`}
                    onClick={() => onElegir(codigo)}
                  >
                    {codigo}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function ResultadoGrupo({
  data,
  onOtro,
}: {
  data: RevisionGrupoResultado
  onOtro: () => void
}) {
  // Flujo nuevo: solo mostramos rojos (pendiente = no pagó inscripción).
  const alumnosPendientes = data.alumnos.filter((a) => !a.pagado)
  const pctPendientes =
    data.total > 0 ? Math.round((data.pendientes / data.total) * 100) : 0

  return (
    <div className="rev-pag-grupo-result">
      <div className="rev-pag-grupo-summary">
        <div className="rev-pag-grupo-summary-title">
          <span className="rev-pag-grupo-badge">{data.grupo_etiqueta}</span>
          <div>
            <strong>
              {data.pendientes} alumno{data.pendientes === 1 ? '' : 's'} pendiente
              {data.nivel_label ? ` · ${data.nivel_label}` : ''}
            </strong>
            <p>
              Ciclo escolar {data.ciclo_label} · {data.pagados} al corriente ·{' '}
              {data.pendientes} pendientes
            </p>
          </div>
        </div>
        <div className="rev-pag-grupo-counts" aria-hidden>
          <span className="rev-pag-grupo-count rev-pag-grupo-count--bad">
            {data.pendientes}
          </span>
        </div>
      </div>
      <div
        className="rev-pag-grupo-progress"
        role="img"
        aria-label={`${pctPendientes}% pendientes`}
      >
        <div
          className="rev-pag-grupo-progress-bar"
          style={{
            width: `${pctPendientes}%`,
            background: 'linear-gradient(90deg, #be123c, #e11d48)',
          }}
        />
        <span className="rev-pag-grupo-progress-label">
          {pctPendientes}% pendientes
        </span>
      </div>
      <div className="rev-pag-leyenda" aria-hidden>
        <span className="rev-pag-leyenda-item rev-pag-leyenda-item--bad">
          Pendiente
        </span>
      </div>

      {alumnosPendientes.length === 0 ? (
        <div className="rev-pag-idle">
          No hay alumnos pendientes en {data.grupo_etiqueta}
          {data.nivel_label ? ` (${data.nivel_label})` : ''} este ciclo.
        </div>
      ) : (
        <ul className="rev-pag-grupo-lista">
          {alumnosPendientes.map((a) => (
            <li
              key={a.alumno_id}
              className={`rev-pag-grupo-item ${a.pagado ? 'rev-pag-grupo-item--ok' : 'rev-pag-grupo-item--bad'}`}
            >
              <span className="rev-pag-grupo-item-icon" aria-hidden>
                {a.pagado ? (
                  <CheckCircle2 size={28} strokeWidth={1.75} />
                ) : (
                  <XCircle size={28} strokeWidth={1.75} />
                )}
              </span>
              <div className="rev-pag-grupo-item-copy">
                <strong>{a.nombre_completo}</strong>
                <p>
                  <span className="rev-pag-ref">{a.alumno_ref}</span>
                  <span>
                    {a.nivel_label} · {a.grado_label}
                    {a.grupo_letra ? ` ${a.grupo_letra}` : ''}
                  </span>
                  <span>{a.plantel_label}</span>
                </p>
                <span
                  className={`rev-pag-grupo-item-status ${a.pagado ? 'is-ok' : 'is-bad'}`}
                >
                  {a.pagado
                    ? a.completa_por === '13'
                      ? 'Inscripción completa · pago único'
                      : 'Inscripción completa · diferido 2'
                    : a.tiene_dif1
                      ? 'Incompleta · solo diferido 1'
                      : 'Inscripción incompleta'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rev-pag-actions">
        <button type="button" className="rev-pag-btn-otro" onClick={onOtro}>
          <RefreshCw size={18} aria-hidden />
          Revisar otro
        </button>
      </div>
    </div>
  )
}

function ResultadoAlumno({
  data,
  onOtro,
}: {
  data: RevisionInscripcionResultado
  onOtro: () => void
}) {
  const ok = data.pagado
  const grupo =
    data.alumno.grupo != null ? grupoALetra(data.alumno.grupo) : null

  return (
    <section
      className={`rev-pag-result ${ok ? 'rev-pag-result--ok' : 'rev-pag-result--bad'} rev-pag-result--${data.alumno.plantel}`}
      aria-live="polite"
    >
      <div
        className={`rev-pag-plantel-banner rev-pag-plantel-banner--${data.alumno.plantel}`}
      >
        <Image
          src={
            data.alumno.plantel === 'educativo' ? LOGO_EDUCATIVO : LOGO_WINSTON
          }
          alt=""
          width={56}
          height={42}
          className={`rev-pag-plantel-banner-logo${data.alumno.plantel === 'winston' ? ' rev-pag-plantel-banner-logo--winston' : ''}`}
        />
        <div className="rev-pag-plantel-banner-text">
          <span className="rev-pag-plantel-banner-kicker">Plantel</span>
          <strong className="rev-pag-plantel-banner-name">
            {data.alumno.plantel_label}
          </strong>
          <span className="rev-pag-plantel-banner-razon">
            {data.alumno.plantel_razon}
          </span>
        </div>
      </div>

      <div className="rev-pag-verdict">
        <div className="rev-pag-verdict-icon" aria-hidden>
          {ok ? (
            <CheckCircle2 size={56} strokeWidth={1.75} />
          ) : (
            <XCircle size={56} strokeWidth={1.75} />
          )}
        </div>
        <div className="rev-pag-verdict-copy">
          <p className="rev-pag-verdict-label">
            {ok ? 'Inscripción completa' : 'Inscripción incompleta'}
          </p>
          {ok && data.completa_por ? (
            <p className="rev-pag-completa-por">
              Completa por concepto <strong>{data.completa_por}</strong>
              {data.completa_por === '13'
                ? ' · Inscripción (pago único)'
                : ' · Diferido 2'}
            </p>
          ) : null}
          <h3 className="rev-pag-name">{data.alumno.nombre_completo}</h3>
          <p className="rev-pag-meta">
            <span className="rev-pag-ref">{data.alumno.alumno_ref}</span>
            <span>
              {data.alumno.nivel_label} · {data.alumno.grado_label}
              {grupo ? ` · ${grupo}` : ''}
            </span>
            <span>
              {data.alumno.es_reinscrito ? 'Reinscrito' : 'Nuevo ingreso'}
            </span>
          </p>
        </div>
      </div>

      <div className="rev-pag-chips">
        <span className={`rev-pag-chip ${ok ? 'rev-pag-chip--ok' : 'rev-pag-chip--bad'}`}>
          {ok ? '✓ Completa' : '✕ Incompleta'}
        </span>
        <span className="rev-pag-chip">{data.modalidad_label}</span>
        <span className="rev-pag-chip rev-pag-chip--muted">
          Ciclo escolar{' '}
          {data.ciclo_label?.replace(/^Ciclo\s+/i, '') || data.ciclo_inscripcion}
        </span>
      </div>

      <p className="rev-pag-resumen">{data.resumen}</p>

      <div className="rev-pag-actions">
        <button type="button" className="rev-pag-btn-otro" onClick={onOtro}>
          <RefreshCw size={18} aria-hidden />
          Revisar otro
        </button>
      </div>
    </section>
  )
}
