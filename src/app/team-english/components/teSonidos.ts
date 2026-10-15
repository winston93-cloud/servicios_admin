/**
 * Sonidos de celebración sintetizados con WebAudio (sin archivos). El navegador solo deja sonar
 * después de una interacción en la página; si el contexto sigue suspendido, cada sonido se omite.
 */

let ctx: AudioContext | null = null
let salida: GainNode | null = null

function contexto(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    salida = ctx.createGain()
    salida.gain.value = 0.55
    salida.connect(comp).connect(ctx.destination)
  }
  return ctx
}

/** Intenta activar el audio; `false` si el navegador lo bloquea hasta que toquen algo. */
export async function activarAudio(): Promise<boolean> {
  const c = contexto()
  if (!c) return false
  if (c.state === 'suspended') await c.resume().catch(() => undefined)
  return c.state === 'running'
}

function listo(): AudioContext | null {
  const c = contexto()
  return c && c.state === 'running' && salida ? c : null
}

function tono(c: AudioContext, o: { tipo: OscillatorType; f0: number; f1?: number; t: number; dur: number; vol: number; filtro?: number }) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = o.tipo
  osc.frequency.setValueAtTime(o.f0, o.t)
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, o.t + o.dur)
  g.gain.setValueAtTime(0.0001, o.t)
  g.gain.exponentialRampToValueAtTime(o.vol, o.t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur)
  let nodo: AudioNode = osc
  if (o.filtro) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.filtro
    osc.connect(f)
    nodo = f
  }
  nodo.connect(g).connect(salida!)
  osc.start(o.t)
  osc.stop(o.t + o.dur + 0.05)
}

function ruido(c: AudioContext, o: { t: number; dur: number; vol: number; tipo: BiquadFilterType; frec: number; q?: number }) {
  const largo = Math.max(1, Math.floor(c.sampleRate * o.dur))
  const buf = c.createBuffer(1, largo, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / largo) ** 2
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = o.tipo
  f.frequency.value = o.frec
  f.Q.value = o.q ?? 0.8
  const g = c.createGain()
  g.gain.value = o.vol
  src.connect(f).connect(g).connect(salida!)
  src.start(o.t)
}

const en = (c: AudioContext, s = 0) => c.currentTime + s

export const sonidos = {
  /** Ta-ta-ta-táaa al abrir. */
  fanfarria() {
    const c = listo()
    if (!c) return
    const notas = [523.25, 659.25, 783.99, 1046.5]
    notas.forEach((f, i) => {
      const t = en(c, i * 0.12)
      const dur = i === notas.length - 1 ? 0.55 : 0.14
      tono(c, { tipo: 'sawtooth', f0: f, t, dur, vol: 0.22, filtro: 2600 })
      tono(c, { tipo: 'square', f0: f / 2, t, dur, vol: 0.08, filtro: 1400 })
    })
  },
  /** Cañón de confeti. */
  pop() {
    const c = listo()
    if (!c) return
    ruido(c, { t: en(c), dur: 0.18, vol: 0.9, tipo: 'bandpass', frec: 1800, q: 0.7 })
    tono(c, { tipo: 'sine', f0: 320, f1: 90, t: en(c), dur: 0.15, vol: 0.4 })
  },
  /** Cohete subiendo. */
  silbido() {
    const c = listo()
    if (!c) return
    tono(c, { tipo: 'sine', f0: 600, f1: 2200, t: en(c), dur: 0.4, vol: 0.12 })
  },
  /** Explosión de fuego artificial o piñata rota. */
  boom(fuerte = false) {
    const c = listo()
    if (!c) return
    ruido(c, { t: en(c), dur: fuerte ? 1.1 : 0.8, vol: fuerte ? 1.4 : 1, tipo: 'lowpass', frec: fuerte ? 700 : 1100 })
    tono(c, { tipo: 'sine', f0: 120, f1: 35, t: en(c), dur: 0.6, vol: 0.7 })
    ruido(c, { t: en(c, 0.12), dur: 0.5, vol: 0.25, tipo: 'highpass', frec: 5000 })
  },
  /** Espantasuegras. */
  corneta() {
    const c = listo()
    if (!c) return
    tono(c, { tipo: 'sawtooth', f0: 330, f1: 520, t: en(c), dur: 0.55, vol: 0.18, filtro: 1800 })
    tono(c, { tipo: 'square', f0: 334, f1: 525, t: en(c), dur: 0.55, vol: 0.06, filtro: 1200 })
  },
  /** Palo contra la piñata. */
  golpe() {
    const c = listo()
    if (!c) return
    ruido(c, { t: en(c), dur: 0.12, vol: 1.1, tipo: 'bandpass', frec: 900, q: 1.4 })
    tono(c, { tipo: 'triangle', f0: 180, f1: 70, t: en(c), dur: 0.14, vol: 0.5 })
  },
  /** Brillitos de estrellas. */
  chime() {
    const c = listo()
    if (!c) return
    ;[1318.5, 1568, 1975.5, 2637].forEach((f, i) => tono(c, { tipo: 'sine', f0: f, t: en(c, i * 0.07), dur: 0.6, vol: 0.1 }))
  },
  /** Subida de nivel de videojuego de 8 bits (skin Arcade). */
  levelUp() {
    const c = listo()
    if (!c) return
    ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tono(c, { tipo: 'square', f0: f, t: en(c, i * 0.07), dur: i === 4 ? 0.32 : 0.08, vol: 0.09 }))
  },
  /** Globo que se infla. */
  globo() {
    const c = listo()
    if (!c) return
    tono(c, { tipo: 'triangle', f0: 260, f1: 900, t: en(c), dur: 0.35, vol: 0.14 })
  },
}
