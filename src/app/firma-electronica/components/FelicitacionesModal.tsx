'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Award, PartyPopper, Sparkles, X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  alumnoNombre: string
  tipoBecaLabel: string
  cicloLabel: string
  grado: string
}

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899', '#fff6df']

function lanzarConfeti(canvas: HTMLCanvasElement, durationMs = 4200) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * dpr)
    canvas.height = Math.floor(window.innerHeight * dpr)
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()

  type Particle = {
    x: number
    y: number
    w: number
    h: number
    color: string
    vx: number
    vy: number
    rot: number
    vr: number
  }

  const particles: Particle[] = Array.from({ length: 140 }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * window.innerHeight * 0.4,
    w: 6 + Math.random() * 8,
    h: 10 + Math.random() * 12,
    color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#0ea5e9',
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
  }))

  let raf = 0
  const start = performance.now()
  const onResize = () => resize()
  window.addEventListener('resize', onResize)

  const tick = (now: number) => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.06
      p.rot += p.vr
      if (p.y > window.innerHeight + 30) {
        p.y = -20
        p.x = Math.random() * window.innerWidth
        p.vy = 2 + Math.random() * 3
      }
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (now - start < durationMs) {
      raf = requestAnimationFrame(tick)
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
  }
  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }
}

export default function FelicitacionesModal({
  open,
  onClose,
  alumnoNombre,
  tipoBecaLabel,
  cicloLabel,
  grado,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const cerrar = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKey)
    let stopConfeti: (() => void) | undefined
    const t = window.setTimeout(() => {
      if (canvasRef.current) stopConfeti = lanzarConfeti(canvasRef.current)
    }, 80)
    return () => {
      window.clearTimeout(t)
      stopConfeti?.()
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, cerrar])

  if (!open) return null

  return (
    <div className="fe-fel-modal" role="dialog" aria-modal="true" aria-labelledby="fe-fel-title">
      <canvas ref={canvasRef} className="fe-fel-confeti" aria-hidden />
      <div className="fe-fel-backdrop" onClick={cerrar} aria-hidden />
      <article className="fe-fel-card">
        <button type="button" className="fe-fel-close" onClick={cerrar} aria-label="Cerrar">
          <X size={18} aria-hidden />
        </button>
        <div className="fe-fel-icon" aria-hidden>
          <PartyPopper size={28} />
        </div>
        <p className="fe-fel-kicker">
          <Sparkles size={14} aria-hidden />
          ¡Felicitaciones!
        </p>
        <h2 id="fe-fel-title" className="fe-fel-title">
          Su beca fue activada
        </h2>
        <p className="fe-fel-lead">
          La carta de aceptación fue enviada y la beca{' '}
          <strong>{tipoBecaLabel}</strong> quedó activa para el ciclo escolar {cicloLabel}.
        </p>
        <ul className="fe-fel-datos">
          <li>
            <Award size={15} aria-hidden />
            <span>
              <strong>Alumno(a):</strong> {alumnoNombre}
            </span>
          </li>
          <li>
            <span>
              <strong>Grado:</strong> {grado}
            </span>
          </li>
          <li>
            <span>
              <strong>Beca:</strong> {tipoBecaLabel}
            </span>
          </li>
        </ul>
        <p className="fe-fel-nota">
          Recuerde cumplir las condiciones de la carta para conservar el beneficio durante
          el ciclo.
        </p>
        <button type="button" className="fe-btn fe-btn--primary fe-fel-btn" onClick={cerrar}>
          Entendido, gracias
        </button>
      </article>
    </div>
  )
}
