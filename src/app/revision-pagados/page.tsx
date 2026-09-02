'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  UserRoundSearch,
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
  GrupoEntradaOpcion,
  RevisionGrupoResultado,
} from '@/lib/revisionPagadosGrupo'
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

function filtrarGrupos(
  grupos: GrupoEntradaOpcion[],
  consulta: string
): GrupoEntradaOpcion[] {
  const q = normalizarCodigoGrupo(consulta)
  if (!q) return grupos.slice(0, 14)
  return grupos
    .filter(
      (g) =>
        g.codigo.startsWith(q) ||
        g.etiqueta.toUpperCase().includes(q) ||
        g.nivel_label.toUpperCase().startsWith(q)
    )
    .slice(0, 14)
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
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = 'rev-pag-grupo-listbox'

  const [modo, setModo] = useState<ModoBusqueda>('grupo')
  const [consulta, setConsulta] = useState('')
  const [gruposCatalogo, setGruposCatalogo] = useState<GrupoEntradaOpcion[]>([])
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(0)
  const [dataGrupo, setDataGrupo] = useState<RevisionGrupoResultado | null>(null)
  const [alumno, setAlumno] = useState<AlumnoBusquedaResultado | null>(null)
  const [dataAlumno, setDataAlumno] =
    useState<RevisionInscripcionResultado | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sugerencias = filtrarGrupos(gruposCatalogo, consulta)
  const hayResultado = Boolean(dataGrupo || dataAlumno)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/revision-pagados/grupos')
        const json = await res.json()
        if (!res.ok || !json.ok || cancelled) return
        setGruposCatalogo((json.grupos ?? []) as GrupoEntradaOpcion[])
      } catch {
        /* catálogo opcional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
      setConsulta(grupo)
      setSugerenciasAbiertas(false)
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

  const elegirSugerencia = useCallback(
    (opcion: GrupoEntradaOpcion) => {
      void buscarGrupo(opcion.codigo, opcion.nivel)
    },
    [buscarGrupo]
  )

  const resolverEnter = useCallback(() => {
    const q = normalizarCodigoGrupo(consulta)
    if (!q) {
      setError('Escribe un grupo, por ejemplo K2A, 2A o 7B.')
      return
    }
    if (
      sugerenciasAbiertas &&
      sugerencias.length > 0 &&
      indiceActivo >= 0 &&
      indiceActivo < sugerencias.length
    ) {
      const pick = sugerencias[indiceActivo]
      void buscarGrupo(pick.codigo, pick.nivel)
      return
    }
    const exactas = gruposCatalogo.filter((g) => g.codigo === q)
    if (exactas.length === 1) {
      void buscarGrupo(exactas[0].codigo, exactas[0].nivel)
      return
    }
    if (sugerencias.length === 1) {
      void buscarGrupo(sugerencias[0].codigo, sugerencias[0].nivel)
      return
    }
    void buscarGrupo(q)
  }, [
    buscarGrupo,
    consulta,
    gruposCatalogo,
    indiceActivo,
    sugerencias,
    sugerenciasAbiertas,
  ])

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      resolverEnter()
    },
    [resolverEnter]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        if (!sugerencias.length) return
        e.preventDefault()
        setSugerenciasAbiertas(true)
        setIndiceActivo((i) => (i + 1) % sugerencias.length)
        return
      }
      if (e.key === 'ArrowUp') {
        if (!sugerencias.length) return
        e.preventDefault()
        setSugerenciasAbiertas(true)
        setIndiceActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length)
        return
      }
      if (e.key === 'Escape') {
        setSugerenciasAbiertas(false)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        resolverEnter()
      }
    },
    [resolverEnter, sugerencias]
  )

  const irAIndividual = useCallback(() => {
    setModo('individual')
    setDataGrupo(null)
    setError(null)
    setSugerenciasAbiertas(false)
  }, [])

  const irAGrupo = useCallback(() => {
    setModo('grupo')
    setAlumno(null)
    setDataAlumno(null)
    setError(null)
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const revisarOtro = useCallback(() => {
    setDataGrupo(null)
    setDataAlumno(null)
    setAlumno(null)
    setError(null)
    setConsulta('')
    setSugerenciasAbiertas(false)
    setIndiceActivo(0)
    window.setTimeout(() => {
      if (modo === 'grupo') {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }, 50)
  }, [modo])

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

        <section className="rev-pag-panel rev-pag-panel--buscar" ref={searchWrapRef}>
          <header className="rev-pag-panel-head rev-pag-panel-head--inline">
            <span className="rev-pag-panel-step">1</span>
            <h2 className="rev-pag-panel-title">
              {modo === 'grupo' ? 'Grupo' : 'Alumno'}
            </h2>
            <p className="rev-pag-panel-sub">
              {modo === 'grupo'
                ? 'K2A Kinder · 2A Primaria · 7B Secundaria'
                : 'Nombre o No. de control'}
            </p>
          </header>

          {modo === 'grupo' ? (
            <form className="rev-pag-grupo-form" onSubmit={onSubmit}>
              <label className="rev-pag-grupo-label" htmlFor="rev-pag-grupo-input">
                Buscar por grupo
              </label>
              <div className="rev-pag-grupo-row">
                <div className="rev-pag-grupo-ac">
                  <input
                    ref={inputRef}
                    id="rev-pag-grupo-input"
                    className="rev-pag-grupo-input"
                    type="search"
                    role="combobox"
                    aria-expanded={sugerenciasAbiertas && sugerencias.length > 0}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                      sugerenciasAbiertas && sugerencias[indiceActivo]
                        ? `${listboxId}-${indiceActivo}`
                        : undefined
                    }
                    inputMode="text"
                    enterKeyHint="search"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    autoFocus
                    placeholder="Ej. K2A o 2A"
                    value={consulta}
                    onChange={(e) => {
                      const next = normalizarCodigoGrupo(e.target.value)
                      setConsulta(next)
                      setSugerenciasAbiertas(true)
                      setIndiceActivo(0)
                    }}
                    onFocus={() => setSugerenciasAbiertas(true)}
                    onBlur={() => {
                      window.setTimeout(() => setSugerenciasAbiertas(false), 150)
                    }}
                    onKeyDown={onKeyDown}
                  />
                  {sugerenciasAbiertas && sugerencias.length > 0 ? (
                    <ul
                      id={listboxId}
                      className="rev-pag-grupo-sugerencias"
                      role="listbox"
                      aria-label="Grupos encontrados"
                    >
                      {sugerencias.map((g, idx) => (
                        <li key={`${g.codigo}-${g.nivel}`} role="presentation">
                          <button
                            type="button"
                            id={`${listboxId}-${idx}`}
                            role="option"
                            aria-selected={idx === indiceActivo}
                            className={`rev-pag-grupo-sugerencia${idx === indiceActivo ? ' is-active' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => elegirSugerencia(g)}
                          >
                            <strong>{g.codigo}</strong>
                            <span>
                              {g.nivel_label} · {g.alumnos} alumno
                              {g.alumnos === 1 ? '' : 's'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rev-pag-grupo-btn rev-pag-grupo-btn--individual"
                  onClick={irAIndividual}
                >
                  <UserRoundSearch size={18} aria-hidden />
                  Individual
                </button>
              </div>
              <p className="rev-pag-grupo-hint">
                Kinder: K1A / K2A / K3A · Enter despliega la lista del grupo
              </p>
            </form>
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
            <p className="rev-pag-panel-sub">Verde pagó · Rojo pendiente</p>
          </header>

          {loading ? (
            <div className="rev-pag-loading" role="status">
              <Loader2 className="rev-pag-spin" size={32} aria-hidden />
              {modo === 'grupo' ? 'Cargando grupo…' : 'Consultando inscripción…'}
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
                ? 'Elige un grupo (K2A, 2A, 7B…) y pulsa Enter.'
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
  return (
    <div className="rev-pag-grupo-result">
      <div className="rev-pag-grupo-summary">
        <div className="rev-pag-grupo-summary-title">
          <span className="rev-pag-grupo-badge">{data.grupo_etiqueta}</span>
          <div>
            <strong>
              {data.total} alumno{data.total === 1 ? '' : 's'}
              {data.nivel_label ? ` · ${data.nivel_label}` : ''}
            </strong>
            <p>
              Ciclo escolar {data.ciclo_label} · {data.pagados} pagados ·{' '}
              {data.pendientes} pendientes
            </p>
          </div>
        </div>
        <div className="rev-pag-grupo-counts" aria-hidden>
          <span className="rev-pag-grupo-count rev-pag-grupo-count--ok">
            {data.pagados}
          </span>
          <span className="rev-pag-grupo-count rev-pag-grupo-count--bad">
            {data.pendientes}
          </span>
        </div>
      </div>

      {data.alumnos.length === 0 ? (
        <div className="rev-pag-idle">
          No hay alumnos activos en {data.grupo_etiqueta}
          {data.nivel_label ? ` (${data.nivel_label})` : ''} este ciclo.
        </div>
      ) : (
        <ul className="rev-pag-grupo-lista">
          {data.alumnos.map((a) => (
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
                    {a.nivel_label} · {a.grado_label} {a.grupo_letra}
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
