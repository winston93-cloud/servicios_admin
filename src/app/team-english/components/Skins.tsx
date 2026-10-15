'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'

export type TeSkin = 'kawaii' | 'oceano' | 'galaxia' | 'bosque' | 'arcade'

/** Cada skin además de colores cambia la estructura (menú, tarjetas, tipografía); `hub` titula el inicio. */
export const TE_SKINS: { id: TeSkin; nombre: string; emoji: string; sub: string; hub?: string; doodles: string[] }[] = [
  { id: 'kawaii', nombre: 'Kawaii', emoji: '🌈', sub: 'Cuaderno de stickers pastel', doodles: ['⭐', '🌸', '☁️', '💖', '✨', '🌈', '🍓', '⭐', '☁️', '✨'] },
  { id: 'oceano', nombre: 'Acuario', emoji: '🐬', sub: 'Burbujas y menú abajo, como el celular', doodles: ['🐚', '🫧', '🐠', '🫧', '🐬', '🫧', '🐙', '🫧', '🐳', '🫧'] },
  { id: 'galaxia', nombre: 'Nave espacial', emoji: '🚀', sub: 'Cabina con menú lateral y órbita', hub: 'Panel de control', doodles: ['🪐', '✨', '🛰️', '🌙', '⭐', '☄️', '👽', '✨', '🌟', '🛸'] },
  { id: 'bosque', nombre: 'Diario de campo', emoji: '🍄', sub: 'Libreta con fotos y cinta', hub: 'Mi diario', doodles: ['🍄', '🌿', '🦋', '🌼', '🍃', '🐞', '🌳', '🦊', '🌻', '🐌'] },
  { id: 'arcade', nombre: 'Arcade', emoji: '🕹️', sub: 'Videojuego retro con XP', hub: 'SELECT STAGE', doodles: ['👾', '🕹️', '⚡', '💥', '⭐', '🎮', '🍒', '👾', '💎', '⚡'] },
]

const CLAVE = 'team-english-skin'
const EVENTO = 'te-skin'

function leer(): TeSkin {
  try {
    const v = window.localStorage.getItem(CLAVE)
    return TE_SKINS.some((s) => s.id === v) ? (v as TeSkin) : 'kawaii'
  } catch {
    return 'kawaii'
  }
}

function suscribir(cb: () => void): () => void {
  window.addEventListener('storage', cb)
  window.addEventListener(EVENTO, cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener(EVENTO, cb)
  }
}

/** Skin elegido en este navegador (se guarda en localStorage, independiente del claro/oscuro). */
export function useTeSkin(): [TeSkin, (s: TeSkin) => void] {
  const skin = useSyncExternalStore(suscribir, leer, () => 'kawaii' as TeSkin)
  const cambiar = (s: TeSkin) => {
    try {
      window.localStorage.setItem(CLAVE, s)
    } catch {
      /* modo privado: solo dura la sesión */
    }
    window.dispatchEvent(new Event(EVENTO))
  }
  return [skin, cambiar]
}

export function skinDe(id: TeSkin) {
  return TE_SKINS.find((s) => s.id === id) ?? TE_SKINS[0]
}

export function Doodles({ skin, cuantos = 10 }: { skin: TeSkin; cuantos?: number }) {
  return (
    <div className="te-doodles" aria-hidden>
      {skinDe(skin).doodles.slice(0, cuantos).map((e, i) => (
        <span key={`${skin}-${i}`} style={{ ['--i' as string]: i }}>{e}</span>
      ))}
    </div>
  )
}

export type TeNavItem<T extends string> = { id: T; titulo: string; emoji: string }

/** Menú de secciones que cada skin acomoda a su manera (dock, cabina, pestañas, barra pixel); en kawaii no se ve. */
export function TemaNav<T extends string>({ items, actual, onIr }: { items: TeNavItem<T>[]; actual: T | null; onIr: (id: T | null) => void }) {
  return (
    <nav className="te-tema-nav" aria-label="Secciones de Team English">
      <button type="button" className="te-tema-nav-i" aria-current={actual === null ? 'page' : undefined} onClick={() => onIr(null)}>
        <span aria-hidden>🏠</span><small>Inicio</small>
      </button>
      {items.map((s) => (
        <button key={s.id} type="button" className="te-tema-nav-i" aria-current={actual === s.id ? 'page' : undefined} onClick={() => onIr(s.id)}>
          <span aria-hidden>{s.emoji}</span><small>{s.titulo}</small>
        </button>
      ))}
    </nav>
  )
}

/** «LEVEL UP!» del skin Arcade al guardar; `n` cambia en cada aviso para repetir la animación. */
export function LevelUp({ n }: { n: number }) {
  return n ? <span key={n} className="te-levelup" aria-hidden>LEVEL UP!</span> : null
}

export function SkinSwitch({ skin, onCambiar }: { skin: TeSkin; onCambiar: (s: TeSkin) => void }) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const caja = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const actual = skinDe(skin)

  useEffect(() => {
    if (!abierto) return
    lista.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      caja.current?.querySelector<HTMLButtonElement>('.te-skin-btn')?.focus()
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('touchstart', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('touchstart', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  const mover = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    const i = TE_SKINS.findIndex((s) => s.id === skin)
    const sig = TE_SKINS[(i + paso + TE_SKINS.length) % TE_SKINS.length]
    onCambiar(sig.id)
    requestAnimationFrame(() => lista.current?.querySelector<HTMLButtonElement>(`[data-skin-op="${sig.id}"]`)?.focus())
  }

  return (
    <div className="te-skin" ref={caja}>
      <button type="button" className="te-btn te-skin-btn" aria-haspopup="true" aria-expanded={abierto} aria-controls={id}
        title={`Estilo: ${actual.nombre}`} onClick={() => setAbierto((v) => !v)}>
        <span className="te-skin-btn-emoji" aria-hidden>{actual.emoji}</span>
        <span className="te-skin-btn-txt">Estilo</span>
      </button>
      {abierto ? (
        <div className="te-skin-pop" id={id}>
          <p className="te-skin-pop-titulo">🎨 Elige el estilo de Team English</p>
          <div className="te-skin-lista" role="radiogroup" aria-label="Estilo de Team English" ref={lista} onKeyDown={mover}>
            {TE_SKINS.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={s.id === skin} tabIndex={s.id === skin ? 0 : -1}
                data-skin-op={s.id} className="te-skin-op" onClick={() => onCambiar(s.id)}>
                <span className="te-skin-muestra" data-muestra={s.id} aria-hidden>{s.emoji}</span>
                <span className="te-min0">
                  <b>{s.nombre}</b>
                  <small>{s.sub}</small>
                </span>
                {s.id === skin ? <Check size={18} aria-hidden className="te-skin-check" /> : null}
              </button>
            ))}
          </div>
          <p className="te-skin-pop-nota">Se combina con claro/oscuro y se guarda en este dispositivo.</p>
        </div>
      ) : null}
    </div>
  )
}
