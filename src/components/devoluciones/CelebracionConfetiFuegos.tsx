'use client'

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

type Props = {
  open: boolean
  titulo?: string
  subtitulo?: string
  onClose: () => void
  /** Duración total de la celebración (ms). */
  durationMs?: number
}

/**
 * Overlay de celebración: confeti + fuegos artificiales (canvas) a la vez.
 */
export default function CelebracionConfetiFuegos({
  open,
  titulo = '¡Cheque firmado!',
  subtitulo = 'Puedes avisar a papá/mamá que pase por el cheque.',
  onClose,
  durationMs = 5200,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let running = true
    const start = performance.now()

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    type Particle = {
      x: number
      y: number
      vx: number
      vy: number
      life: number
      maxLife: number
      color: string
      size: number
      gravity: number
    }

    type Rocket = {
      x: number
      y: number
      vy: number
      targetY: number
      color: string
      exploded: boolean
    }

    const colors = ['#ff4d6d', '#ffd60a', '#00e3fd', '#7cfc00', '#ff7b00', '#c77dff', '#fff6df']
    const particles: Particle[] = []
    const rockets: Rocket[] = []

    function burst(x: number, y: number, color: string) {
      const n = 36 + Math.floor(Math.random() * 24)
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4
        const speed = 2.2 + Math.random() * 4.5
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 40 + Math.random() * 35,
          color: Math.random() > 0.35 ? color : colors[Math.floor(Math.random() * colors.length)],
          size: 1.5 + Math.random() * 2.5,
          gravity: 0.045 + Math.random() * 0.03,
        })
      }
    }

    function spawnRocket() {
      const x = canvas!.width * (0.12 + Math.random() * 0.76)
      rockets.push({
        x,
        y: canvas!.height + 8,
        vy: -(7.5 + Math.random() * 4),
        targetY: canvas!.height * (0.18 + Math.random() * 0.35),
        color: colors[Math.floor(Math.random() * colors.length)],
        exploded: false,
      })
    }

    // Confeti continuo (canvas-confetti) + oleadas
    const confettiCannon = confetti.create(undefined, { resize: true, useWorker: true })
    const confettiTimers: number[] = []

    const fireConfetti = () => {
      confettiCannon({
        particleCount: 90,
        spread: 70,
        origin: { x: Math.random() * 0.3, y: 0.7 },
        colors,
        startVelocity: 45,
        gravity: 0.9,
        ticks: 220,
      })
      confettiCannon({
        particleCount: 90,
        spread: 70,
        origin: { x: 0.7 + Math.random() * 0.3, y: 0.7 },
        colors,
        startVelocity: 45,
        gravity: 0.9,
        ticks: 220,
      })
      confettiCannon({
        particleCount: 60,
        spread: 100,
        origin: { x: 0.5, y: 0.55 },
        colors,
        startVelocity: 55,
        scalar: 1.1,
      })
    }

    fireConfetti()
    confettiTimers.push(window.setTimeout(fireConfetti, 400))
    confettiTimers.push(window.setTimeout(fireConfetti, 900))
    confettiTimers.push(window.setTimeout(fireConfetti, 1500))
    confettiTimers.push(window.setTimeout(fireConfetti, 2200))
    confettiTimers.push(window.setTimeout(fireConfetti, 3200))

    // Fuegos: varios cohetes iniciales
    for (let i = 0; i < 5; i++) {
      confettiTimers.push(window.setTimeout(() => spawnRocket(), i * 280))
    }
    const rocketInterval = window.setInterval(() => {
      if (!running) return
      spawnRocket()
      if (Math.random() > 0.4) spawnRocket()
    }, 520)

    const draw = (now: number) => {
      if (!running) return
      const elapsed = now - start
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Cohetes
      for (const r of rockets) {
        if (r.exploded) continue
        r.y += r.vy
        r.vy += 0.04
        ctx.beginPath()
        ctx.fillStyle = r.color
        ctx.shadowBlur = 12
        ctx.shadowColor = r.color
        ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        // estela
        ctx.strokeStyle = `${r.color}88`
        ctx.beginPath()
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(r.x, r.y + 14)
        ctx.stroke()
        if (r.y <= r.targetY || r.vy >= -1) {
          r.exploded = true
          burst(r.x, r.y, r.color)
        }
      }

      // Partículas de explosión
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life += 1
        p.x += p.vx
        p.y += p.vy
        p.vy += p.gravity
        p.vx *= 0.99
        const alpha = Math.max(0, 1 - p.life / p.maxLife)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        if (p.life >= p.maxLife) particles.splice(i, 1)
      }

      // limpia cohetes explotados
      for (let i = rockets.length - 1; i >= 0; i--) {
        if (rockets[i].exploded) rockets.splice(i, 1)
      }

      if (elapsed < durationMs) {
        raf = requestAnimationFrame(draw)
      } else {
        running = false
        onCloseRef.current()
      }
    }

    raf = requestAnimationFrame(draw)

    const autoClose = window.setTimeout(() => {
      running = false
      onCloseRef.current()
    }, durationMs + 200)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.clearInterval(rocketInterval)
      window.clearTimeout(autoClose)
      confettiTimers.forEach((t) => window.clearTimeout(t))
      window.removeEventListener('resize', resize)
      confettiCannon.reset()
    }
  }, [open, durationMs])

  if (!open) return null

  return (
    <div className="devoluciones-celebra" role="dialog" aria-modal="true" aria-label={titulo}>
      <canvas ref={canvasRef} className="devoluciones-celebra-canvas" aria-hidden />
      <div className="devoluciones-celebra-card">
        <p className="devoluciones-celebra-kicker">Etapa 4 / 5</p>
        <h2>{titulo}</h2>
        <p>{subtitulo}</p>
        <button type="button" className="devoluciones-btn primary" onClick={onClose}>
          ¡Listo!
        </button>
      </div>
    </div>
  )
}
