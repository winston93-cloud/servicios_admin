'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Coffee,
  Loader2,
  Newspaper,
  Trash2,
  Upload,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  AUDIENCIAS_NEWS,
  etiquetaAudienciaNews,
  type AudienciaNews,
} from '@/lib/portalNewsDesayunosAudiencia'
import {
  etiquetaMesAnio,
  MESES_ES,
  periodoActualMx,
  type PeriodoMes,
} from '@/lib/portalNewsDesayunosMes'
import { useRouter } from 'next/navigation'
import '../news-desayunos.css'

type PublicacionFila = {
  id: number
  tipo: 'news' | 'desayunos'
  audiencia: string
  anio: number
  mes: number
  nombre_archivo: string | null
  mime_type: string
  updated_at: string
  href: string
  esImagen: boolean
}

type ZonaUploadProps = {
  tipo: 'news' | 'desayunos'
  audiencia?: AudienciaNews
  titulo: string
  descripcion: string
  icon: React.ReactNode
  periodo: PeriodoMes
  onPeriodoChange: (p: PeriodoMes) => void
  publicado: PublicacionFila | null
  onSubido: () => void
}

const MAX_BYTES = 20 * 1024 * 1024

function ZonaUpload({
  tipo,
  audiencia,
  titulo,
  descripcion,
  icon,
  periodo,
  onPeriodoChange,
  publicado,
  onSubido,
}: ZonaUploadProps) {
  const mesId = useId()
  const anioId = useId()
  const fileId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  const tomarArchivo = (file: File | null | undefined) => {
    if (!file) return
    const mime = file.type.toLowerCase()
    const nombre = file.name.toLowerCase()
    const valido =
      mime === 'application/pdf' ||
      mime.startsWith('image/') ||
      /\.(pdf|png|jpe?g|webp)$/i.test(nombre)
    if (!valido) {
      setError('Use PDF, PNG, JPG o WEBP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Máximo 20 MB.')
      return
    }
    setArchivo(file)
    setError(null)
  }

  const subir = async () => {
    if (!archivo) {
      setError('Seleccione un archivo.')
      return
    }
    setSubiendo(true)
    setError(null)
    setOk(null)
    try {
      const fd = new FormData()
      fd.set('tipo', tipo)
      if (tipo === 'news' && audiencia) fd.set('audiencia', audiencia)
      fd.set('anio', String(periodo.anio))
      fd.set('mes', String(periodo.mes))
      fd.set('archivo', archivo)
      const res = await fetch('/api/news-desayunos', {
        method: 'POST',
        headers: portalSessionFetchHeaders(),
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo subir')
      setOk(`Publicado para ${etiquetaMesAnio(periodo.anio, periodo.mes)}`)
      setArchivo(null)
      if (inputRef.current) inputRef.current.value = ''
      onSubido()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setSubiendo(false)
    }
  }

  const eliminar = async () => {
    if (!publicado) return
    if (!window.confirm(`¿Eliminar ${titulo} de ${etiquetaMesAnio(periodo.anio, periodo.mes)}?`)) {
      return
    }
    setEliminando(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        tipo,
        anio: String(periodo.anio),
        mes: String(periodo.mes),
      })
      if (tipo === 'news' && audiencia) params.set('audiencia', audiencia)
      const res = await fetch(`/api/news-desayunos?${params.toString()}`, {
        method: 'DELETE',
        headers: portalSessionFetchHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      onSubido()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <article className="nd-card" data-tipo={tipo}>
      <header className="nd-card-head">
        <span className="nd-card-icon" aria-hidden>
          {icon}
        </span>
        <div>
          <h2 className="nd-card-title">{titulo}</h2>
          <p className="nd-card-desc">{descripcion}</p>
        </div>
      </header>

      <div className="nd-periodo-grid">
        <label className="nd-field" htmlFor={mesId}>
          Mes de publicación
          <select
            id={mesId}
            className="nd-input"
            value={periodo.mes}
            onChange={(e) =>
              onPeriodoChange({ ...periodo, mes: Number(e.target.value) })
            }
            disabled={subiendo || eliminando}
          >
            {MESES_ES.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="nd-field" htmlFor={anioId}>
          Año
          <input
            id={anioId}
            type="number"
            className="nd-input"
            min={2020}
            max={2100}
            value={periodo.anio}
            onChange={(e) =>
              onPeriodoChange({ ...periodo, anio: Number(e.target.value) })
            }
            disabled={subiendo || eliminando}
          />
        </label>
      </div>

      <p className="nd-periodo-etiqueta">
        <CalendarDays size={14} aria-hidden />
        Periodo: <strong>{etiquetaMesAnio(periodo.anio, periodo.mes)}</strong>
      </p>

      {publicado ? (
        <div className="nd-publicado">
          <CheckCircle2 size={16} aria-hidden />
          <div className="min-w-0">
            <p className="nd-publicado-titulo">Publicado</p>
            <p className="nd-publicado-archivo">{publicado.nombre_archivo}</p>
            <a href={publicado.href} target="_blank" rel="noopener noreferrer" className="nd-link">
              Ver archivo
            </a>
          </div>
          <button
            type="button"
            className="nd-btn-danger"
            onClick={() => void eliminar()}
            disabled={eliminando || subiendo}
          >
            {eliminando ? <Loader2 size={14} className="nd-spin" /> : <Trash2 size={14} />}
            Eliminar
          </button>
        </div>
      ) : (
        <p className="nd-sin-archivo">Sin archivo para este mes.</p>
      )}

      <input
        ref={inputRef}
        id={fileId}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
        className="nd-file-input"
        onChange={(e) => tomarArchivo(e.target.files?.[0])}
      />
      <div
        className={`nd-drop${arrastrando ? ' dragging' : ''}${archivo ? ' has-file' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          tomarArchivo(e.dataTransfer.files?.[0])
        }}
      >
        <button
          type="button"
          className="nd-drop-btn"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo || eliminando}
        >
          <Upload size={22} aria-hidden />
          <span>{archivo ? archivo.name : 'Seleccione PDF o imagen'}</span>
        </button>
      </div>

      {error ? (
        <p className="nd-error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="nd-ok" role="status">
          {ok}
        </p>
      ) : null}

      <button
        type="button"
        className="nd-btn-primary"
        onClick={() => void subir()}
        disabled={subiendo || eliminando || !archivo}
      >
        {subiendo ? (
          <>
            <Loader2 size={16} className="nd-spin" aria-hidden />
            Subiendo…
          </>
        ) : (
          <>
            <Upload size={16} aria-hidden />
            Publicar {etiquetaMesAnio(periodo.anio, periodo.mes)}
          </>
        )}
      </button>
    </article>
  )
}

export default function NewsDesayunosAdminView() {
  const router = useRouter()
  const actual = periodoActualMx()
  const [periodoNews, setPeriodoNews] = useState<PeriodoMes>(actual)
  const [periodoDesayunos, setPeriodoDesayunos] = useState<PeriodoMes>(actual)
  const [lista, setLista] = useState<PublicacionFila[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/news-desayunos', {
        headers: portalSessionFetchHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar')
      setLista((data.publicaciones ?? []) as PublicacionFila[])
    } catch {
      setLista([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const buscar = (
    tipo: 'news' | 'desayunos',
    p: PeriodoMes,
    audiencia?: AudienciaNews
  ) =>
    lista.find(
      (x) =>
        x.tipo === tipo &&
        x.anio === p.anio &&
        x.mes === p.mes &&
        (tipo === 'desayunos' ? !x.audiencia || x.audiencia === '' : x.audiencia === audiencia)
    ) ?? null

  return (
    <ProtectedRoute roles={['usuario']}>
      <div className="nd-page nd-admin">
        <div className="nd-bg" aria-hidden />
        <div className="nd-shell">
          <header className="nd-header">
            <div className="nd-admin-topbar">
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
            <div className="nd-header-main">
              <div className="min-w-0">
                <p className="nd-kicker">Comunicación · Familias</p>
                <h1 className="nd-title">News y Desayunos</h1>
                <p className="nd-subtitle">
                  Suba tres folletos News (Educativo, Primaria y Secundaria) y el menú de
                  desayunos y comidas. Los papás verán el News de su nivel en el portal.
                </p>
              </div>
            </div>
          </header>

          <section className="nd-news-grupo" aria-labelledby="nd-news-grupo-title">
            <h2 id="nd-news-grupo-title" className="nd-news-grupo-title">
              News del mes (3 folletos)
            </h2>
            <p className="nd-news-grupo-desc">
              Un archivo por plantel: Educativo (Maternal/Kinder), Winston Primaria y Winston
              Secundaria.
            </p>
            <div className="nd-admin-grid nd-admin-grid-news">
              {AUDIENCIAS_NEWS.map((aud) => (
                <ZonaUpload
                  key={aud.valor}
                  tipo="news"
                  audiencia={aud.valor}
                  titulo={aud.titulo}
                  descripcion={aud.descripcion}
                  icon={<Newspaper size={22} />}
                  periodo={periodoNews}
                  onPeriodoChange={setPeriodoNews}
                  publicado={buscar('news', periodoNews, aud.valor)}
                  onSubido={() => void cargar()}
                />
              ))}
            </div>
          </section>

          <div className="nd-admin-grid nd-admin-grid-solo">
            <ZonaUpload
              tipo="desayunos"
              titulo="Desayunos y comidas"
              descripcion="Menú diario del mes para todos los niveles (PDF o imagen JPG/PNG)."
              icon={<Coffee size={22} />}
              periodo={periodoDesayunos}
              onPeriodoChange={setPeriodoDesayunos}
              publicado={buscar('desayunos', periodoDesayunos)}
              onSubido={() => void cargar()}
            />
          </div>

          <section className="nd-historial" aria-labelledby="nd-historial-title">
            <h2 id="nd-historial-title" className="nd-historial-title">
              Publicaciones recientes
            </h2>
            {cargando ? (
              <p className="nd-muted">
                <Loader2 size={16} className="nd-spin" aria-hidden /> Cargando…
              </p>
            ) : lista.length === 0 ? (
              <p className="nd-muted">Aún no hay archivos publicados.</p>
            ) : (
              <ul className="nd-historial-lista">
                {lista.map((p) => (
                  <li key={p.id}>
                    <span className="nd-historial-tipo">
                      {p.tipo === 'news'
                        ? `News · ${etiquetaAudienciaNews(p.audiencia as AudienciaNews)}`
                        : 'Desayunos'}
                    </span>
                    <span>{etiquetaMesAnio(p.anio, p.mes)}</span>
                    <a href={p.href} target="_blank" rel="noopener noreferrer" className="nd-link">
                      {p.nombre_archivo ?? 'Ver'}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </ProtectedRoute>
  )
}
