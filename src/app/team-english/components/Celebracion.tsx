'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'
import { X } from 'lucide-react'
import { REACCIONES, nombreCorto, type Reaccion, type TemaReconocimiento, type TeReconocimiento } from '@/lib/teamEnglish/teTypes'
import { teArchivoUrl } from '../teApi'
import { activarAudio, sonidos } from './teSonidos'

export const DURACION_CELEBRACION_MS = 5000

const PALETAS: Record<TemaReconocimiento, string[]> = {
  arcoiris: ['#ff3cac', '#ffb000', '#2bff88', '#00c6ff', '#a855f7', '#ff5e3a'],
  neon: ['#ff00e6', '#00f0ff', '#39ff14', '#fffb00', '#ff3d81'],
  oro: ['#ffd700', '#fff3b0', '#f7c948', '#ffffff', '#e6a400'],
  galaxia: ['#a78bfa', '#60a5fa', '#f0abfc', '#ffffff', '#22d3ee'],
}

const TEMBLOR: Record<1 | 2, Keyframe[]> = {
  1: [{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-6px,3px) rotate(-1deg)' }, { transform: 'translate(5px,-3px) rotate(1deg)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0) rotate(0)' }],
  2: [
    { transform: 'translate(0,0) rotate(0) scale(1)' },
    { transform: 'translate(-14px,8px) rotate(-2.5deg) scale(1.02)' },
    { transform: 'translate(12px,-10px) rotate(2deg)' },
    { transform: 'translate(-10px,6px) rotate(-1.5deg)' },
    { transform: 'translate(8px,-4px) rotate(1deg)' },
    { transform: 'translate(0,0) rotate(0) scale(1)' },
  ],
}

const azar = (a: number, b: number) => a + Math.random() * (b - a)

