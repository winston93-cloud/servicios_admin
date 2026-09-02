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
  XCircle,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import {
  CicloEscolarProvider,
  useCicloEscolar,
} from '@/contexts/CicloEscolarContext'
import type { RevisionGrupoResultado } from '@/lib/revisionPagadosGrupo'
import './revision-pagados.css'

const LOGO_EDUCATIVO = '/logos/logo-winston-educativo.png'
const LOGO_WINSTON = '/logos/logo-winston-w.png'

export default function RevisionPagadosPage() {
  // Acceso directo (entrada al colegio): sin login; URL pública bookmarkable.
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

  const [consulta, setConsulta] = useState('')
  const [data, setData] = useState<RevisionGrupoResultado | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollAlResultado = useCallback(() => {
    const el = resultadoRef.current
    if (!el) return
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  useEffect(() => {
    if (!loading && (data || error)) scrollAlResultado()
  }, [loading, data, error, scrollAlResultado])

  useEffect(() => {
    if (loading) scrollAlResultado()
  }, [loading, scrollAlResultado])

  const buscarGrupo = useCallback(async (raw: string) => {
    const grupo = raw.trim()
    if (!grupo) {
      setError('Escribe un grupo, por ejemplo 2a o 7b.')
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch('/api/revision-pagados/grupo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'No se pudo consultar el grupo.')
      }
      setData(json as RevisionGrupoResultado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar')
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      void buscarGrupo(consulta)
    },
    [buscarGrupo, consulta]
  )

  const revisarOtro = useCallback(() => {
    setData(null)
    setError(null)
    setConsulta('')
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
  }, [])

  const cicloEscolarLabel =
    etiquetaCicloInscripcionSistema ||
    (cicloInscripcionSistema != null
      ? `${cicloInscripcionSistema + 2003}-${cicloInscripcionSistema + 2004}`
      : null)
  const cicloHint = cicloEscolarLabel
    ? `Ciclo escolar ${cicloEscolarLabel}`
    : 'Ciclo vigente'

  return (
    <div className={`rev-pag-page${data ? ' rev-pag-page--con-resultado' : ''}`}>
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
            <h2 className="rev-pag-panel-title">Grupo</h2>
            <p className="rev-pag-panel-sub">Ejemplo 2a, 5b, 7b · sin nivel</p>
          </header>

          <form className="rev-pag-grupo-form" onSubmit={onSubmit}>
            <label className="rev-pag-grupo-label" htmlFor="rev-pag-grupo-input">
              Buscar por grupo
            </label>
            <div className="rev-pag-grupo-row">
              <span className="rev-pag-grupo-icon" aria-hidden>
                <Search size={22} />
              </span>
              <input
                ref={inputRef}
                id="rev-pag-grupo-input"
                className="rev-pag-grupo-input"
                type="search"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                autoFocus
                placeholder="2a"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
              />
              <button type="submit" className="rev-pag-grupo-btn" disabled={loading}>
                {loading ? 'Buscando…' : 'Ver lista'}
              </button>
            </div>
          </form>
        </section>

        <section
          ref={resultadoRef}
          className="rev-pag-panel rev-pag-panel--resultado"
          aria-live="polite"
        >
          <header className="rev-pag-panel-head rev-pag-panel-head--inline">
            <span className="rev-pag-panel-step">2</span>
            <h2 className="rev-pag-panel-title">Resultado</h2>
            <p className="rev-pag-panel-sub">
              Verde pagó · Rojo pendiente
            </p>
          </header>

          {loading ? (
            <div className="rev-pag-loading" role="status">
              <Loader2 className="rev-pag-spin" size={32} aria-hidden />
              Cargando grupo…
            </div>
          ) : null}

          {error ? (
            <div className="rev-pag-error" role="alert">
              {error}
            </div>
          ) : null}

          {!loading && !error && !data ? (
            <div className="rev-pag-idle">
              Escribe el grupo (2a, 7b…) y toca Ver lista.
            </div>
          ) : null}

          {data ? <ResultadoGrupo data={data} onOtro={revisarOtro} /> : null}
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
          No hay alumnos activos en el grupo {data.grupo_etiqueta} este ciclo.
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
          Revisar otro grupo
        </button>
      </div>
    </div>
  )
}
