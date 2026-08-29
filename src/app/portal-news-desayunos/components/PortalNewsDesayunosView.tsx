'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Coffee,
  ExternalLink,
  FileText,
  Loader2,
  Newspaper,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
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

export default function PortalNewsDesayunosView() {
  const router = useRouter()
  const [data, setData] = useState<PortalData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/portal-news-desayunos')
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
    void cargar()
  }, [cargar])

  return (
    <div className="nd-page nd-portal">
      <div className="nd-bg" aria-hidden />
      <div className="nd-shell">
        <header className="nd-header nd-portal-header">
          <button
            type="button"
            className="nd-back"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al inicio
          </button>
          <div className="nd-portal-hero">
            <p className="nd-kicker">Portal familias</p>
            <h1 className="nd-title">News y Desayunos</h1>
            {data ? (
              <p className="nd-portal-mes">
                <CalendarDays size={18} aria-hidden />
                Mes en curso: <strong>{data.periodo.etiqueta}</strong>
              </p>
            ) : (
              <p className="nd-subtitle">Folleto informativo y menú de alimentación escolar</p>
            )}
          </div>
        </header>

        {cargando ? (
          <p className="nd-muted nd-portal-loading">
            <Loader2 size={20} className="nd-spin" aria-hidden />
            Cargando publicaciones…
          </p>
        ) : error ? (
          <p className="nd-error" role="alert">
            {error}
          </p>
        ) : (
          <div className="nd-portal-grid">
            <TarjetaArchivo
              titulo="News del mes"
              subtitulo="Folleto informativo para familias"
              icon={<Newspaper size={22} />}
              publicacion={data?.news ?? null}
              vacio="El News de este mes aún no está disponible."
            />
            <TarjetaArchivo
              titulo="Desayunos y comidas"
              subtitulo="Menú diario del mes"
              icon={<Coffee size={22} />}
              publicacion={data?.desayunos ?? null}
              vacio="El menú de este mes aún no está disponible."
            />
          </div>
        )}
      </div>
    </div>
  )
}
