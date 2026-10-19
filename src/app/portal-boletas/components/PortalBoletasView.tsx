'use client'

import { ItemAnimado, ListaAnimada } from '@/components/boletas-motion'
import { useAuth } from '@/contexts/AuthContext'
import PortalDocumentoModal from '@/app/portal-pagos/components/PortalDocumentoModal'
import { videoEmbed } from '@/lib/videoEmbed'
import { ArrowLeft, BookOpen, Clock, FileText, PlayCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import '../portal-boletas.css'

type BoletaPortal = { modulo: string; etiqueta: string; publicada: boolean }

type EstadoBoletas = {
  alumno: { nombre: string; nivel: number }
  ciclo: { valor: number; nombre: string | null }
  aplica: boolean
  trimestres: { trimestre: number; boletas: BoletaPortal[] }[]
  videoUrl: string | null
}

export default function PortalBoletasView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [estado, setEstado] = useState<EstadoBoletas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verVideo, setVerVideo] = useState(false)
  const [doc, setDoc] = useState<{ url: string; titulo: string } | null>(null)

  const cargar = useCallback(async () => {
    if (!alumnoId) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal-boletas?alumnoId=${alumnoId}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || 'No se pudieron cargar las boletas.')
      setEstado(data as EstadoBoletas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las boletas.')
    } finally {
      setCargando(false)
    }
  }, [alumnoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const video = useMemo(() => (estado?.videoUrl ? videoEmbed(estado.videoUrl) : null), [estado?.videoUrl])
  const hayPublicadas = Boolean(estado?.trimestres.some((t) => t.boletas.some((b) => b.publicada)))
  const refFmt = session?.alumno_ref != null ? String(session.alumno_ref).padStart(5, '0') : '—'
  const cicloEtiqueta = estado?.ciclo.nombre ?? ''

  const abrir = (trimestre: number, b: BoletaPortal, varias: boolean) => {
    if (!alumnoId) return
    setDoc({
      url: `/api/portal-boletas/pdf?alumnoId=${alumnoId}&modulo=${encodeURIComponent(b.modulo)}&trimestre=${trimestre}`,
      titulo: `Boleta trimestre ${trimestre}${varias ? ` · ${b.etiqueta}` : ''}`,
    })
  }

  return (
    <div className="portal-pagos-page portal-boletas-page">
      <header className="portal-boletas-header">
        <button type="button" className="servicios-back-btn" onClick={() => router.push('/dashboard')}>
          <ArrowLeft size={16} aria-hidden />
          Volver al inicio
        </button>
        <div className="portal-boletas-title-row">
          <span className="portal-boletas-title-icon" aria-hidden>
            <BookOpen size={22} />
          </span>
          <div className="portal-boletas-title-text">
            <h1>Boletas</h1>
            <p className="portal-pagos-subtitle">
              Calificaciones {cicloEtiqueta ? `del ciclo ${cicloEtiqueta}` : 'del ciclo escolar'}
            </p>
          </div>
        </div>
        {estado && (
          <div className="portal-boletas-meta">
            <span className="portal-boletas-chip">
              Control <strong>{refFmt}</strong>
            </span>
            {estado.alumno.nombre ? (
              <span className="portal-boletas-chip portal-boletas-chip--muted">{estado.alumno.nombre}</span>
            ) : null}
          </div>
        )}
      </header>

      {cargando && !estado ? (
        <p className="portal-boletas-estado" role="status">
          <RefreshCw size={18} className="portal-boletas-spin" aria-hidden />
          Cargando boletas…
        </p>
      ) : error ? (
        <div className="portal-boletas-alerta" role="alert">
          <p>{error}</p>
          <button type="button" className="portal-boletas-btn-sec" onClick={() => void cargar()}>
            <RefreshCw size={16} aria-hidden />
            Reintentar
          </button>
        </div>
      ) : estado ? (
        <>
          {video ? (
            <section className="portal-boletas-video" aria-label="Mensaje para las familias">
              <div className="portal-boletas-video-head">
                <p>Mensaje para las familias</p>
                <button
                  type="button"
                  className="portal-boletas-btn-sec"
                  aria-expanded={verVideo}
                  onClick={() => setVerVideo((v) => !v)}
                >
                  <PlayCircle size={18} aria-hidden />
                  {verVideo ? 'Ocultar video' : 'Ver video'}
                </button>
              </div>
              {verVideo ? (
                <div className="portal-boletas-video-frame">
                  {video.tipo === 'iframe' ? (
                    <iframe
                      src={video.src}
                      title="Mensaje sobre las boletas"
                      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      loading="lazy"
                    />
                  ) : (
                    <video src={video.src} controls playsInline preload="metadata" />
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {!estado.aplica ? (
            <p className="portal-boletas-vacio">
              Las boletas en el portal son para Kinder, Primaria y Secundaria. Maternal recibe su
              reporte directamente de la escuela.
            </p>
          ) : (
            <>
              {!hayPublicadas && (
                <p className="portal-boletas-vacio">
                  {(estado.trimestres[0]?.boletas.length ?? 0) > 1
                    ? 'Aquí podrás consultar y descargar las boletas de Español e Inglés de tu hijo(a) en cuanto la escuela las publique al cierre de cada trimestre. Cada una se publica por separado.'
                    : 'Aquí podrás consultar y descargar la boleta de tu hijo(a) en cuanto la escuela la publique al cierre de cada trimestre.'}
                </p>
              )}
              <ListaAnimada ordenada className="portal-boletas-trimestres">
                {estado.trimestres.map((t) => {
                  if (t.boletas.length > 1) {
                    const publicadas = t.boletas.filter((b) => b.publicada).length
                    const completa = publicadas === t.boletas.length
                    return (
                      <ItemAnimado
                        key={t.trimestre}
                        className={`portal-boletas-trimestre portal-boletas-trimestre--doble${
                          completa ? ' is-publicada' : publicadas ? ' is-parcial' : ''
                        }`}
                      >
                        <div className="portal-boletas-trimestre-info">
                          <span className="portal-boletas-trimestre-titulo">Trimestre {t.trimestre}</span>
                          <span className="portal-boletas-trimestre-estado">
                            {completa ? (
                              'Disponibles'
                            ) : publicadas ? (
                              `${publicadas} de ${t.boletas.length} disponibles`
                            ) : (
                              <>
                                <Clock size={14} aria-hidden />
                                Se publican al cierre del trimestre
                              </>
                            )}
                          </span>
                        </div>
                        <ul className="portal-boletas-materias">
                          {t.boletas.map((b) => (
                            <li
                              key={b.modulo}
                              className={`portal-boletas-materia${b.publicada ? ' is-publicada' : ''}`}
                            >
                              <div className="portal-boletas-materia-info">
                                <span className="portal-boletas-materia-titulo">Boleta de {b.etiqueta}</span>
                                <span className="portal-boletas-materia-estado">
                                  {b.publicada ? (
                                    'Disponible'
                                  ) : (
                                    <>
                                      <Clock size={13} aria-hidden />
                                      Aún no publicada
                                    </>
                                  )}
                                </span>
                              </div>
                              {b.publicada ? (
                                <button
                                  type="button"
                                  className="portal-boletas-btn"
                                  onClick={() => abrir(t.trimestre, b, true)}
                                >
                                  <FileText size={16} aria-hidden />
                                  Ver boleta
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </ItemAnimado>
                    )
                  }
                  const lista = t.boletas.filter((b) => b.publicada)
                  return (
                    <ItemAnimado
                      key={t.trimestre}
                      className={`portal-boletas-trimestre${lista.length ? ' is-publicada' : ''}`}
                    >
                      <div className="portal-boletas-trimestre-info">
                        <span className="portal-boletas-trimestre-titulo">Trimestre {t.trimestre}</span>
                        <span className="portal-boletas-trimestre-estado">
                          {lista.length ? (
                            'Disponible'
                          ) : (
                            <>
                              <Clock size={14} aria-hidden />
                              Se publica al cierre del trimestre
                            </>
                          )}
                        </span>
                      </div>
                      {lista.length ? (
                        <div className="portal-boletas-acciones">
                          {lista.map((b) => (
                            <button
                              key={b.modulo}
                              type="button"
                              className="portal-boletas-btn"
                              onClick={() => abrir(t.trimestre, b, false)}
                            >
                              <FileText size={16} aria-hidden />
                              Ver boleta
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </ItemAnimado>
                  )
                })}
              </ListaAnimada>
            </>
          )}
        </>
      ) : null}

      <PortalDocumentoModal
        abierto={doc != null}
        tipo="pdf"
        url={doc?.url ?? null}
        titulo={doc?.titulo ?? ''}
        onCerrar={() => setDoc(null)}
      />
    </div>
  )
}