/** Coreografía de efectos + sonido + temblor; devuelve la limpieza. */
function lanzarShow(
  rec: TeReconocimiento,
  canvas: HTMLCanvasElement,
  sacudir: (n: 1 | 2) => void,
  setPinata: (e: 'colgada' | 'golpe' | 'rota') => void,
): () => void {
  const fx = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true })
  const colores = PALETAS[rec.tema]
  const timers: number[] = []
  const a = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms))
  const son = (f: () => void) => {
    if (rec.sonido) f()
  }
  const tiembla = (n: 1 | 2) => {
    if (rec.temblor) sacudir(n)
  }
  const tiene = (e: string) => rec.efectos.includes(e as TeReconocimiento['efectos'][number])

  son(sonidos.fanfarria)
  a(180, () => tiembla(1))

  if (tiene('confeti')) {
    const canones = () => {
      son(sonidos.pop)
      fx({ particleCount: 110, angle: 60, spread: 60, startVelocity: 62, origin: { x: 0, y: 0.7 }, colors: colores, ticks: 260 })
      fx({ particleCount: 110, angle: 120, spread: 60, startVelocity: 62, origin: { x: 1, y: 0.7 }, colors: colores, ticks: 260 })
    }
    a(120, canones)
    a(1300, () => {
      son(sonidos.pop)
      fx({ particleCount: 170, spread: 110, startVelocity: 48, origin: { x: 0.5, y: 0.55 }, colors: colores, scalar: 1.15 })
    })
    a(2700, () => {
      son(sonidos.pop)
      fx({ particleCount: 160, spread: 180, startVelocity: 20, gravity: 0.7, origin: { x: 0.5, y: -0.1 }, colors: colores, ticks: 320 })
    })
  }

  if (tiene('fuegos')) {
    for (const ms of [350, 1150, 1950, 2750, 3550]) {
      a(ms, () => son(sonidos.silbido))
      a(ms + 380, () => {
        son(() => sonidos.boom())
        tiembla(2)
        const origin = { x: azar(0.15, 0.85), y: azar(0.12, 0.42) }
        fx({ particleCount: 140, spread: 360, startVelocity: 34, ticks: 95, gravity: 0.75, decay: 0.92, origin, colors: colores, scalar: 1.1, shapes: ['circle'] })
        fx({ particleCount: 40, spread: 360, startVelocity: 16, ticks: 70, gravity: 0.5, decay: 0.9, origin, colors: ['#ffffff'], scalar: 0.7 })
      })
    }
  }

  if (tiene('serpentinas')) {
    a(200, () => son(sonidos.corneta))
    a(1900, () => son(sonidos.corneta))
  }

  if (tiene('pinata')) {
    const dulces = ['🍬', '🍭', '🍫', '🍡', '⭐'].map((text) => confetti.shapeFromText({ text, scalar: 2.4 }))
    for (const ms of [800, 1400]) {
      a(ms, () => {
        son(sonidos.golpe)
        tiembla(1)
        setPinata('golpe')
        a(260, () => setPinata('colgada'))
      })
    }
    a(2050, () => {
      son(() => sonidos.boom(true))
      tiembla(2)
      setPinata('rota')
      fx({ shapes: dulces, scalar: 2.4, particleCount: 46, spread: 170, startVelocity: 38, origin: { x: 0.5, y: 0.16 }, gravity: 1, flat: true, ticks: 320 })
      fx({ particleCount: 120, spread: 160, startVelocity: 40, origin: { x: 0.5, y: 0.16 }, colors: colores })
    })
  }

  if (tiene('globos')) {
    const globo = confetti.shapeFromText({ text: '🎈', scalar: 3.2 })
    for (const ms of [400, 1400, 2400]) {
      a(ms, () => {
        son(sonidos.globo)
        fx({ shapes: [globo], scalar: 3.2, particleCount: 7, angle: 90, spread: 50, startVelocity: 12, gravity: -0.45, drift: azar(-0.6, 0.6), origin: { x: azar(0.15, 0.85), y: 1.05 }, flat: true, ticks: 420 })
      })
    }
  }

  if (tiene('estrellas')) {
    for (const ms of [250, 1650, 3100]) {
      a(ms, () => {
        son(sonidos.chime)
        fx({ shapes: ['star'], colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8'], particleCount: 60, spread: 360, startVelocity: 26, ticks: 130, gravity: 0, decay: 0.94, scalar: 1.5, origin: { x: azar(0.3, 0.7), y: azar(0.3, 0.5) } })
      })
    }
  }

  return () => {
    timers.forEach((t) => window.clearTimeout(t))
    fx.reset()
  }
}

/** Modal de reconocimiento: 5 s con efectos, sonido, temblor y colores locos. */
export default function Celebracion({ rec, homenajeada, onCerrar, miReaccion, onReaccion, conSesion = false, etiqueta }: {
  rec: TeReconocimiento
  /** La teacher que lo ve es una de las felicitadas. */
  homenajeada?: boolean
  onCerrar: () => void
  miReaccion?: Reaccion | null
  onReaccion?: (r: Reaccion | null) => void
  /** Personal (header de sesión) o teacher (cookie) para leer la foto. */
  conSesion?: boolean
  etiqueta?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tarjetaRef = useRef<HTMLDivElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const onCerrarRef = useRef(onCerrar)
  const [pinata, setPinata] = useState<'colgada' | 'golpe' | 'rota'>('colgada')
  const [mudo, setMudo] = useState(false)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [destino] = useState(() => (typeof document === 'undefined' ? null : (document.querySelector('.te-page') as HTMLElement | null) ?? document.body))

  const recRef = useRef(rec)

  useEffect(() => {
    onCerrarRef.current = onCerrar
    recRef.current = rec
  }, [onCerrar, rec])

  /** Solo arranca una vez por reconocimiento; reaccionar no reinicia el show. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const actual = recRef.current
    const previo = document.activeElement as HTMLElement | null
    cerrarRef.current?.focus({ preventScroll: true })
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sacudir = (n: 1 | 2) => {
      if (!reducido) tarjetaRef.current?.animate(TEMBLOR[n], { duration: n === 2 ? 520 : 380, easing: 'ease-out' })
    }
    void activarAudio().then((ok) => {
      if (!ok && actual.sonido) setMudo(true)
    })
    const limpiar = lanzarShow(actual, canvas, sacudir, setPinata)
    const fin = window.setTimeout(() => onCerrarRef.current(), DURACION_CELEBRACION_MS)
    /** En captura: si hay una Hoja abierta debajo, Esc solo cierra la celebración. */
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCerrarRef.current()
    }
    window.addEventListener('keydown', tecla, true)
    return () => {
      limpiar()
      window.clearTimeout(fin)
      window.removeEventListener('keydown', tecla, true)
      previo?.focus?.({ preventScroll: true })
    }
  }, [rec.id])

  useEffect(() => {
    if (!rec.foto_key) return
    let vivo = true
    teArchivoUrl(rec.foto_key, conSesion).then((u) => vivo && setFotoUrl(u)).catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [rec.foto_key, conSesion])

  const conSonido = async () => {
    if (await activarAudio()) {
      setMudo(false)
      sonidos.fanfarria()
      if (rec.efectos.includes('fuegos') || rec.efectos.includes('pinata')) window.setTimeout(() => sonidos.boom(), 450)
      else window.setTimeout(sonidos.pop, 450)
    }
  }

  if (!destino) return null

  return createPortal(
    <div className="te-cel-overlay" role="dialog" aria-modal="true" aria-labelledby={`te-cel-${rec.id}`} onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <canvas ref={canvasRef} className="te-cel-canvas" aria-hidden />

      {rec.efectos.includes('serpentinas') ? (
        <div className="te-cel-serpentinas" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <svg key={i} viewBox="0 0 40 160" style={{
              ['--x' as string]: `${(i * 6.3 + 2) % 100}%`,
              ['--d' as string]: `${(i % 6) * 0.18}s`,
              ['--g' as string]: `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
              ['--c' as string]: PALETAS[rec.tema][i % PALETAS[rec.tema].length],
            }}>
              <path d="M20 0 C 40 15, 0 30, 20 45 S 40 75, 20 90 S 0 120, 20 135 S 40 150, 22 160" />
            </svg>
          ))}
        </div>
      ) : null}

      {rec.efectos.includes('pinata') && pinata !== 'rota' ? (
        <div className="te-cel-pinata" data-estado={pinata} aria-hidden>
          <span className="te-cel-cuerda" />
          <span className="te-cel-pinata-emoji">🪅</span>
        </div>
      ) : null}

      <div ref={tarjetaRef} className="te-cel" data-tema={rec.tema}>
        <button ref={cerrarRef} type="button" className="te-cel-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X size={18} aria-hidden />
        </button>
        <span className="te-cel-brillo" aria-hidden />
        <p className="te-cel-kicker">{etiqueta ?? '🎉 Reconocimiento de la semana'}</p>
        <span className="te-cel-emoji" aria-hidden>{rec.emoji}</span>
        <h2 id={`te-cel-${rec.id}`} className="te-cel-titulo">{rec.titulo}</h2>
        {rec.homenajeadas.length ? (
          <p className="te-cel-para">
            {rec.homenajeadas.map((h) => (
              <span key={h.maestro_id} className="te-cel-nombre">{h.emoji} {nombreCorto(h)}</span>
            ))}
          </p>
        ) : (
          <p className="te-cel-para"><span className="te-cel-nombre">🌈 Todo el Team English</span></p>
        )}
        {homenajeada ? <p className="te-cel-eres">💖 ¡Eres tú! Todo el team te aplaude</p> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {fotoUrl ? <img className="te-cel-foto" src={fotoUrl} alt="" /> : null}
        {rec.mensaje ? <p className="te-cel-mensaje">{rec.mensaje}</p> : null}
        {rec.creado_por ? <p className="te-cel-firma">— {rec.creado_por}</p> : null}

        {onReaccion ? (
          <div className="te-cel-reacciones" role="group" aria-label="Reaccionar">
            {REACCIONES.map((r) => (
              <button key={r.clave} type="button" aria-pressed={miReaccion === r.clave} aria-label={`Reaccionar con ${r.emoji}`}
                onClick={() => onReaccion(miReaccion === r.clave ? null : r.clave)}>
                {r.emoji}
              </button>
            ))}
          </div>
        ) : null}
        {mudo ? (
          <button type="button" className="te-cel-sonido" onClick={() => void conSonido()}>🔊 Toca para el sonido</button>
        ) : null}
        <span className="te-cel-tiempo" style={{ ['--dur' as string]: `${DURACION_CELEBRACION_MS}ms` }} aria-hidden />
      </div>
    </div>,
    destino,
  )
}
