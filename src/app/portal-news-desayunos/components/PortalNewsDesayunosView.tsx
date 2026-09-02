'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Coffee,
  ExternalLink,
  FileText,
  Loader2,
  Newspaper,
  Sparkles,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import {
  etiquetaMesAnio,
  MESES_ES,
  periodoActualMx,
  type PeriodoMes,
} from '@/lib/portalNewsDesayunosMes'
import '../../news-desayunos/news-desayunos.css'

type Publicacion = {
  nombre_archivo: string | null
  href: string
  esImagen: boolean
  mime_type: string
}

type PortalData = {
  periodo: {
    anio: number
    mes: number
    etiqueta: string
    esActual: boolean
  }
  audiencia_label?: string | null
  news: Publicacion | null
  desayunos: Publicacion | null
}

function TarjetaArchivo({
  titulo,
  subtitulo,
  icon,
  publicacion,
  vacio,
}: {
  titulo: string
  subtitulo: string
  icon: React.ReactNode
  publicacion: Publicacion | null
  vacio: string
}) {
  return (
    <article className="nd-portal-card">
      <header className="nd-portal-card-head">
        <span className="nd-portal-card-icon" aria-hidden>
          {icon}
        </span>
        <div>
          <h2 className="nd-portal-card-title">{titulo}</h2>
          <p className="nd-portal-card-sub">{subtitulo}</p>
        </div>
      </header>

      {!publicacion ? (
        <div className="nd-portal-empty">
          <p>{vacio}</p>
        </div>
      ) : publicacion.esImagen ? (
        <div className="nd-portal-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicacion.href}
            alt={titulo}
            className="nd-portal-img"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="nd-portal-pdf">
          <FileText size={40} aria-hidden />
          <p>{publicacion.nombre_archivo ?? 'Documento PDF'}</p>
        </div>
      )}

      {publicacion ? (
        <a
          href={publicacion.href}
          target="_blank"
          rel="noopener noreferrer"
          className="nd-portal-btn"
        >
          <ExternalLink size={16} aria-hidden />
          Abrir {publicacion.esImagen ? 'imagen' : 'PDF'}
        </a>
      ) : null}
    </article>
  )
}

function SelectorPeriodo({
  periodo,
  esActual,
  onChange,
  deshabilitado,
}: {
  periodo: PeriodoMes
  esActual: boolean
  onChange: (p: PeriodoMes) => void
  deshabilitado?: boolean
}) {
  const mesId = useId()
  const anioId = useId()
  const actual = periodoActualMx()

  const anios = useMemo(() => {
    const lista: number[] = []
    for (let y = actual.anio - 2; y <= actual.anio + 1; y += 1) lista.push(y)
    return lista
  }, [actual.anio])

  return (
    <section className="nd-periodo-banner" aria-label="Seleccionar mes de consulta">
      <div className="nd-periodo-banner-glow" aria-hidden />
      <div className="nd-periodo-banner-inner">
        <div className="nd-periodo-banner-copy">
          <span className="nd-periodo-banner-icon" aria-hidden>
            <CalendarDays size={22} />
          </span>
          <div>
            <p className="nd-periodo-banner-kicker">Consultar publicación</p>
            <p className="nd-periodo-banner-etiqueta">{etiquetaMesAnio(periodo.anio, periodo.mes)}</p>
          </div>
          {esActual ? (
            <span className="nd-periodo-badge">
              <Sparkles size={12} aria-hidden />
              Mes actual
            </span>
          ) : null}
        </div>

        <div className="nd-periodo-selects">
          <label className="nd-periodo-field" htmlFor={mesId}>
            <span className="nd-periodo-field-label">Mes</span>
            <span className="nd-periodo-select-wrap">
              <select
                id={mesId}
                className="nd-periodo-select"
                value={periodo.mes}
                disabled={deshabilitado}
                onChange={(e) =>
                  onChange({ ...periodo, mes: Number(e.target.value) })
                }
              >
                {MESES_ES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="nd-periodo-chevron" aria-hidden />
            </span>
          </label>

          <label className="nd-periodo-field" htmlFor={anioId}>
            <span className="nd-periodo-field-label">Año</span>
            <span className="nd-periodo-select-wrap">
              <select
                id={anioId}
                className="nd-periodo-select"
                value={periodo.anio}
                disabled={deshabilitado}
                onChange={(e) =>
                  onChange({ ...periodo, anio: Number(e.target.value) })
                }
              >
                {anios.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="nd-periodo-chevron" aria-hidden />
            </span>
          </label>
        </div>
      </div>
    </section>
  )
}

export default function PortalNewsDesayunosView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id
  const [periodo, setPeriodo] = useState<PeriodoMes>(() => periodoActualMx())
  const [data, setData] = useState<PortalData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const actual = useMemo(() => periodoActualMx(), [])
  const esActual = periodo.anio === actual.anio && periodo.mes === actual.mes

  const etiquetaPeriodo = etiquetaMesAnio(periodo.anio, periodo.mes)

  const cargar = useCallback(async (p: PeriodoMes, id?: number) => {
    setCargando(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        anio: String(p.anio),
        mes: String(p.mes),
      })
      if (id && id > 0) params.set('alumnoId', String(id))
      const res = await fetch(`/api/portal-news-desayunos?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar')
      setData(json as PortalData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
      setData(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar(periodo, alumnoId)
  }, [periodo, alumnoId, cargar])

  const newsTitulo = data?.audiencia_label
    ? data.audiencia_label
    : 'News del mes'

  return (
    <div className="nd-page nd-portal">
      <div className="nd-bg" aria-hidden />
      <div className="nd-shell">
        <header className="nd-header nd-portal-header">
          <div className="nd-portal-topbar">
            <button
              type="button"
              className="nd-back"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft size={16} aria-hidden />
              Volver al inicio
            </button>
            <ThemeToggle />
          </div>
          <div className="nd-portal-hero min-w-0">
            <p className="nd-kicker">Portal familias</p>
            <h1 className="nd-title">News y Desayunos</h1>
            <p className="nd-subtitle">
              Folleto informativo y menú de alimentación escolar
            </p>
          </div>
        </header>

        <SelectorPeriodo
          periodo={periodo}
          esActual={esActual}
          onChange={setPeriodo}
          deshabilitado={cargando}
        />

        {cargando ? (
          <p className="nd-muted nd-portal-loading">
            <Loader2 size={20} className="nd-spin" aria-hidden />
            Cargando {etiquetaPeriodo}…
          </p>
        ) : error ? (
          <p className="nd-error nd-portal-error" role="alert">
            {error}
          </p>
        ) : (
          <div className="nd-portal-grid">
            <TarjetaArchivo
              titulo={newsTitulo}
              subtitulo={`Folleto informativo · ${etiquetaPeriodo}`}
              icon={<Newspaper size={22} />}
              publicacion={data?.news ?? null}
              vacio={`El News de ${etiquetaPeriodo} aún no está disponible.`}
            />
            <TarjetaArchivo
              titulo="Desayunos y comidas"
              subtitulo={`Menú diario · ${etiquetaPeriodo}`}
              icon={<Coffee size={22} />}
              publicacion={data?.desayunos ?? null}
              vacio={`El menú de ${etiquetaPeriodo} aún no está disponible.`}
            />
          </div>
        )}
      </div>
    </div>
  )
}
