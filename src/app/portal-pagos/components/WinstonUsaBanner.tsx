'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, GraduationCap, PlayCircle } from 'lucide-react'
import type { SeccionMatrizPortal, WinstonUsaPortalInfo } from '@/lib/portalPagosMatrizService'
import { normalizarConceptoNo } from '@/lib/pagoReferenciaColegiatura'
import { formatearMontoPortal } from '@/lib/portalPagosService'
import { marcarAvisoUsaAceptado } from '@/lib/winstonUsaAvisoAceptado'
import { videoEmbed } from '@/lib/videoEmbed'
import WinstonUsaAvisoModal from './WinstonUsaAvisoModal'
import { PAGO_USA } from './PortalPagosTablaSeccion'

interface WinstonUsaBannerProps {
  alumnoId: number
  info: WinstonUsaPortalInfo
  seccion: SeccionMatrizPortal | undefined
}

function fechaLarga(iso: string, conAnio = false): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    ...(conAnio ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

function conAutoplay(src: string): string {
  if (!/youtube-nocookie\.com|player\.vimeo\.com/.test(src)) return src
  return `${src}${src.includes('?') ? '&' : '?'}autoplay=1`
}

export default function WinstonUsaBanner({ alumnoId, info, seccion }: WinstonUsaBannerProps) {
  const [aviso, setAviso] = useState(false)
  const [verVideo, setVerVideo] = useState(false)

  const pendiente = seccion?.filas.find((f) => !f.pagado)
  const pagoPendiente = pendiente ? PAGO_USA[normalizarConceptoNo(pendiente.conceptoNo)] : undefined
  const video = useMemo(() => (info.videoUrl ? videoEmbed(info.videoUrl) : null), [info.videoUrl])
  const videoRef = useRef<HTMLVideoElement>(null)
  const marcoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!verVideo) return
    marcoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    // Si el navegador no deja reproducir con sonido, quedan los controles para darle play.
    videoRef.current?.play().catch(() => {})
  }, [verVideo])

  const estado = pendiente
    ? `Pago ${pagoPendiente ?? ''} disponible: ${
        pendiente.importe != null ? formatearMontoPortal(pendiente.importe) : ''
      } MXN`
    : info.proximaApertura
      ? `El Pago ${info.proximaApertura.pago} se abre el ${fechaLarga(info.proximaApertura.fecha)}`
      : 'Consulta tus pagos del programa'

  const irAPagos = useCallback(() => {
    const el = document.getElementById('seccion-winston-usa')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const tabla = el.closest('.portal-matriz-seccion')
    tabla?.classList.add('portal-usa-resaltado')
    window.setTimeout(() => tabla?.classList.remove('portal-usa-resaltado'), 2400)
  }, [])

  const cerrar = useCallback(() => setAviso(false), [])

  const onClick = () => {
    if (!pendiente && !info.proximaApertura) {
      irAPagos()
      return
    }
    setAviso(true)
  }

  return (
    <section className="portal-usa-banner" aria-labelledby="portal-usa-banner-titulo">
      <div className="portal-usa-banner-fondo" aria-hidden />
      <div className="portal-usa-banner-contenido">
        <span className="portal-usa-banner-icono" aria-hidden>
          <GraduationCap size={34} />
        </span>
        <div className="portal-usa-banner-texto">
          <p className="portal-usa-banner-eyebrow">Doble titulación · Opcional</p>
          <h2 id="portal-usa-banner-titulo" className="portal-usa-banner-titulo">
            Winston USA Program
          </h2>
          <p className="portal-usa-banner-lead">
            Documentación académica estadounidense respaldada por una institución acreditada, para
            fortalecer el expediente de tu hijo con proyección internacional.
          </p>
          <p className="portal-usa-banner-estado">{estado}</p>
          {info.fechaCierre ? (
            <p className="portal-usa-banner-cierre">
              Inscripciones al programa hasta el {fechaLarga(info.fechaCierre, true)}.
            </p>
          ) : null}
        </div>
        <div className="portal-usa-banner-acciones">
          <button type="button" className="portal-usa-banner-cta" onClick={onClick}>
            {pendiente ? 'Conocer y pagar' : 'Conocer el programa'}
            <ArrowRight size={18} aria-hidden />
          </button>
          {video ? (
            <button
              type="button"
              className="portal-usa-banner-video-btn"
              aria-expanded={verVideo}
              onClick={() => setVerVideo((v) => !v)}
            >
              <PlayCircle size={18} aria-hidden />
              {verVideo ? 'Ocultar video' : 'Ver video'}
            </button>
          ) : null}
        </div>
      </div>

      {video && verVideo ? (
        <div className="portal-usa-banner-video" ref={marcoRef}>
          {video.tipo === 'iframe' ? (
            <iframe
              src={conAutoplay(video.src)}
              title="Video Winston USA Program"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <video ref={videoRef} src={video.src} controls playsInline autoPlay preload="auto" />
          )}
        </div>
      ) : null}

      <WinstonUsaAvisoModal
        abierto={aviso}
        pago={pagoPendiente ?? info.proximaApertura?.pago ?? 1}
        concepto={pendiente?.conceptoClase ?? 'Winston USA Program'}
        textoContinuar="Ir a los pagos del programa"
        notaSinPago={
          !pendiente && info.proximaApertura
            ? `El Pago ${info.proximaApertura.pago} estará disponible aquí a partir del ${fechaLarga(info.proximaApertura.fecha)}.`
            : undefined
        }
        onCancelar={cerrar}
        onContinuar={() => {
          setAviso(false)
          if (pendiente) marcarAvisoUsaAceptado(alumnoId, normalizarConceptoNo(pendiente.conceptoNo))
          window.setTimeout(irAPagos, 50)
        }}
      />
    </section>
  )
}
